import { Handler } from '@netlify/functions'
import { supabaseAdmin } from '../lib/supabase-admin'
import {
  authenticate, successResponse, errorResponse,
  unauthorizedResponse, optionsResponse, logAudit,
  notFoundResponse,
} from '../lib/middleware'

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse()

  const user = await authenticate(event)
  if (!user) return unauthorizedResponse()

  const path = event.path
  const pathParts = path.split('/').filter(Boolean)

  // POST /patients/:patientId/documents — upload
  if (event.httpMethod === 'POST' && pathParts.includes('patients')) {
    const patientIdx = pathParts.indexOf('patients')
    const patientId = pathParts[patientIdx + 1]

    // Verify patient belongs to org
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('organization_id', user.organization_id)
      .single()

    if (!patient) return notFoundResponse('Patient')

    // Parse multipart body
    // Netlify Functions receive base64-encoded binary
    if (!event.body) return errorResponse('No file provided', 400)

    const contentType = event.headers['content-type'] ?? ''
    if (!contentType.includes('multipart/form-data')) {
      return errorResponse('Request must be multipart/form-data', 400)
    }

    // Parse multipart manually
    const boundary = contentType.split('boundary=')[1]
    if (!boundary) return errorResponse('Invalid multipart boundary', 400)

    const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf-8')
    const parts = parseMultipart(bodyBuffer, boundary)
    const filePart = parts.find(p => p.name === 'file')

    if (!filePart) return errorResponse('No file field in form data', 400)

    const mimeType = filePart.contentType ?? 'application/octet-stream'
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return errorResponse(`File type not allowed: ${mimeType}`, 400)
    }

    if (filePart.data.length > MAX_FILE_SIZE) {
      return errorResponse('File too large. Maximum 50MB allowed.', 400)
    }

    // Store in Supabase Storage
    const fileName = filePart.filename ?? 'document'
    const storagePath = `${user.organization_id}/${patientId}/${Date.now()}-${sanitizeFilename(fileName)}`

    const { error: storageError } = await supabaseAdmin.storage
      .from('medical-documents')
      .upload(storagePath, filePart.data, {
        contentType: mimeType,
        upsert: false,
      })

    if (storageError) {
      return errorResponse(`Storage upload failed: ${storageError.message}`, 500)
    }

    // Create document record
    const { data: doc, error: docError } = await supabaseAdmin
      .from('documents')
      .insert({
        patient_id: patientId,
        organization_id: user.organization_id,
        original_filename: fileName,
        storage_path: storagePath,
        mime_type: mimeType,
        file_size_bytes: filePart.data.length,
        status: 'uploaded',
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (docError) return errorResponse(docError.message, 500)

    await logAudit({
      userId: user.id,
      organizationId: user.organization_id,
      patientId,
      action: 'document_uploaded',
      resourceType: 'document',
      resourceId: doc.id,
      newValues: { filename: fileName, mime_type: mimeType },
    })

    return successResponse({ data: doc }, 201)
  }

  // GET /patients/:patientId/documents
  if (event.httpMethod === 'GET' && pathParts.includes('patients') && pathParts.includes('documents')) {
    const patientIdx = pathParts.indexOf('patients')
    const patientId = pathParts[patientIdx + 1]

    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('organization_id', user.organization_id)
      .single()

    if (!patient) return notFoundResponse('Patient')

    const { data, error, count } = await supabaseAdmin
      .from('documents')
      .select('*', { count: 'exact' })
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })

    if (error) return errorResponse(error.message, 500)

    return successResponse({
      data: data ?? [],
      total: count ?? 0,
      page: 1,
      limit: 100,
      has_more: false,
    })
  }

  // GET /documents/:id
  if (event.httpMethod === 'GET' && pathParts.includes('documents')) {
    const docIdx = pathParts.indexOf('documents')
    const docId = pathParts[docIdx + 1]

    if (!docId || docId === 'status') return errorResponse('Document ID required', 400)

    const { data: doc } = await supabaseAdmin
      .from('documents')
      .select('*, patients!inner(organization_id)')
      .eq('id', docId)
      .single()

    if (!doc) return notFoundResponse('Document')

    // Type-safe access
    const docWithPatient = doc as typeof doc & { patients: { organization_id: string } }
    if (docWithPatient.patients?.organization_id !== user.organization_id) return notFoundResponse('Document')

    return successResponse({ data: doc })
  }

  // POST /documents/:id/process
  if (event.httpMethod === 'POST' && path.includes('/process')) {
    const docIdMatch = path.match(/\/documents\/([^/]+)\/process/)
    const docId = docIdMatch?.[1]
    if (!docId) return errorResponse('Document ID required', 400)

    const { data: doc } = await supabaseAdmin
      .from('documents')
      .select('id, status, patient_id, mime_type, storage_path')
      .eq('id', docId)
      .single()

    if (!doc) return notFoundResponse('Document')

    // Update status to trigger extraction
    await supabaseAdmin
      .from('documents')
      .update({ status: 'extracting' })
      .eq('id', docId)

    // Note: Actual extraction would be a background job
    // For now, start the extraction inline (limited by serverless timeout)
    // For production: use Supabase Edge Functions or queue system

    return successResponse({ data: { job_id: docId, status: 'extracting' } })
  }

  // GET /documents/:id/status
  if (event.httpMethod === 'GET' && path.includes('/status')) {
    const docIdMatch = path.match(/\/documents\/([^/]+)\/status/)
    const docId = docIdMatch?.[1]
    if (!docId) return errorResponse('Document ID required', 400)

    const { data: doc } = await supabaseAdmin
      .from('documents')
      .select('id, status, extraction_error')
      .eq('id', docId)
      .single()

    if (!doc) return notFoundResponse('Document')
    return successResponse({ data: { status: doc.status, error: doc.extraction_error } })
  }

  // DELETE /documents/:id
  if (event.httpMethod === 'DELETE') {
    const docIdx = pathParts.indexOf('documents')
    const docId = docIdx >= 0 ? pathParts[docIdx + 1] : null

    if (!docId) return errorResponse('Document ID required', 400)

    const { data: doc } = await supabaseAdmin
      .from('documents')
      .select('storage_path, patient_id, patients!inner(organization_id)')
      .eq('id', docId)
      .single()

    if (!doc) return notFoundResponse('Document')

    const docWithPatient = doc as typeof doc & { patients: { organization_id: string } }
    if (docWithPatient.patients?.organization_id !== user.organization_id) return notFoundResponse('Document')

    // Delete from storage
    await supabaseAdmin.storage.from('medical-documents').remove([doc.storage_path])

    // Delete record (cascades to extractions)
    await supabaseAdmin.from('documents').delete().eq('id', docId)

    await logAudit({
      userId: user.id,
      action: 'document_deleted',
      resourceType: 'document',
      resourceId: docId,
    })

    return { statusCode: 204, body: '' }
  }

  return errorResponse('Not found', 404)
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
}

interface MultipartPart {
  name?: string
  filename?: string
  contentType?: string
  data: Buffer
}

function parseMultipart(body: Buffer, boundary: string): MultipartPart[] {
  const parts: MultipartPart[] = []
  const delimiter = Buffer.from(`--${boundary}`)
  const finalDelimiter = Buffer.from(`--${boundary}--`)

  let start = 0
  while (start < body.length) {
    const delimStart = body.indexOf(delimiter, start)
    if (delimStart === -1) break

    if (body.slice(delimStart, delimStart + finalDelimiter.length).equals(finalDelimiter)) break

    const headerStart = delimStart + delimiter.length + 2
    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), headerStart)
    if (headerEnd === -1) break

    const headerText = body.slice(headerStart, headerEnd).toString()
    const contentEnd = body.indexOf(delimiter, headerEnd + 4)
    const dataEnd = contentEnd === -1 ? body.length : contentEnd - 2

    const data = body.slice(headerEnd + 4, dataEnd)

    const nameMatch = headerText.match(/name="([^"]+)"/)
    const filenameMatch = headerText.match(/filename="([^"]+)"/)
    const ctMatch = headerText.match(/Content-Type: (.+)/i)

    parts.push({
      name: nameMatch?.[1],
      filename: filenameMatch?.[1],
      contentType: ctMatch?.[1]?.trim(),
      data,
    })

    start = delimStart + delimiter.length
  }

  return parts
}
