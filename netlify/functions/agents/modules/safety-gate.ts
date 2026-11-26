import { z } from 'zod'
import { supabaseAdmin } from '../../lib/supabase-admin'
import { SafetyGateState } from '../../../../src/types'

const CRITICAL_CONFLICT_THRESHOLD = 1  // Any critical conflict → RED
const HIGH_CONFLICT_THRESHOLD = 3      // 3+ high conflicts → RED
const EVIDENCE_COMPLETENESS_YELLOW = 0.5  // Below this → YELLOW
const EVIDENCE_COMPLETENESS_RED = 0.3     // Below this → RED

export interface SafetyAssessment {
  gate_state: SafetyGateState
  gate_reason: string
  critical_issues: string[]
  unresolved_contradictions: number
  missing_critical_info: number
  can_generate_summary: boolean
  blocked_conclusions: string[]
  evidence_completeness: number
}

export async function evaluateSafetyGate(patientId: string): Promise<SafetyAssessment> {
  const criticalIssues: string[] = []
  const blockedConclusions: string[] = []

  // Count contradictions by severity
  const { data: contradictions } = await supabaseAdmin
    .from('contradictions')
    .select('severity, status')
    .eq('patient_id', patientId)
    .eq('status', 'open')

  const criticalConflicts = contradictions?.filter(c => c.severity === 'critical').length ?? 0
  const highConflicts = contradictions?.filter(c => c.severity === 'high').length ?? 0
  const totalOpen = contradictions?.length ?? 0

  // Count statements by evidence status
  const { data: statements } = await supabaseAdmin
    .from('clinical_statements')
    .select('evidence_status')
    .eq('patient_id', patientId)

  const total = statements?.length ?? 0
  const verified = statements?.filter(s => s.evidence_status === 'verified').length ?? 0
  const supported = statements?.filter(s => s.evidence_status === 'supported').length ?? 0
  const conflicting = statements?.filter(s => s.evidence_status === 'conflicting').length ?? 0
  const missing = statements?.filter(s => s.evidence_status === 'missing_evidence').length ?? 0

  const completeness = total > 0 ? (verified + supported) / total : 0

  // Count critical missing info
  const { data: missingInfo } = await supabaseAdmin
    .from('missing_information')
    .select('id')
    .eq('patient_id', patientId)
    .eq('is_critical', true)
    .eq('status', 'open')

  const missingCritical = missingInfo?.length ?? 0

  // Determine gate state using transparent, conservative rules
  let gateState: SafetyGateState = 'GREEN'
  let gateReason = 'Evidence is sufficiently consistent for a qualified summary.'

  // RED conditions (blocking)
  if (criticalConflicts >= CRITICAL_CONFLICT_THRESHOLD) {
    gateState = 'RED'
    gateReason = `${criticalConflicts} critical unresolved contradiction(s) prevent a reliable conclusion.`
    criticalIssues.push(`${criticalConflicts} critical contradiction(s) require human review before proceeding`)
    blockedConclusions.push('Clinical summary blocked — resolve critical contradictions first')
  }

  if (highConflicts >= HIGH_CONFLICT_THRESHOLD) {
    gateState = 'RED'
    gateReason = `${highConflicts} high-severity unresolved contradictions exceed the safety threshold.`
    criticalIssues.push(`${highConflicts} high-severity contradictions require resolution`)
    blockedConclusions.push('Medication reconciliation blocked — high-severity dosage conflicts present')
  }

  if (completeness < EVIDENCE_COMPLETENESS_RED && total > 0) {
    gateState = 'RED'
    gateReason = `Evidence completeness (${Math.round(completeness * 100)}%) is below the minimum threshold for a safe summary.`
    criticalIssues.push('Insufficient verified evidence to support a clinical summary')
    blockedConclusions.push('Summary generation blocked — evidence completeness too low')
  }

  // YELLOW conditions (qualify)
  if (gateState === 'GREEN') {
    if (completeness < EVIDENCE_COMPLETENESS_YELLOW && total > 0) {
      gateState = 'YELLOW'
      gateReason = `Evidence completeness is ${Math.round(completeness * 100)}% — missing or uncertain information must be noted.`
      criticalIssues.push('Summary must clearly indicate uncertain and missing information')
    }

    if (missingCritical > 0) {
      gateState = 'YELLOW'
      gateReason = `${missingCritical} critical documentation gap(s) prevent a complete picture.`
      criticalIssues.push(`${missingCritical} critical documentation gap(s) remain unresolved`)
    }

    if (totalOpen > 0 && gateState === 'GREEN') {
      gateState = 'YELLOW'
      gateReason = `${totalOpen} open contradiction(s) require qualification in the summary.`
    }
  }

  return {
    gate_state: gateState,
    gate_reason: gateReason,
    critical_issues: criticalIssues,
    unresolved_contradictions: totalOpen,
    missing_critical_info: missingCritical,
    can_generate_summary: gateState !== 'RED',
    blocked_conclusions: blockedConclusions,
    evidence_completeness: completeness,
  }
}
