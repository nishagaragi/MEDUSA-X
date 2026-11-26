/**
 * TRUST-MED AI — API Gateway
 * Routes /api/v1/* to the appropriate handler module.
 * This is a single Netlify function that acts as a router.
 */
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'

// Import all handlers
import { handler as registerHandler } from './auth/register'
import { handler as meHandler } from './auth/me'
import { handler as patientsHandler } from './patients/patients'
import { handler as documentsHandler } from './documents/documents'
import { handler as analysisHandler } from './analysis/analysis'
import { handler as contradictionReviewHandler } from './analysis/contradiction-review'
import { handler as reportsHandler } from './reports/reports'
import { handler as auditHandler } from './audit/audit'
import { handler as dashboardHandler } from './dashboard/dashboard'
import { optionsResponse, errorResponse } from './lib/middleware'

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Strip /api/v1 prefix added by netlify.toml rewrite
  const path = event.path.replace(/^\/.netlify\/functions\/api/, '/api/v1')
  const normalizedEvent = { ...event, path }

  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse()
  }

  // ---- Auth routes ----
  if (path === '/api/v1/auth/register' || path.endsWith('/auth/register')) {
    return registerHandler(normalizedEvent, context)
  }
  if (path === '/api/v1/auth/me' || path.endsWith('/auth/me')) {
    return meHandler(normalizedEvent, context)
  }

  // ---- Dashboard ----
  if (path === '/api/v1/dashboard' || path.endsWith('/dashboard')) {
    return dashboardHandler(normalizedEvent, context)
  }

  // ---- Patients ----
  if (path.match(/\/api\/v1\/patients(\/|$)/) && !path.includes('/documents') &&
      !path.includes('/analyze') && !path.includes('/timeline') &&
      !path.includes('/diagnoses') && !path.includes('/medications') &&
      !path.includes('/laboratory-results') && !path.includes('/contradictions') &&
      !path.includes('/missing-information') && !path.includes('/uncertainty') &&
      !path.includes('/escalations') && !path.includes('/graph') &&
      !path.includes('/agents') && !path.includes('/reports')) {
    return patientsHandler(normalizedEvent, context)
  }

  // ---- Documents ----
  if (path.includes('/documents') || (path.includes('/patients/') && path.endsWith('/documents'))) {
    return documentsHandler(normalizedEvent, context)
  }

  // ---- Contradiction review ----
  if (path.includes('/contradictions/') && path.includes('/review')) {
    return contradictionReviewHandler(normalizedEvent, context)
  }

  // ---- Reports ----
  if (path.includes('/reports')) {
    return reportsHandler(normalizedEvent, context)
  }

  // ---- Analysis & clinical data ----
  if (path.includes('/patients/') && (
    path.endsWith('/analyze') || path.endsWith('/analysis') ||
    path.endsWith('/timeline') || path.endsWith('/diagnoses') ||
    path.endsWith('/medications') || path.endsWith('/laboratory-results') ||
    path.endsWith('/contradictions') || path.endsWith('/missing-information') ||
    path.endsWith('/uncertainty') || path.endsWith('/escalations') ||
    path.endsWith('/graph') || path.endsWith('/status') ||
    path.endsWith('/run') || path.includes('/agents/') ||
    path.endsWith('/evidence')
  )) {
    return analysisHandler(normalizedEvent, context)
  }

  // ---- Audit ----
  if (path.includes('/audit')) {
    return auditHandler(normalizedEvent, context)
  }

  return errorResponse('API endpoint not found', 404, 'NOT_FOUND')
}
