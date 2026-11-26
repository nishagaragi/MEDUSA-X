import { supabaseAdmin } from '../../lib/supabase-admin'
import { evaluateSafetyGate } from './safety-gate'

export async function runSafetyEscalationAgent(
  patientId: string,
): Promise<{ findings: Record<string, unknown>; warnings: string[] }> {
  const warnings: string[] = []

  // Run the safety gate evaluation
  const assessment = await evaluateSafetyGate(patientId)

  const findings: Record<string, unknown> = {
    gate_state: assessment.gate_state,
    gate_reason: assessment.gate_reason,
    escalations_created: 0,
    conclusions_blocked: assessment.blocked_conclusions.length,
    unresolved_contradictions: assessment.unresolved_contradictions,
    missing_critical_info: assessment.missing_critical_info,
    can_generate_summary: assessment.can_generate_summary,
  }

  // Create escalations for critical issues
  if (assessment.gate_state === 'RED') {
    warnings.push(`SAFETY GATE: RED — ${assessment.gate_reason}`)
    warnings.push('Human review mandatory before any clinical summary can be generated')

    if (assessment.blocked_conclusions.length > 0) {
      warnings.push(...assessment.blocked_conclusions.map(c => `BLOCKED: ${c}`))
    }

    // Find critical contradictions that need escalation
    const { data: criticalContradictions } = await supabaseAdmin
      .from('contradictions')
      .select('id, description, severity')
      .eq('patient_id', patientId)
      .eq('status', 'open')
      .in('severity', ['critical', 'high'])

    for (const contradiction of criticalContradictions ?? []) {
      // Check if escalation already exists
      const { data: existing } = await supabaseAdmin
        .from('escalations')
        .select('id')
        .eq('patient_id', patientId)
        .eq('contradiction_id', contradiction.id)
        .single()

      if (!existing) {
        await supabaseAdmin.from('escalations').insert({
          patient_id: patientId,
          contradiction_id: contradiction.id,
          severity: contradiction.severity === 'critical' ? 'blocking' : 'critical',
          status: 'open',
          title: `${contradiction.severity === 'critical' ? 'Critical' : 'High-severity'}: ${contradiction.description.slice(0, 100)}`,
          description: contradiction.description,
          safety_gate_state: assessment.gate_state,
          blocked_conclusions: assessment.blocked_conclusions,
          recommended_action: 'Resolve this contradiction before proceeding with clinical summary generation.',
        })
        ;(findings.escalations_created as number)++
      }
    }

    // Escalate critical missing information
    const { data: criticalMissing } = await supabaseAdmin
      .from('missing_information')
      .select('id, description, clinician_question')
      .eq('patient_id', patientId)
      .eq('is_critical', true)
      .eq('status', 'open')

    for (const missing of criticalMissing ?? []) {
      const { data: existing } = await supabaseAdmin
        .from('escalations')
        .select('id')
        .eq('patient_id', patientId)
        .eq('missing_info_id', missing.id)
        .single()

      if (!existing) {
        await supabaseAdmin.from('escalations').insert({
          patient_id: patientId,
          missing_info_id: missing.id,
          severity: 'critical',
          status: 'open',
          title: `Critical missing information: ${missing.description.slice(0, 80)}`,
          description: missing.description,
          safety_gate_state: assessment.gate_state,
          blocked_conclusions: ['Clinical summary requires this information'],
          recommended_action: missing.clinician_question ?? 'Locate and review missing documentation before proceeding.',
        })
        ;(findings.escalations_created as number)++
      }
    }
  } else if (assessment.gate_state === 'YELLOW') {
    warnings.push(`SAFETY GATE: YELLOW — ${assessment.gate_reason}`)
    warnings.push('Supported facts shown, unresolved issues must be clearly documented in any summary')
  } else {
    // GREEN
    warnings.push(`SAFETY GATE: GREEN — Evidence is sufficiently consistent for a qualified summary`)
  }

  // Update agent run with safety findings
  await supabaseAdmin
    .from('agent_runs')
    .update({
      findings: findings,
      warnings: warnings,
    })
    .eq('patient_id', patientId)
    .eq('agent_name', 'safety_escalation_agent')
    .eq('status', 'running')

  return { findings, warnings }
}
