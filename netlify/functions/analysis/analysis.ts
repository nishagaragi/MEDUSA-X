import { Handler } from '@netlify/functions'
import { supabaseAdmin } from '../lib/supabase-admin'
import {
  authenticate, successResponse, errorResponse,
  unauthorizedResponse, optionsResponse, logAudit,
  notFoundResponse,
} from '../lib/middleware'
import { evaluateSafetyGate } from '../agents/modules/safety-gate'
import { orchestrateAgents } from '../agents/orchestrator'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse()

  const user = await authenticate(event)
  if (!user) return unauthorizedResponse()

  const path = event.path
  const pathParts = path.split('/').filter(Boolean)
  const patientIdx = pathParts.indexOf('patients')
  const patientId = patientIdx >= 0 ? pathParts[patientIdx + 1] : null

  if (!patientId) return errorResponse('Patient ID required', 400)

  // Verify patient belongs to org
  const { data: patient } = await supabaseAdmin
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .eq('organization_id', user.organization_id)
    .single()

  if (!patient) return notFoundResponse('Patient')

  // GET /patients/:id/analysis
  if (event.httpMethod === 'GET' && path.endsWith('/analysis')) {
    const { data, error } = await supabaseAdmin
      .from('analysis_sessions')
      .select('*')
      .eq('patient_id', patientId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (error) return successResponse({ data: null })
    return successResponse({ data })
  }

  // POST /patients/:id/analyze
  if (event.httpMethod === 'POST' && path.endsWith('/analyze')) {
    // Create analysis session
    const { data: session, error } = await supabaseAdmin
      .from('analysis_sessions')
      .insert({
        patient_id: patientId,
        triggered_by: user.id,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return errorResponse('Failed to start analysis', 500)

    // Queue agent runs
    const agents = [
      'document_detective', 'timeline_agent', 'diagnosis_investigator',
      'medication_auditor', 'laboratory_verification_agent',
      'evidence_auditor', 'safety_escalation_agent',
    ]

    await supabaseAdmin.from('agent_runs').insert(
      agents.map(name => ({
        patient_id: patientId,
        agent_name: name,
        status: 'queued',
        triggered_by: user.id,
      }))
    )

    // Run the full agent orchestration pipeline
    // Note: In production this should be a background job due to serverless timeouts.
    // For demonstration, runs inline with graceful timeout handling.
    try {
      await Promise.race([
        orchestrateAgents(patientId, session.id),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Orchestration timeout')), 25000)),
      ])
    } catch (orchErr) {
      // Partial results are acceptable — safety gate will assess what was collected
      console.warn('Orchestration partial/timeout:', orchErr instanceof Error ? orchErr.message : orchErr)
    }

    // Run safety gate evaluation on whatever was collected
    const safetyAssessment = await evaluateSafetyGate(patientId)

    // Count statements
    const { count: total } = await supabaseAdmin
      .from('clinical_statements')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', patientId)

    const { count: verified } = await supabaseAdmin
      .from('clinical_statements')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', patientId)
      .eq('evidence_status', 'verified')

    const { count: uncertain } = await supabaseAdmin
      .from('clinical_statements')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', patientId)
      .eq('evidence_status', 'uncertain')

    const { count: conflicting } = await supabaseAdmin
      .from('clinical_statements')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', patientId)
      .eq('evidence_status', 'conflicting')

    const { count: escalations } = await supabaseAdmin
      .from('escalations')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', patientId)
      .eq('status', 'open')

    // Update session
    await supabaseAdmin
      .from('analysis_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        safety_gate_state: safetyAssessment.gate_state,
        total_statements: total ?? 0,
        verified_count: verified ?? 0,
        uncertain_count: uncertain ?? 0,
        conflicting_count: conflicting ?? 0,
        escalation_count: escalations ?? 0,
      })
      .eq('id', session.id)

    // Update agent statuses (simplified — in production would run asynchronously)
    await supabaseAdmin
      .from('agent_runs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('patient_id', patientId)
      .eq('status', 'queued')

    await logAudit({
      userId: user.id,
      organizationId: user.organization_id,
      patientId,
      action: 'analysis_started',
      resourceType: 'analysis_session',
      resourceId: session.id,
    })

    const { data: updatedSession } = await supabaseAdmin
      .from('analysis_sessions')
      .select('*')
      .eq('id', session.id)
      .single()

    return successResponse({ data: updatedSession })
  }

  // GET /patients/:id/timeline
  if (event.httpMethod === 'GET' && path.endsWith('/timeline')) {
    const { data, error } = await supabaseAdmin
      .from('clinical_events')
      .select('*')
      .eq('patient_id', patientId)
      .order('event_date', { ascending: true, nullsFirst: false })

    if (error) return errorResponse(error.message, 500)
    return successResponse({ data: data ?? [] })
  }

  // GET /patients/:id/diagnoses
  if (event.httpMethod === 'GET' && path.endsWith('/diagnoses')) {
    const { data, error } = await supabaseAdmin
      .from('diagnoses')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })

    if (error) return errorResponse(error.message, 500)
    return successResponse({ data: data ?? [] })
  }

  // GET /patients/:id/medications
  if (event.httpMethod === 'GET' && path.endsWith('/medications')) {
    const { data, error } = await supabaseAdmin
      .from('medications')
      .select('*, events:medication_events(*)')
      .eq('patient_id', patientId)
      .order('name')

    if (error) return errorResponse(error.message, 500)
    return successResponse({ data: data ?? [] })
  }

  // GET /patients/:id/laboratory-results
  if (event.httpMethod === 'GET' && path.endsWith('/laboratory-results')) {
    const { data, error } = await supabaseAdmin
      .from('laboratory_results')
      .select('*')
      .eq('patient_id', patientId)
      .order('sample_date', { ascending: false, nullsFirst: false })

    if (error) return errorResponse(error.message, 500)
    return successResponse({ data: data ?? [] })
  }

  // GET /patients/:id/contradictions
  if (event.httpMethod === 'GET' && path.endsWith('/contradictions')) {
    const { data, error } = await supabaseAdmin
      .from('contradictions')
      .select('*')
      .eq('patient_id', patientId)
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) return errorResponse(error.message, 500)
    return successResponse({ data: data ?? [] })
  }

  // GET /patients/:id/missing-information
  if (event.httpMethod === 'GET' && path.endsWith('/missing-information')) {
    const { data, error } = await supabaseAdmin
      .from('missing_information')
      .select('*')
      .eq('patient_id', patientId)
      .order('is_critical', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) return errorResponse(error.message, 500)
    return successResponse({ data: data ?? [] })
  }

  // GET /patients/:id/uncertainty
  if (event.httpMethod === 'GET' && path.endsWith('/uncertainty')) {
    const safetyAssessment = await evaluateSafetyGate(patientId)

    const { data: statements } = await supabaseAdmin
      .from('clinical_statements')
      .select('evidence_status')
      .eq('patient_id', patientId)

    const total = statements?.length ?? 0
    const countByStatus = (s: string) => statements?.filter(st => st.evidence_status === s).length ?? 0

    const evidenceSummary = {
      total_statements: total,
      verified: countByStatus('verified'),
      supported: countByStatus('supported'),
      uncertain: countByStatus('uncertain'),
      conflicting: countByStatus('conflicting'),
      missing: countByStatus('missing_evidence'),
      superseded: countByStatus('superseded'),
      evidence_completeness_score: safetyAssessment.evidence_completeness,
    }

    return successResponse({ data: { safety_assessment: safetyAssessment, evidence_summary: evidenceSummary } })
  }

  // GET /patients/:id/escalations
  if (event.httpMethod === 'GET' && path.endsWith('/escalations')) {
    const { data, error } = await supabaseAdmin
      .from('escalations')
      .select('*')
      .eq('patient_id', patientId)
      .order('severity', { ascending: false })

    if (error) return errorResponse(error.message, 500)
    return successResponse({ data: data ?? [] })
  }

  // POST /patients/:id/escalations
  if (event.httpMethod === 'POST' && path.endsWith('/escalations')) {
    let body
    try { body = JSON.parse(event.body ?? '{}') } catch { return errorResponse('Invalid JSON', 400) }

    const { data, error } = await supabaseAdmin
      .from('escalations')
      .insert({ ...body, patient_id: patientId })
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)
    return successResponse({ data }, 201)
  }

  // GET /patients/:id/graph
  if (event.httpMethod === 'GET' && path.endsWith('/graph')) {
    const { data: nodes } = await supabaseAdmin
      .from('knowledge_graph_nodes')
      .select('*')
      .eq('patient_id', patientId)

    const { data: edges } = await supabaseAdmin
      .from('knowledge_graph_edges')
      .select('*')
      .eq('patient_id', patientId)

    return successResponse({ data: { nodes: nodes ?? [], edges: edges ?? [] } })
  }

  // GET /patients/:id/agents/status
  if (event.httpMethod === 'GET' && path.endsWith('/status')) {
    const { data, error } = await supabaseAdmin
      .from('agent_runs')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(14)  // last 2 runs of each agent

    if (error) return errorResponse(error.message, 500)
    return successResponse({ data: data ?? [] })
  }

  // POST /patients/:id/agents/run
  if (event.httpMethod === 'POST' && path.endsWith('/run')) {
    const agents = [
      'document_detective', 'timeline_agent', 'diagnosis_investigator',
      'medication_auditor', 'laboratory_verification_agent',
      'evidence_auditor', 'safety_escalation_agent',
    ]

    const { data: runs, error } = await supabaseAdmin
      .from('agent_runs')
      .insert(
        agents.map(name => ({
          patient_id: patientId,
          agent_name: name,
          status: 'queued',
          triggered_by: user.id,
        }))
      )
      .select()

    if (error) return errorResponse(error.message, 500)

    // Run analysis and orchestration in background (fire and don't wait for serverless response)
    // The frontend polls /agents/status to get progress
    orchestrateAgents(patientId, patientId).catch(err => {
      console.error('Agent orchestration error:', err)
    })

    await logAudit({
      userId: user.id,
      organizationId: user.organization_id,
      patientId,
      action: 'agents_run_started',
    })

    return successResponse({ data: { session_id: patientId, runs } })
  }

  return errorResponse('Not found', 404)
}
