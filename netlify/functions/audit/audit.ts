import { Handler } from '@netlify/functions'
import { supabaseAdmin } from '../lib/supabase-admin'
import {
  authenticate, successResponse, errorResponse,
  unauthorizedResponse, optionsResponse, forbiddenResponse,
} from '../lib/middleware'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse()
  if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405)

  const user = await authenticate(event)
  if (!user) return unauthorizedResponse()

  if (user.role !== 'administrator' && user.role !== 'medical_records_reviewer') {
    return forbiddenResponse()
  }

  const params = event.queryStringParameters ?? {}
  const page = parseInt(params.page ?? '1')
  const limit = Math.min(parseInt(params.limit ?? '50'), 200)
  const offset = (page - 1) * limit

  let query = supabaseAdmin
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .eq('organization_id', user.organization_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (params.patient_id) {
    query = query.eq('patient_id', params.patient_id)
  }
  if (params.action) {
    query = query.ilike('action', `%${params.action}%`)
  }

  const { data, error, count } = await query
  if (error) return errorResponse(error.message, 500)

  return successResponse({
    data: data ?? [],
    total: count ?? 0,
    page,
    limit,
    has_more: (count ?? 0) > offset + limit,
  })
}
