import { Handler } from '@netlify/functions'
import { supabaseAdmin } from '../lib/supabase-admin'
import {
  authenticate, successResponse, errorResponse,
  unauthorizedResponse, optionsResponse,
} from '../lib/middleware'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse()
  if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405)

  const user = await authenticate(event)
  if (!user) return unauthorizedResponse()

  const orgId = user.organization_id

  const [
    patients,
    documents,
    verifiedStatements,
    contradictions,
    missingFindings,
    escalations,
    recentAnalyses,
    agentActivity,
  ] = await Promise.all([
    supabaseAdmin.from('patients').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabaseAdmin.from('documents').select('*', { count: 'exact', head: true })
      .in('patient_id', await getPatientIds(orgId)),
    supabaseAdmin.from('clinical_statements').select('*', { count: 'exact', head: true })
      .in('patient_id', await getPatientIds(orgId))
      .eq('evidence_status', 'verified'),
    supabaseAdmin.from('contradictions').select('*', { count: 'exact', head: true })
      .in('patient_id', await getPatientIds(orgId))
      .eq('status', 'open'),
    supabaseAdmin.from('missing_information').select('*', { count: 'exact', head: true })
      .in('patient_id', await getPatientIds(orgId))
      .eq('status', 'open'),
    supabaseAdmin.from('escalations').select('*', { count: 'exact', head: true })
      .in('patient_id', await getPatientIds(orgId))
      .eq('status', 'open'),
    supabaseAdmin.from('analysis_sessions').select('*')
      .in('patient_id', await getPatientIds(orgId))
      .order('started_at', { ascending: false })
      .limit(10),
    supabaseAdmin.from('agent_runs').select('*')
      .in('patient_id', await getPatientIds(orgId))
      .order('created_at', { ascending: false })
      .limit(12),
  ])

  return successResponse({
    data: {
      total_patients: patients.count ?? 0,
      total_documents: documents.count ?? 0,
      verified_statements: verifiedStatements.count ?? 0,
      contradictions: contradictions.count ?? 0,
      missing_findings: missingFindings.count ?? 0,
      escalations: escalations.count ?? 0,
      recent_analyses: recentAnalyses.data ?? [],
      agent_activity: agentActivity.data ?? [],
    },
  })
}

async function getPatientIds(orgId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('patients')
    .select('id')
    .eq('organization_id', orgId)

  return data?.map(p => p.id) ?? []
}
