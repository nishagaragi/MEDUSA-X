import { Handler } from '@netlify/functions'
import { z } from 'zod'
import { supabaseAdmin } from '../lib/supabase-admin'
import {
  authenticate, successResponse, errorResponse,
  unauthorizedResponse, optionsResponse, logAudit, notFoundResponse,
} from '../lib/middleware'

const ReviewSchema = z.object({
  status: z.enum(['confirmed_discrepancy', 'resolved_with_evidence', 'requires_more_documentation', 'escalated']),
  resolution_note: z.string().optional(),
})

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse()

  const user = await authenticate(event)
  if (!user) return unauthorizedResponse()

  const path = event.path
  const idMatch = path.match(/\/contradictions\/([^/]+)\/review/)
  const contradictionId = idMatch?.[1]

  if (!contradictionId) return errorResponse('Contradiction ID required', 400)
  if (event.httpMethod !== 'PATCH') return errorResponse('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body ?? '{}') } catch { return errorResponse('Invalid JSON', 400) }

  const parsed = ReviewSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 400)

  // Verify access via organization
  const { data: existing } = await supabaseAdmin
    .from('contradictions')
    .select('*, patients!inner(organization_id)')
    .eq('id', contradictionId)
    .single()

  if (!existing) return notFoundResponse('Contradiction')

  const contWithPatient = existing as typeof existing & { patients: { organization_id: string } }
  if (contWithPatient.patients?.organization_id !== user.organization_id) {
    return notFoundResponse('Contradiction')
  }

  const { data, error } = await supabaseAdmin
    .from('contradictions')
    .update({
      status: parsed.data.status,
      resolution_note: parsed.data.resolution_note,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', contradictionId)
    .select()
    .single()

  if (error) return errorResponse(error.message, 500)

  await logAudit({
    userId: user.id,
    organizationId: user.organization_id,
    patientId: existing.patient_id,
    action: 'contradiction_reviewed',
    resourceType: 'contradiction',
    resourceId: contradictionId,
    oldValues: { status: existing.status },
    newValues: { status: parsed.data.status, note: parsed.data.resolution_note },
  })

  return successResponse({ data })
}
