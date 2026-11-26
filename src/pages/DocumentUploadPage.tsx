import { useState, useCallback } from 'react'
import { useDropzone, FileRejection } from 'react-dropzone'
import { useSearchParams } from 'react-router-dom'
import {
  Upload, FileText, FileImage, AlertTriangle,
  CheckCircle2, X, RefreshCw, Trash2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePatients } from '@/hooks/usePatients'
import { useDocuments, useUploadDocument, useDeleteDocument, useProcessDocument } from '@/hooks/useDocuments'
import { Document, DocumentStatus } from '@/types'
import { formatFileSize, formatDateTime, cn } from '@/lib/utils'

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

interface UploadFile {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
  progress: number
}

function statusConfig(status: DocumentStatus) {
  const configs: Record<DocumentStatus, { label: string; color: string; bg: string }> = {
    uploaded: { label: 'Uploaded', color: 'text-blue-700', bg: 'bg-blue-50' },
    validated: { label: 'Validated', color: 'text-blue-700', bg: 'bg-blue-50' },
    extracting: { label: 'Extracting', color: 'text-amber-700', bg: 'bg-amber-50' },
    extracted: { label: 'Extracted', color: 'text-teal-700', bg: 'bg-teal-50' },
    classifying: { label: 'Classifying', color: 'text-purple-700', bg: 'bg-purple-50' },
    classified: { label: 'Classified', color: 'text-purple-700', bg: 'bg-purple-50' },
    analyzing: { label: 'Analyzing', color: 'text-orange-700', bg: 'bg-orange-50' },
    analyzed: { label: 'Analyzed', color: 'text-green-700', bg: 'bg-green-50' },
    failed: { label: 'Failed', color: 'text-red-700', bg: 'bg-red-50' },
  }
  return configs[status] ?? configs.uploaded
}

function DocumentRow({ doc, patientId }: { doc: Document; patientId: string }) {
  const { mutate: deleteDoc, isPending: deleting } = useDeleteDocument(patientId)
  const { mutate: processDoc, isPending: processing } = useProcessDocument()
  const cfg = statusConfig(doc.status)

  return (
    <div className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50">
      <div className="flex-shrink-0">
        {doc.mime_type.startsWith('image/') ? (
          <FileImage className="w-8 h-8 text-purple-500" />
        ) : (
          <FileText className="w-8 h-8 text-blue-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-navy-900 truncate">{doc.original_filename}</div>
        <div className="text-xs text-gray-400 mt-0.5">
          {formatFileSize(doc.file_size_bytes)} · {doc.document_type.replace(/_/g, ' ')} ·{' '}
          {doc.page_count ? `${doc.page_count} pages · ` : ''}
          Uploaded {formatDateTime(doc.created_at)}
        </div>
        {doc.extraction_error && (
          <p className="text-xs text-red-600 mt-1 truncate">{doc.extraction_error}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
          {(doc.status === 'extracting' || doc.status === 'analyzing') && (
            <span className="ml-1 inline-block w-2 h-2 rounded-full bg-current animate-pulse" />
          )}
        </span>
        {doc.status === 'failed' && (
          <Button
            variant="ghost"
            size="sm"
            loading={processing}
            onClick={() => processDoc({ documentId: doc.id, patientId })}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        )}
        {doc.status === 'uploaded' && (
          <Button
            variant="outline"
            size="sm"
            loading={processing}
            onClick={() => processDoc({ documentId: doc.id, patientId })}
          >
            Process
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          loading={deleting}
          onClick={() => {
            if (confirm('Delete this document? This cannot be undone.')) {
              deleteDoc(doc.id)
            }
          }}
          className="text-red-400 hover:text-red-600"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

export default function DocumentUploadPage() {
  const [params] = useSearchParams()
  const preselectedPatient = params.get('patient')

  const { data: patientsData } = usePatients(1, 100)
  const [selectedPatient, setSelectedPatient] = useState(preselectedPatient ?? '')
  const { data: docsData, isLoading } = useDocuments(selectedPatient || undefined)
  const { mutate: uploadDoc } = useUploadDocument(selectedPatient)
  const [uploadQueue, setUploadQueue] = useState<UploadFile[]>([])

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    if (!selectedPatient) {
      alert('Please select a patient first')
      return
    }

    const newFiles: UploadFile[] = accepted.map(file => ({
      file,
      id: crypto.randomUUID(),
      status: 'pending',
      progress: 0,
    }))

    // Warn about duplicates from rejected
    if (rejected.length > 0) {
      console.warn('Rejected files:', rejected.map(r => `${r.file.name}: ${r.errors.map(e => e.message).join(', ')}`))
    }

    setUploadQueue(prev => [...prev, ...newFiles])

    // Upload each file
    newFiles.forEach(qf => {
      setUploadQueue(prev => prev.map(f => f.id === qf.id ? { ...f, status: 'uploading' } : f))
      const formData = new FormData()
      formData.append('file', qf.file)
      uploadDoc(formData, {
        onSuccess: () => {
          setUploadQueue(prev => prev.map(f => f.id === qf.id ? { ...f, status: 'done', progress: 100 } : f))
        },
        onError: (err) => {
          setUploadQueue(prev => prev.map(f => f.id === qf.id ? {
            ...f,
            status: 'error',
            error: err instanceof Error ? err.message : 'Upload failed',
          } : f))
        },
      })
    })
  }, [selectedPatient, uploadDoc])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
  })

  const removeFromQueue = (id: string) => {
    setUploadQueue(prev => prev.filter(f => f.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Document Upload Center</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Upload PDF, DOCX, or TXT files. Text is extracted immediately from your files and used for real clinical analysis. After uploading, click "Run Analysis" on the patient page to generate findings.
        </p>
      </div>

      {/* Patient selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Patient</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-800"
            value={selectedPatient}
            onChange={e => setSelectedPatient(e.target.value)}
          >
            <option value="">— Select a patient —</option>
            {patientsData?.data?.map(p => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name}{p.mrn ? ` (${p.mrn})` : ''}{p.is_demo ? ' [DEMO]' : ''}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Drop zone */}
      <Card>
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors",
              isDragActive
                ? "border-navy-500 bg-navy-50"
                : "border-gray-300 hover:border-navy-400 hover:bg-gray-50",
              !selectedPatient && "opacity-50 cursor-not-allowed"
            )}
          >
            <input {...getInputProps()} disabled={!selectedPatient} />
            <Upload className={cn(
              "w-10 h-10 mx-auto mb-4",
              isDragActive ? "text-navy-600" : "text-gray-400"
            )} />
            {isDragActive ? (
              <p className="text-navy-700 font-medium">Drop files here...</p>
            ) : (
              <>
                <p className="text-gray-700 font-medium">Drag & drop files, or click to browse</p>
                <p className="text-gray-400 text-sm mt-1">PDF, DOCX, TXT, PNG, JPG/JPEG · Max 50MB per file</p>
                {!selectedPatient && (
                  <p className="text-amber-600 text-sm mt-2 font-medium">Select a patient first</p>
                )}
              </>
            )}
          </div>

          {/* Upload status workflow */}
          {selectedPatient && (
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-400 flex-wrap">
              {['Uploaded', 'Validated', 'Extracted', 'Classified', 'Analyzed', 'Verified'].map((step, idx, arr) => (
                <span key={step} className="flex items-center gap-2">
                  <span>{step}</span>
                  {idx < arr.length - 1 && <span>→</span>}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload queue */}
      {uploadQueue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Queue</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {uploadQueue.map(qf => (
              <div key={qf.id} className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-0">
                <FileText className="w-6 h-6 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-navy-900 truncate">{qf.file.name}</div>
                  <div className="text-xs text-gray-400">{formatFileSize(qf.file.size)}</div>
                  {qf.error && <p className="text-xs text-red-600">{qf.error}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {qf.status === 'uploading' && (
                    <div className="animate-spin w-4 h-4 border-2 border-navy-700 border-t-transparent rounded-full" />
                  )}
                  {qf.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                  {qf.status === 'error' && <AlertTriangle className="w-4 h-4 text-red-600" />}
                  <Badge variant={
                    qf.status === 'done' ? 'success' :
                    qf.status === 'error' ? 'destructive' :
                    qf.status === 'uploading' ? 'info' : 'secondary'
                  }>
                    {qf.status}
                  </Badge>
                  <button
                    onClick={() => removeFromQueue(qf.id)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Existing documents */}
      {selectedPatient && (
        <Card>
          <CardHeader>
            <CardTitle>
              Uploaded Documents {docsData?.total !== undefined && `(${docsData.total})`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading && (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-navy-800 border-t-transparent rounded-full" />
              </div>
            )}
            {!isLoading && (!docsData?.data?.length) && (
              <div className="py-12 text-center text-gray-400 text-sm">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No documents uploaded yet
              </div>
            )}
            {docsData?.data?.map(doc => (
              <DocumentRow key={doc.id} doc={doc} patientId={selectedPatient} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
