import { HandlerEvent, HandlerContext } from '@netlify/functions'
import { supabaseAdmin } from './supabase-admin'

export interface AuthenticatedUser {
  id: string
  auth_id: string
  email: string
  full_name: string
  role: string
  organization_id: string
}

export async function authenticate(event: HandlerEvent): Promise<AuthenticatedUser | null> {
  const authHeader = event.headers.authorization ?? event.headers.Authorization
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id, auth_id, email, full_name, role, organization_id')
      .eq('auth_id', user.id)
      .single()

    return profile ?? null
  } catch {
    return null
  }
}

export function corsHeaders(allowedOrigins?: string) {
  const origins = allowedOrigins ?? process.env.ALLOWED_ORIGINS ?? '*'
  return {
    'Access-Control-Allow-Origin': origins,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

export function successResponse(data: unknown, status = 200) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    body: JSON.stringify(typeof data === 'object' && data !== null && 'data' in data ? data : { data }),
  }
}

export function errorResponse(message: string, status = 400, code?: string) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    body: JSON.stringify({ error: message, code: code ?? 'ERROR' }),
  }
}

export function notFoundResponse(resource = 'Resource') {
  return errorResponse(`${resource} not found`, 404, 'NOT_FOUND')
}

export function unauthorizedResponse() {
  return errorResponse('Authentication required', 401, 'UNAUTHORIZED')
}

export function forbiddenResponse() {
  return errorResponse('Insufficient permissions', 403, 'FORBIDDEN')
}

export function methodNotAllowed() {
  return errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED')
}

export function optionsResponse() {
  return { statusCode: 200, headers: corsHeaders(), body: '' }
}

export async function logAudit(params: {
  userId?: string
  organizationId?: string
  patientId?: string
  action: string
  resourceType?: string
  resourceId?: string
  oldValues?: unknown
  newValues?: unknown
  success?: boolean
  errorMessage?: string
  ipAddress?: string
}) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: params.userId,
      organization_id: params.organizationId,
      patient_id: params.patientId,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId,
      old_values: params.oldValues,
      new_values: params.newValues,
      success: params.success ?? true,
      error_message: params.errorMessage,
      ip_address: params.ipAddress,
    })
  } catch {
    // Audit failures must not break the main operation
  }
}
