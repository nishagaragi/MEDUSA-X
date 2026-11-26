import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { documentStore } from '@/lib/store'
import { extractTextFromFile } from '@/lib/pdfExtractor'
import { Document, PaginatedResponse } from '@/types'

export function useDocuments(patientId: string | undefined) {
  return useQuery<PaginatedResponse<Document>>({
    queryKey: ['documents', patientId],
    queryFn: () => {
      const docs = documentStore.getByPatient(patientId!)
      return { data: docs, total: docs.length, page: 1, limit: 100, has_more: false }
    },
    enabled: !!patientId,
  })
}

export function useDocument(id: string | undefined) {
  return useQuery<{ data: Document }>({
    queryKey: ['document', id],
    queryFn: () => {
      const doc = documentStore.getById(id!)
      if (!doc) throw new Error('Document not found')
      return { data: doc }
    },
    enabled: !!id,
  })
}

export function useUploadDocument(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const file = formData.get('file') as File | null
      if (!file) throw new Error('No file provided')

      // Validate file type
      const allowed = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/png',
        'image/jpeg',
      ]
      if (!allowed.includes(file.type)) {
        throw new Error(`File type not supported: ${file.type}`)
      }
      if (file.size > 50 * 1024 * 1024) {
        throw new Error('File too large. Maximum 50MB.')
      }

      // ---- REAL TEXT EXTRACTION ----
      // Extract text from the actual file bytes before storing
      const extractionResult = await extractTextFromFile(file)

      // Store document with extracted text
      const doc = documentStore.create(patientId, {
        original_filename: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
      }, extractionResult)

      return { data: doc }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', patientId] })
    },
  })
}

export function useProcessDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ documentId, patientId }: { documentId: string; patientId: string }) => {
      documentStore.updateStatus(documentId, patientId, 'analyzing')
      // For already-uploaded docs without extraction, mark as analyzed
      // (re-extraction would require the original file, which we don't have stored)
      setTimeout(() => {
        documentStore.updateStatus(documentId, patientId, 'analyzed')
        qc.invalidateQueries({ queryKey: ['documents', patientId] })
      }, 1000)
      return Promise.resolve({ data: { job_id: documentId, status: 'analyzing' } })
    },
    onSuccess: (_data, { patientId }) => {
      qc.invalidateQueries({ queryKey: ['documents', patientId] })
    },
  })
}

export function useDeleteDocument(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (documentId: string) => {
      documentStore.delete(documentId, patientId)
      return Promise.resolve({ success: true })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', patientId] })
    },
  })
}

export function useDocumentStatus(documentId: string | undefined) {
  return useQuery<{ data: { status: string } }>({
    queryKey: ['document-status', documentId],
    queryFn: () => {
      const doc = documentStore.getById(documentId!)
      return { data: { status: doc?.status ?? 'unknown' } }
    },
    enabled: !!documentId,
  })
}
