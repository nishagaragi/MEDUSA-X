/**
 * TRUST-MED AI — Agent Orchestrator
 * Coordinates the seven Clinical Detective agents in sequence.
 * Each agent communicates through validated structured JSON (database).
 * Agents CANNOT invent facts or override source evidence.
 */

import { supabaseAdmin } from '../lib/supabase-admin'
import { runDocumentDetective } from './modules/document-detective'
import { runTimelineAgent } from './modules/timeline-agent'
import { runDiagnosisInvestigator } from './modules/diagnosis-investigator'
import { runMedicationAuditor } from './modules/medication-auditor'
import { runLabVerificationAgent } from './modules/lab-verification-agent'
import { runEvidenceAuditor } from './modules/evidence-auditor'
import { runSafetyEscalationAgent } from './modules/safety-escalation-agent'
import { extractStatements, detectContradictions } from './modules/statement-extractor'
import { buildKnowledgeGraph } from './modules/knowledge-graph'

type AgentName =
  | 'document_detective'
  | 'timeline_agent'
  | 'diagnosis_investigator'
  | 'medication_auditor'
  | 'laboratory_verification_agent'
  | 'evidence_auditor'
  | 'safety_escalation_agent'

async function updateAgentRun(
  patientId: string,
  agentName: AgentName,
  status: 'running' | 'completed' | 'failed' | 'blocked_by_safety',
  findings?: Record<string, unknown>,
  warnings?: string[],
  errors?: string[],
  startedAt?: string,
) {
  const update: Record<string, unknown> = { status }
  if (findings) update.findings = findings
  if (warnings) update.warnings = warnings
  if (errors) update.errors = errors
  if (status === 'running') update.started_at = startedAt ?? new Date().toISOString()
  if (status === 'completed' || status === 'failed' || status === 'blocked_by_safety') {
    update.completed_at = new Date().toISOString()
  }

  await supabaseAdmin
    .from('agent_runs')
    .update(update)
    .eq('patient_id', patientId)
    .eq('agent_name', agentName)
    .eq('status', status === 'running' ? 'queued' : 'running')
    .order('created_at', { ascending: false })
    .limit(1)
}

async function runAgent(
  patientId: string,
  agentName: AgentName,
  agentFn: () => Promise<{ findings: Record<string, unknown>; warnings: string[] }>,
): Promise<boolean> {
  const startTime = Date.now()
  await updateAgentRun(patientId, agentName, 'running', undefined, undefined, undefined, new Date().toISOString())

  try {
    const { findings, warnings } = await agentFn()
    const executionMs = Date.now() - startTime

    await supabaseAdmin
      .from('agent_runs')
      .update({
        status: 'completed',
        findings,
        warnings,
        errors: [],
        completed_at: new Date().toISOString(),
        execution_time_ms: executionMs,
      })
      .eq('patient_id', patientId)
      .eq('agent_name', agentName)
      .eq('status', 'running')

    return true
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`Agent ${agentName} failed:`, err)

    await supabaseAdmin
      .from('agent_runs')
      .update({
        status: 'failed',
        errors: [errorMsg],
        completed_at: new Date().toISOString(),
        execution_time_ms: Date.now() - startTime,
      })
      .eq('patient_id', patientId)
      .eq('agent_name', agentName)
      .eq('status', 'running')

    return false
  }
}

export async function orchestrateAgents(patientId: string, sessionId: string): Promise<void> {
  console.log(`[Orchestrator] Starting agent swarm for patient ${patientId}`)

  // Phase 1: Document Detective — classify and understand documents
  await runAgent(patientId, 'document_detective', () => runDocumentDetective(patientId, sessionId))

  // Phase 2: Extract statements from all document pages
  const { data: docs } = await supabaseAdmin
    .from('documents')
    .select('id')
    .eq('patient_id', patientId)
    .in('status', ['extracted', 'classified', 'analyzed'])

  for (const doc of docs ?? []) {
    const { data: extractions } = await supabaseAdmin
      .from('document_extractions')
      .select('page_number, cleaned_text')
      .eq('document_id', doc.id)
      .not('cleaned_text', 'is', null)

    for (const ext of extractions ?? []) {
      if (ext.cleaned_text) {
        await extractStatements(patientId, doc.id, ext.cleaned_text, ext.page_number)
      }
    }
  }

  // Phase 3: Timeline Agent
  await runAgent(patientId, 'timeline_agent', () => runTimelineAgent(patientId))

  // Phase 4: Diagnosis Investigator
  await runAgent(patientId, 'diagnosis_investigator', () => runDiagnosisInvestigator(patientId))

  // Phase 5: Medication Auditor
  await runAgent(patientId, 'medication_auditor', () => runMedicationAuditor(patientId))

  // Phase 6: Lab Verification Agent
  await runAgent(patientId, 'laboratory_verification_agent', () => runLabVerificationAgent(patientId))

  // Phase 7: Detect cross-document contradictions
  await detectContradictions(patientId)

  // Phase 8: Evidence Auditor — verify all extracted statements
  await runAgent(patientId, 'evidence_auditor', () => runEvidenceAuditor(patientId))

  // Phase 9: Build knowledge graph
  await buildKnowledgeGraph(patientId)

  // Phase 10: Safety & Escalation Agent — MUST run last
  await runAgent(patientId, 'safety_escalation_agent', () => runSafetyEscalationAgent(patientId))

  console.log(`[Orchestrator] Agent swarm completed for patient ${patientId}`)
}
