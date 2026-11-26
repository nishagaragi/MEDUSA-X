import { Handler } from '@netlify/functions'
import { supabaseAdmin } from '../lib/supabase-admin'
import {
  authenticate, successResponse, errorResponse,
  unauthorizedResponse, optionsResponse, logAudit,
  notFoundResponse,
} from '../lib/middleware'
import { evaluateSafetyGate } from '../agents/modules/safety-gate'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse()

  const user = await authenticate(event)
  if (!user) return unauthorizedResponse()

  const path = event.path
  const pathParts = path.split('/').filter(Boolean)

  // POST /patients/:id/reports
  if (event.httpMethod === 'POST' && pathParts.includes('patients')) {
    const patientIdx = pathParts.indexOf('patients')
    const patientId = pathParts[patientIdx + 1]

    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .eq('organization_id', user.organization_id)
      .single()

    if (!patient) return notFoundResponse('Patient')

    // Run safety gate
    const safetyAssessment = await evaluateSafetyGate(patientId)

    // Gather all clinical data
    const [diagnoses, medications, labs, timeline, contradictions, missing, escalations, statements] =
      await Promise.all([
        supabaseAdmin.from('diagnoses').select('*').eq('patient_id', patientId),
        supabaseAdmin.from('medications').select('*, events:medication_events(*)').eq('patient_id', patientId),
        supabaseAdmin.from('laboratory_results').select('*').eq('patient_id', patientId),
        supabaseAdmin.from('clinical_events').select('*').eq('patient_id', patientId).order('event_date'),
        supabaseAdmin.from('contradictions').select('*').eq('patient_id', patientId).eq('status', 'open'),
        supabaseAdmin.from('missing_information').select('*').eq('patient_id', patientId).eq('status', 'open'),
        supabaseAdmin.from('escalations').select('*').eq('patient_id', patientId).eq('status', 'open'),
        supabaseAdmin.from('clinical_statements').select('evidence_status').eq('patient_id', patientId),
      ])

    const total = statements.data?.length ?? 0
    const evidenceSummary = {
      total_statements: total,
      verified: statements.data?.filter(s => s.evidence_status === 'verified').length ?? 0,
      supported: statements.data?.filter(s => s.evidence_status === 'supported').length ?? 0,
      uncertain: statements.data?.filter(s => s.evidence_status === 'uncertain').length ?? 0,
      conflicting: statements.data?.filter(s => s.evidence_status === 'conflicting').length ?? 0,
      missing: statements.data?.filter(s => s.evidence_status === 'missing_evidence').length ?? 0,
      superseded: statements.data?.filter(s => s.evidence_status === 'superseded').length ?? 0,
      evidence_completeness_score: safetyAssessment.evidence_completeness,
    }

    // Build summary note — only if safety gate allows
    let summaryText = ''
    if (safetyAssessment.can_generate_summary) {
      const diagCount = diagnoses.data?.length ?? 0
      const medCount = medications.data?.length ?? 0
      const conflictCount = contradictions.data?.length ?? 0
      summaryText = `Patient: ${patient.first_name} ${patient.last_name}\n\n` +
        `This handover report was generated based on ${total} extracted clinical statements from uploaded documents.\n\n` +
        `Documented diagnoses: ${diagCount}. Active/reconciled medications: ${medCount}.\n` +
        `Open contradictions requiring review: ${conflictCount}.\n\n` +
        (safetyAssessment.gate_state === 'YELLOW'
          ? `⚠ QUALIFIED SUMMARY: This report contains uncertain or incomplete information as noted below.`
          : `✓ Evidence is sufficiently consistent for this qualified summary.`) +
        `\n\nAll clinical decisions must be verified by a qualified clinician against original source documents.`
    } else {
      summaryText = `❌ SUMMARY BLOCKED — Safety Gate: RED\n\n${safetyAssessment.gate_reason}\n\n` +
        `The following conclusions have been blocked:\n` +
        safetyAssessment.blocked_conclusions.map(c => `• ${c}`).join('\n') +
        `\n\nHuman clinical review is required before this report can be used.`
    }

    // Build Unresolved Issues Passport
    const unresolvedPassport = [
      ...(contradictions.data ?? []).map(c => ({
        issue_id: c.id,
        description: c.description,
        related_information: `${c.category} contradiction (${c.severity})`,
        supporting_documents: [c.document_a_id, c.document_b_id].filter(Boolean),
        reason_unresolved: `Conflicting statements require clinician review`,
        potentially_affected_records: ['Clinical summary', 'Medication reconciliation', 'Discharge plan'],
        recommended_verification_action: `Review original source documents and determine which statement is current and correct`,
        escalation_status: 'open',
      })),
      ...(missing.data ?? []).filter(m => m.is_critical).map(m => ({
        issue_id: m.id,
        description: m.description,
        related_information: m.missing_type.replace(/_/g, ' '),
        supporting_documents: m.referenced_in_document_id ? [m.referenced_in_document_id] : [],
        reason_unresolved: `Referenced but documentation not available`,
        potentially_affected_records: ['Clinical timeline', 'Treatment decisions'],
        recommended_verification_action: m.clinician_question ?? `Locate and review missing documentation`,
        escalation_status: 'open',
      })),
    ]

    const reportData = {
      patient,
      summary: summaryText,
      diagnoses: diagnoses.data ?? [],
      medications: medications.data ?? [],
      lab_results: labs.data ?? [],
      timeline: timeline.data ?? [],
      contradictions: contradictions.data ?? [],
      missing_information: missing.data ?? [],
      escalations: escalations.data ?? [],
      evidence_summary: evidenceSummary,
      safety_assessment: safetyAssessment,
    }

    // Get version number
    const { count: existingReports } = await supabaseAdmin
      .from('handover_reports')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', patientId)

    const { data: report, error } = await supabaseAdmin
      .from('handover_reports')
      .insert({
        patient_id: patientId,
        generated_by: user.id,
        safety_gate_state: safetyAssessment.gate_state,
        report_data: reportData,
        unresolved_passport: unresolvedPassport,
        version: (existingReports ?? 0) + 1,
        is_draft: safetyAssessment.gate_state !== 'GREEN',
      })
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)

    await logAudit({
      userId: user.id,
      organizationId: user.organization_id,
      patientId,
      action: 'handover_report_generated',
      resourceType: 'handover_report',
      resourceId: report.id,
    })

    return successResponse({ data: report }, 201)
  }

  // GET /patients/:id/reports
  if (event.httpMethod === 'GET' && pathParts.includes('patients')) {
    const patientIdx = pathParts.indexOf('patients')
    const patientId = pathParts[patientIdx + 1]

    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('organization_id', user.organization_id)
      .single()

    if (!patient) return notFoundResponse('Patient')

    const { data, error } = await supabaseAdmin
      .from('handover_reports')
      .select('id, patient_id, safety_gate_state, version, is_draft, created_at, unresolved_passport, generated_by')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })

    if (error) return errorResponse(error.message, 500)
    return successResponse({ data: data ?? [] })
  }

  // GET /reports/:id — full report
  if (event.httpMethod === 'GET' && pathParts.includes('reports')) {
    const reportIdx = pathParts.indexOf('reports')
    const reportId = pathParts[reportIdx + 1]
    if (!reportId || reportId === 'download') return errorResponse('Report ID required', 400)

    const { data: report } = await supabaseAdmin
      .from('handover_reports')
      .select('*, patients!inner(organization_id)')
      .eq('id', reportId)
      .single()

    if (!report) return notFoundResponse('Report')

    const repWithPatient = report as typeof report & { patients: { organization_id: string } }
    if (repWithPatient.patients?.organization_id !== user.organization_id) return notFoundResponse('Report')

    return successResponse({ data: report })
  }

  // GET /reports/:id/download — PDF
  if (event.httpMethod === 'GET' && path.includes('/download')) {
    const reportIdMatch = path.match(/\/reports\/([^/]+)\/download/)
    const reportId = reportIdMatch?.[1]
    if (!reportId) return errorResponse('Report ID required', 400)

    const { data: report } = await supabaseAdmin
      .from('handover_reports')
      .select('*, patients!inner(organization_id, first_name, last_name)')
      .eq('id', reportId)
      .single()

    if (!report) return notFoundResponse('Report')

    const repWithPatient = report as typeof report & { patients: { organization_id: string; first_name: string; last_name: string } }
    if (repWithPatient.patients?.organization_id !== user.organization_id) return notFoundResponse('Report')

    // Generate simple text-based PDF representation
    // In production: use puppeteer or a PDF service
    const textContent = generateTextReport(report)

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="handover-report-${reportId.slice(0, 8)}.txt"`,
        'Access-Control-Allow-Origin': '*',
      },
      body: textContent,
    }
  }

  return errorResponse('Not found', 404)
}

function generateTextReport(report: Record<string, unknown>): string {
  const data = report.report_data as Record<string, unknown> ?? {}
  const patient = data.patient as Record<string, string> ?? {}
  const passport = (report.unresolved_passport as unknown[]) ?? []

  return `TRUST-MED AI — PATIENT HANDOVER REPORT
${'='.repeat(60)}
Generated: ${new Date().toISOString()}
Safety Gate: ${report.safety_gate_state}
Version: ${report.version}

PATIENT
${'-'.repeat(40)}
Name: ${patient.first_name} ${patient.last_name}
DOB: ${patient.date_of_birth ?? 'Unknown'}
MRN: ${patient.mrn ?? 'Not recorded'}

CLINICAL SUMMARY
${'-'.repeat(40)}
${(data.summary as string) ?? 'No summary generated'}

UNRESOLVED ISSUES PASSPORT
${'-'.repeat(40)}
${passport.length === 0 ? 'No unresolved issues' : passport.map((issue: unknown, i: number) => {
  const iss = issue as Record<string, string>
  return `${i + 1}. ${iss.description}\n   Related: ${iss.related_information}\n   Action: ${iss.recommended_verification_action}\n   Status: ${iss.escalation_status}`
}).join('\n\n')}

${'='.repeat(60)}
DISCLAIMER: This report is generated from extracted clinical documentation.
All information must be verified against original source documents.
Not for direct patient care without qualified clinician review.
TRUST-MED AI is a clinical information reconciliation prototype only.
`
}
