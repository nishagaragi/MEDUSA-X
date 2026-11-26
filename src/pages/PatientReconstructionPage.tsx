import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  User, FileText, Clock, Pill, FlaskConical, 
  ChevronRight, Play, AlertTriangle, CheckCircle2,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { EvidenceBadge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { usePatient } from '@/hooks/usePatients'
import {
  useDiagnoses, useMedications, useLaboratoryResults,
  useTimeline, useRunAnalysis, useAnalysis, useContradictions,
} from '@/hooks/useAnalysis'
import { formatDate, formatDateTime, safetyGateConfig, cn } from '@/lib/utils'
import { EvidenceStatus } from '@/types'

function EvidenceDetail({ status, explanation, sourceText, sourcePage }: {
  status: EvidenceStatus
  explanation?: string
  sourceText?: string
  sourcePage?: number
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-navy-700"
        onClick={() => setOpen(!open)}
      >
        <Info className="w-3 h-3" />
        Source evidence
        <ChevronRight className={cn("w-3 h-3 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="mt-2 p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs space-y-1">
          {explanation && <p className="text-gray-700"><span className="font-semibold">Explanation:</span> {explanation}</p>}
          {sourceText && <p className="text-gray-600"><span className="font-semibold">Source text:</span> "{sourceText}"</p>}
          {sourcePage !== undefined && <p className="text-gray-400">Page {sourcePage}</p>}
        </div>
      )}
    </div>
  )
}

export default function PatientReconstructionPage() {
  const { id } = useParams<{ id: string }>()
  const { data: patientData, isLoading: loadingPatient } = usePatient(id)
  const { data: analysisData } = useAnalysis(id)
  const { data: diagnosesData } = useDiagnoses(id)
  const { data: medsData } = useMedications(id)
  const { data: labsData } = useLaboratoryResults(id)
  const { data: timelineData } = useTimeline(id)
  const { data: contradictionsData } = useContradictions(id)
  const { mutate: runAnalysis, isPending } = useRunAnalysis(id ?? '')

  const patient = patientData?.data
  const analysis = analysisData?.data
  const gateState = analysis?.safety_gate_state ?? 'YELLOW'
  const gateConfig = safetyGateConfig[gateState as keyof typeof safetyGateConfig]

  if (loadingPatient) {
    return <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-navy-800 border-t-transparent rounded-full" /></div>
  }

  if (!patient) {
    return <Alert variant="destructive"><AlertDescription>Patient not found.</AlertDescription></Alert>
  }

  return (
    <div className="space-y-6">
      {/* Patient header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-navy-100 flex items-center justify-center">
            <User className="w-7 h-7 text-navy-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-navy-900">
                {patient.first_name} {patient.last_name}
              </h1>
              {patient.is_demo && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">SYNTHETIC DEMO</span>
              )}
            </div>
            <div className="text-sm text-gray-500 mt-0.5">
              {patient.mrn && `MRN: ${patient.mrn} · `}
              {patient.date_of_birth && `DOB: ${formatDate(patient.date_of_birth)} · `}
              {patient.gender && `${patient.gender} · `}
              {patient.blood_type && `Blood type: ${patient.blood_type}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {analysis && (
            <div className={cn(
              "px-4 py-2 rounded-lg border-2 font-bold text-sm",
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
            Run Analysis
          </Button>
        </div>
      </div>

      {/* Stats row — only show when real data exists */}
      {analysis && analysis.total_statements > 0 && (
        <div className="grid grid-cols-5 gap-3">
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

      {/* Warning for unanalyzed */}
      {!analysis && (
        <Alert variant="warning">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            No analysis has been run for this patient yet. Click "Run Analysis" to start the Clinical Detective Swarm.
          </AlertDescription>
        </Alert>
      )}

      {/* Warning when analysis ran but found no data */}
      {analysis && analysis.total_statements === 0 && (
        <Alert variant="warning">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            {analysis.error_message ?? 'No clinical information was extracted. Upload PDF or TXT documents containing medical records, then run analysis again.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="diagnoses">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="diagnoses">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Diagnoses ({diagnosesData?.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="medications">
            <Pill className="w-4 h-4 mr-2" />
            Medications ({medsData?.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="labs">
            <FlaskConical className="w-4 h-4 mr-2" />
            Lab Results ({labsData?.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Clock className="w-4 h-4 mr-2" />
            Timeline ({timelineData?.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="contradictions">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Contradictions ({contradictionsData?.data?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* Diagnoses */}
        <TabsContent value="diagnoses">
          <Card>
            <CardContent className="p-0">
              {!diagnosesData?.data?.length ? (
                <div className="py-12 text-center text-gray-400 text-sm">No diagnoses extracted yet</div>
              ) : (
                diagnosesData.data.map(dx => (
                  <div key={dx.id} className="p-4 border-b border-gray-100 last:border-0">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-navy-900">{dx.description}</span>
                          {dx.icd_code && (
                            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{dx.icd_code}</code>
                          )}
                          <EvidenceBadge status={dx.evidence_status} />
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            dx.status === 'active' ? 'bg-green-50 text-green-700' :
                            dx.status === 'resolved' ? 'bg-gray-100 text-gray-600' :
                            dx.status === 'conflicting' ? 'bg-red-50 text-red-700' :
                            'bg-amber-50 text-amber-700'
                          )}>
                            {dx.status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {dx.onset_date && `Onset: ${formatDate(dx.onset_date)}`}
                          {dx.resolution_date && ` · Resolved: ${formatDate(dx.resolution_date)}`}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <EvidenceDetail
                        status={dx.evidence_status}
                        sourceText={dx.source_text}
                        sourcePage={dx.source_page}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Medications */}
        <TabsContent value="medications">
          <Card>
            <CardContent className="p-0">
              {!medsData?.data?.length ? (
                <div className="py-12 text-center text-gray-400 text-sm">No medications extracted yet</div>
              ) : (
                medsData.data.map(med => (
                  <div key={med.id} className="p-4 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Pill className={cn("w-5 h-5", med.has_conflicts ? "text-red-500" : "text-purple-500")} />
                      <span className="font-semibold text-navy-900">{med.name}</span>
                      {med.generic_name && med.generic_name !== med.name && (
                        <span className="text-xs text-gray-400">({med.generic_name})</span>
                      )}
                      <EvidenceBadge status={med.evidence_status} />
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        med.current_state === 'discontinued' ? 'bg-red-50 text-red-700' :
                        med.current_state === 'conflicting' ? 'bg-orange-50 text-orange-700' :
                        med.current_state === 'uncertain' ? 'bg-amber-50 text-amber-700' :
                        'bg-green-50 text-green-700'
                      )}>
                        {med.current_state}
                      </span>
                      {med.has_conflicts && (
                        <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          Conflict detected
                        </span>
                      )}
                    </div>
                    {med.events && med.events.length > 0 && (
                      <div className="mt-3 pl-8 space-y-1">
                        {med.events.map(ev => (
                          <div key={ev.id} className="text-xs text-gray-500 flex items-center gap-2">
                            <span className="font-medium capitalize">{ev.event_type}</span>
                            {ev.dosage && <span>· {ev.dosage}</span>}
                            {ev.frequency && <span>· {ev.frequency}</span>}
                            {ev.route && <span>· {ev.route}</span>}
                            {ev.event_date && <span className="text-gray-400">· {formatDate(ev.event_date)}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Labs */}
        <TabsContent value="labs">
          <Card>
            <CardContent className="p-0">
              {!labsData?.data?.length ? (
                <div className="py-12 text-center text-gray-400 text-sm">No laboratory results extracted yet</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left p-3 font-medium text-gray-600">Test</th>
                      <th className="text-left p-3 font-medium text-gray-600">Value</th>
                      <th className="text-left p-3 font-medium text-gray-600">Reference</th>
                      <th className="text-left p-3 font-medium text-gray-600">Date</th>
                      <th className="text-left p-3 font-medium text-gray-600">Status</th>
                      <th className="text-left p-3 font-medium text-gray-600">Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labsData.data.map(lab => (
                      <tr key={lab.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 font-medium text-navy-900">
                          {lab.test_name}
                          {lab.is_critical && (
                            <span className="ml-1 text-xs text-red-600 font-bold">CRITICAL</span>
                          )}
                        </td>
                        <td className="p-3">
                          {lab.value && lab.unit ? (
                            <span className={cn(lab.is_abnormal ? "text-red-700 font-semibold" : "text-gray-900")}>
                              {lab.value} {lab.unit}
                              {lab.is_abnormal && <span className="ml-1">⚠</span>}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">
                              {lab.status === 'missing' ? '— Missing result' :
                               lab.status === 'referenced_only' ? '— Referenced only' :
                               '— No value'}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-gray-500 text-xs">
                          {lab.reference_range_text ??
                            (lab.reference_range_low !== undefined && lab.reference_range_high !== undefined
                              ? `${lab.reference_range_low}–${lab.reference_range_high} ${lab.unit ?? ''}`
                              : '—')}
                        </td>
                        <td className="p-3 text-gray-500">
                          {lab.sample_date ? formatDate(lab.sample_date) : '—'}
                        </td>
                        <td className="p-3">
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            lab.status === 'missing' ? 'bg-purple-50 text-purple-700' :
                            lab.status === 'available' ? 'bg-green-50 text-green-700' :
                            'bg-gray-100 text-gray-600'
                          )}>
                            {lab.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <EvidenceBadge status={lab.evidence_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline">
          <Card>
            <CardContent className="p-6">
              {!timelineData?.data?.length ? (
                <div className="py-12 text-center text-gray-400 text-sm">No timeline events extracted yet</div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                  {timelineData.data
                    .sort((a, b) => {
                      const aDate = a.event_date ?? a.documented_date ?? ''
                      const bDate = b.event_date ?? b.documented_date ?? ''
                      return aDate.localeCompare(bDate)
                    })
                    .map(event => (
                      <div key={event.id} className="relative flex gap-4 pb-6">
                        <div className={cn(
                          "relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                          event.evidence_status === 'verified' ? 'bg-green-100 text-green-700' :
                          event.evidence_status === 'conflicting' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        )}>
                          <Clock className="w-4 h-4" />
                        </div>
                        <div className="flex-1 pt-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium text-navy-900 text-sm">{event.description}</span>
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded-full",
                              "bg-gray-100 text-gray-600"
                            )}>
                              {event.category.replace(/_/g, ' ')}
                            </span>
                            <EvidenceBadge status={event.evidence_status} />
                            {event.is_backdated && (
                              <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                                Backdated
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {event.event_date ? (
                              <>Clinical: {formatDate(event.event_date)}</>
                            ) : (
                              <span className="text-gray-400 italic">Clinical date unknown</span>
                            )}
                            {event.documented_date && event.documented_date !== event.event_date && (
                              <span className="ml-2 text-amber-600">
                                · Documented: {formatDate(event.documented_date)}
                              </span>
                            )}
                            {event.timeline_gap_before_days !== undefined && event.timeline_gap_before_days > 7 && (
                              <span className="ml-2 text-purple-600">
                                · Gap: {event.timeline_gap_before_days}d
                              </span>
                            )}
                          </div>
                          {event.source_text && (
                            <p className="text-xs text-gray-400 italic mt-1">"{event.source_text}"</p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contradictions */}
        <TabsContent value="contradictions">
          <Card>
            <CardContent className="p-0">
              {!contradictionsData?.data?.length ? (
                <div className="py-12 text-center text-gray-400 text-sm">No contradictions detected</div>
              ) : (
                contradictionsData.data.map(c => (
                  <div key={c.id} className="p-4 border-b border-gray-100 last:border-0">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={cn(
                        "w-5 h-5 flex-shrink-0 mt-0.5",
                        c.severity === 'critical' ? 'text-red-600' :
                        c.severity === 'high' ? 'text-orange-600' :
                        'text-amber-600'
                      )} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-navy-900">{c.description}</span>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            c.severity === 'critical' ? 'bg-red-100 text-red-700' :
                            c.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                            'bg-amber-100 text-amber-700'
                          )}>
                            {c.severity}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {c.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          {c.text_a && (
                            <div className="p-2 bg-red-50 rounded text-xs text-red-800">
                              <span className="font-semibold">Source A</span>{c.page_a && ` (p.${c.page_a})`}: "{c.text_a}"
                            </div>
                          )}
                          {c.text_b && (
                            <div className="p-2 bg-orange-50 rounded text-xs text-orange-800">
                              <span className="font-semibold">Source B</span>{c.page_b && ` (p.${c.page_b})`}: "{c.text_b}"
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
