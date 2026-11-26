import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  User, FileText, Clock, Pill, FlaskConical,
  AlertTriangle, Ghost, Network, Radar, Bot,
  Upload, ChevronRight, Calendar, ArrowRight,
  Play,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EvidenceBadge } from '@/components/ui/badge'
import { usePatient } from '@/hooks/usePatients'
import { useAnalysis, useRunAnalysis, useContradictions, useMissingInformation } from '@/hooks/useAnalysis'
import { useDocuments } from '@/hooks/useDocuments'
import { formatDate, formatDateTime, safetyGateConfig, cn } from '@/lib/utils'
import { LoadingSpinner } from '@/components/ui/loading'

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: patientData, isLoading } = usePatient(id)
  const { data: analysisData } = useAnalysis(id)
  const { data: docsData } = useDocuments(id)
  const { data: contradictionsData } = useContradictions(id)
  const { data: missingData } = useMissingInformation(id)
  const { mutate: runAnalysis, isPending } = useRunAnalysis(id ?? '')

  if (isLoading) return <LoadingSpinner label="Loading patient..." />

  const patient = patientData?.data
  if (!patient) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Patient not found or you do not have access.</AlertDescription>
      </Alert>
    )
  }

  const analysis = analysisData?.data
  const gateState = analysis?.safety_gate_state ?? null
  const gateConfig = gateState ? safetyGateConfig[gateState as keyof typeof safetyGateConfig] : null
  const openContradictions = (contradictionsData?.data ?? []).filter(c => c.status === 'open').length
  const criticalMissing = (missingData?.data ?? []).filter(m => m.is_critical && m.status === 'open').length

  const quickLinks = [
    { label: 'Full Reconstruction', icon: FileText, path: `/patients/${id}/reconstruction` },
    { label: 'Medical Timeline', icon: Clock, path: `/timeline?patient=${id}` },
    { label: 'Contradictions', icon: AlertTriangle, path: `/contradictions?patient=${id}`, badge: openContradictions },
    { label: 'Medication Reconciliation', icon: Pill, path: `/medications?patient=${id}` },
    { label: 'Ghost Records', icon: Ghost, path: `/ghost-records?patient=${id}`, badge: criticalMissing },
    { label: 'Knowledge Graph', icon: Network, path: `/knowledge-graph?patient=${id}` },
    { label: 'Uncertainty Radar', icon: Radar, path: `/uncertainty?patient=${id}` },
    { label: 'Agent Control', icon: Bot, path: `/patients/${id}/agents` },
    { label: 'Handover Report', icon: FileText, path: `/handover?patient=${id}` },
    { label: 'Upload Documents', icon: Upload, path: `/upload?patient=${id}` },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-navy-100 flex items-center justify-center">
            <User className="w-8 h-8 text-navy-700" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-navy-900">
                {patient.first_name} {patient.last_name}
              </h1>
              {patient.is_demo && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                  SYNTHETIC DEMO
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap">
              {patient.mrn && <span>MRN: <strong>{patient.mrn}</strong></span>}
              {patient.date_of_birth && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(patient.date_of_birth)}
                </span>
              )}
              {patient.gender && <span>{patient.gender}</span>}
              {patient.blood_type && <span>Blood: {patient.blood_type}</span>}
            </div>
            {patient.allergies && patient.allergies.length > 0 && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <span className="text-xs text-red-600 font-medium">Allergies:</span>
                {patient.allergies.map(a => (
                  <span key={a} className="text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded">{a}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {gateConfig && gateState && (
            <div className={cn(
              'px-4 py-2 rounded-lg border-2 font-bold text-sm',
              gateConfig.border, gateConfig.bg, gateConfig.color
            )}>
              {gateState} — {gateConfig.label}
            </div>
          )}
          <Button
            onClick={() => runAnalysis()}
            loading={isPending || analysis?.status === 'running'}
            disabled={!id}
          >
            <Play className="w-4 h-4 mr-2" />
            {analysis ? 'Re-analyze' : 'Run Analysis'}
          </Button>
        </div>
      </div>

      {/* Stats row — only show when real data exists */}
      {analysis && analysis.total_statements > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Statements', value: analysis.total_statements, color: 'text-navy-900' },
            { label: 'Verified', value: analysis.verified_count, color: 'text-green-700' },
            { label: 'Uncertain', value: analysis.uncertain_count, color: 'text-amber-700' },
            { label: 'Conflicting', value: analysis.conflicting_count, color: 'text-red-700' },
            { label: 'Escalations', value: analysis.escalation_count, color: 'text-purple-700' },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="p-4 text-center">
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Warning if no analysis */}
      {!analysis && (
        <Alert variant="warning">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            No analysis has been run for this patient. Upload documents and click "Run Analysis" to activate the Clinical Detective Swarm.
          </AlertDescription>
        </Alert>
      )}

      {/* Warning when analysis ran but found no data (e.g. no documents uploaded) */}
      {analysis && analysis.total_statements === 0 && (
        <Alert variant="warning">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            {analysis.error_message ?? 'No clinical information found. Upload PDF or TXT medical records and click "Run Analysis" again.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Two-column: documents + quick links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Documents ({docsData?.total ?? 0})
              </span>
              <Link to={`/upload?patient=${id}`}>
                <Button variant="outline" size="sm">
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Upload
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!docsData?.data?.length ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                No documents uploaded yet
              </div>
            ) : (
              docsData.data.slice(0, 6).map(doc => (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-navy-900 truncate">{doc.original_filename}</p>
                    <p className="text-xs text-gray-400">{doc.document_type.replace(/_/g, ' ')}</p>
                  </div>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    doc.status === 'analyzed' ? 'bg-green-50 text-green-700' :
                    doc.status === 'failed' ? 'bg-red-50 text-red-700' :
                    'bg-blue-50 text-blue-700'
                  )}>
                    {doc.status}
                  </span>
                </div>
              ))
            )}
            {(docsData?.total ?? 0) > 6 && (
              <div className="px-4 py-2 text-xs text-gray-400 text-center">
                +{(docsData?.total ?? 0) - 6} more documents
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick links */}
        <Card>
          <CardHeader>
            <CardTitle>Clinical Modules</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {quickLinks.map(({ label, icon: Icon, path, badge }) => (
              <Link
                key={path}
                to={path}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
              >
                <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-sm text-navy-900">{label}</span>
                {badge !== undefined && badge > 0 && (
                  <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
                    {badge}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent analysis info */}
      {analysis && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm text-gray-500">
              Last analysis: <span className="font-medium text-navy-900">{formatDateTime(analysis.started_at)}</span>
              {analysis.completed_at && (
                <span className="ml-2">
                  · Completed in {Math.round((new Date(analysis.completed_at).getTime() - new Date(analysis.started_at).getTime()) / 1000)}s
                </span>
              )}
            </div>
            <Link to={`/patients/${id}/reconstruction`}>
              <Button variant="outline" size="sm">
                View Full Analysis
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
