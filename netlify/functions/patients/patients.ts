import { Handler } from '@netlify/functions'
import { z } from 'zod'
import { supabaseAdmin } from '../lib/supabase-admin'
import {
  authenticate, successResponse, errorResponse,
  unauthorizedResponse, optionsResponse, logAudit,
  notFoundResponse,
} from '../lib/middleware'

const CreatePatientSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  mrn: z.string().optional(),
  blood_type: z.string().optional(),
  allergies: z.array(z.string()).default([]),
})

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse()

  const user = await authenticate(event)
  if (!user) return unauthorizedResponse()

  const path = event.path
  const pathParts = path.split('/')
  const patientId = pathParts[pathParts.length - 1]

  // GET /patients/:id
  if (event.httpMethod === 'GET' && patientId !== 'patients' && patientId.length > 10) {
    const { data, error } = await supabaseAdmin
      .from('patients')
      .select('*, documents:documents(count), analysis:analysis_sessions(count)')
      .eq('id', patientId)
      .eq('organization_id', user.organization_id)
      .single()

    if (error || !data) return notFoundResponse('Patient')
    return successResponse({ data })
  }

  // GET /patients
  if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters ?? {}
    const page = parseInt(params.page ?? '1')
    const limit = Math.min(parseInt(params.limit ?? '20'), 100)
    const offset = (page - 1) * limit
    const search = params.search

    let query = supabaseAdmin
      .from('patients')
      .select('id, mrn, first_name, last_name, date_of_birth, gender, blood_type, is_demo, created_at, allergies', { count: 'exact' })
      .eq('organization_id', user.organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,mrn.ilike.%${search}%`
      )
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

  // POST /patients
  if (event.httpMethod === 'POST') {
    let body
    try { body = JSON.parse(event.body ?? '{}') } catch { return errorResponse('Invalid JSON', 400) }

    const parsed = CreatePatientSchema.safeParse(body)
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 400)

    const { data, error } = await supabaseAdmin
      .from('patients')
      .insert({
        ...parsed.data,
        organization_id: user.organization_id,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)

    await logAudit({
      userId: user.id,
      organizationId: user.organization_id,
      patientId: data.id,
      action: 'patient_created',
      resourceType: 'patient',
      resourceId: data.id,
      newValues: parsed.data,
    })

    return successResponse({ data }, 201)
  }

  // PATCH /patients/:id
  if (event.httpMethod === 'PATCH' && patientId.length > 10) {
    let body
    try { body = JSON.parse(event.body ?? '{}') } catch { return errorResponse('Invalid JSON', 400) }

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('organization_id', user.organization_id)
      .single()

    if (!existing) return notFoundResponse('Patient')

    const { data, error } = await supabaseAdmin
      .from('patients')
      .update(body)
      .eq('id', patientId)
      .eq('organization_id', user.organization_id)
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)
    return successResponse({ data })
  }

  // DELETE /patients/:id
  if (event.httpMethod === 'DELETE' && patientId.length > 10) {
    if (user.role !== 'administrator') {
      return errorResponse('Only administrators can delete patients', 403)
    }

    const { error } = await supabaseAdmin
      .from('patients')
      .delete()
      .eq('id', patientId)
      .eq('organization_id', user.organization_id)

    if (error) return errorResponse(error.message, 500)

    await logAudit({
      userId: user.id,
      action: 'patient_deleted',
      resourceType: 'patient',
      resourceId: patientId,
    })

    return { statusCode: 204, body: '' }
  }

  return errorResponse('Method not allowed', 405)
}
