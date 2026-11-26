import { useState } from 'react'
import {
  FileText, Download, AlertTriangle, Eye,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EvidenceBadge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { usePatients } from '@/hooks/usePatients'
import { useGenerateReport, useReports } from '@/hooks/useAnalysis'
import { formatDate, formatDateTime, safetyGateConfig, cn } from '@/lib/utils'
import { HandoverReport, UnresolvedIssue } from '@/types'

function UnresolvedPassport({ issues }: { issues: UnresolvedIssue[] }) {
  if (!issues.length) return null
  return (
    <Card className="border-amber-200">
      <CardHeader className="bg-amber-50 rounded-t-xl">
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <AlertTriangle className="w-5 h-5" />
          Unresolved Issues Passport ({issues.length} issues)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {issues.map((issue, idx) => (
          <div key={issue.issue_id} className="p-4 border-b border-amber-100 last:border-0">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <div className="space-y-1.5">
                <p className="font-semibold text-sm text-navy-900">{issue.description}</p>
                <p className="text-xs text-gray-600">
                  <span className="font-medium">Related info:</span> {issue.related_information}
                </p>
                <p className="text-xs text-gray-600">
                  <span className="font-medium">Reason unresolved:</span> {issue.reason_unresolved}
                </p>
                {issue.potentially_affected_records.length > 0 && (
                  <p className="text-xs text-red-700">
                    <span className="font-medium">Potentially affects:</span>{' '}
                    {issue.potentially_affected_records.join(', ')}
                  </p>
                )}
                <p className="text-xs text-blue-700">
                  <span className="font-medium">Recommended action:</span> {issue.recommended_verification_action}
                </p>
                <span className={cn(
                  "inline-block text-xs px-2 py-0.5 rounded-full font-medium",
                  issue.escalation_status === 'open' ? 'bg-red-100 text-red-700' :
                  issue.escalation_status === 'in_review' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                )}>
                  {issue.escalation_status.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ReportView({ report }: { report: HandoverReport }) {
  const gateConfig = safetyGateConfig[report.safety_gate_state]
  const data = report.report_data

  const handlePDFDownload = () => {
    try {
      const patient = data?.patient as unknown as Record<string, string> | undefined
      const lines: string[] = [
        'TRUST-MED AI — PATIENT HANDOVER REPORT',
        '='.repeat(60),
        `Generated: ${new Date().toLocaleString()}`,
        `Safety Gate: ${report.safety_gate_state}`,
        `Version: ${report.version}`,
        '',
        'PATIENT',
        '-'.repeat(40),
        `Name: ${patient?.first_name ?? ''} ${patient?.last_name ?? ''}`,
        `DOB: ${patient?.date_of_birth ?? 'Unknown'}`,
        `MRN: ${patient?.mrn ?? 'Not recorded'}`,
        '',
        'CLINICAL SUMMARY',
        '-'.repeat(40),
        (data?.summary as string) ?? 'No summary generated',
        '',
        `UNRESOLVED ISSUES PASSPORT (${report.unresolved_passport?.length ?? 0} issues)`,
        '-'.repeat(40),
        ...(report.unresolved_passport?.length
          ? report.unresolved_passport.map((issue, i) =>
              `${i + 1}. ${issue.description}\n   Action: ${issue.recommended_verification_action}`
            )
          : ['No unresolved issues']),
        '',
        '='.repeat(60),
        'DISCLAIMER: Not for direct patient care without qualified clinician review.',
        'TRUST-MED AI is a clinical information reconciliation prototype only.',
      ]
      const text = lines.join('\n')
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `handover-report-${report.id.slice(0, 8)}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Download failed. Please try again.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Report header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-bold text-navy-900">Patient Handover Report</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Generated {formatDateTime(report.created_at)} · Version {report.version}
                {report.is_draft && <span className="ml-2 text-amber-600 font-medium">DRAFT</span>}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className={cn(
                "px-4 py-2 rounded-lg border-2 font-bold text-sm",
                gateConfig.border, gateConfig.bg, gateConfig.color
              )}>
                {report.safety_gate_state} — {gateConfig.label}
              </div>
              <Button variant="outline" onClick={handlePDFDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Safety gate explanation */}
      <div className={cn("p-4 rounded-xl border-2", gateConfig.border, gateConfig.bg)}>
        <p className={`text-sm font-medium ${gateConfig.color}`}>{gateConfig.description}</p>
        {data?.safety_assessment?.critical_issues?.map((issue, i) => (
          <p key={`ci-${i}`} className={`text-xs mt-1 ${gateConfig.color}`}>• {issue}</p>
        ))}
      </div>

      {/* Summary */}
      {data?.summary && (
        <Card>
          <CardHeader><CardTitle>Clinical Summary</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{data.summary}</p>
            <p className="text-xs text-amber-700 mt-3 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              This summary is based on extracted documentation only. Verify all statements against original records.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Diagnoses */}
      {data?.diagnoses?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Documented Diagnoses</CardTitle></CardHeader>
          <CardContent className="p-0">
            {data.diagnoses.map(dx => (
              <div key={dx.id} className="p-3 border-b border-gray-100 last:border-0 flex items-center gap-3">
                <div className="flex-1">
                  <span className="font-medium text-sm">{dx.description}</span>
                  {dx.icd_code && <code className="ml-2 text-xs bg-gray-100 px-1 rounded">{dx.icd_code}</code>}
                </div>
                <EvidenceBadge status={dx.evidence_status} />
                <span className="text-xs text-gray-500 capitalize">{dx.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Medications */}
      {data?.medications?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Reconciled Medications</CardTitle></CardHeader>
          <CardContent className="p-0">
            {data.medications.map(med => (
              <div key={med.id} className="p-3 border-b border-gray-100 last:border-0 flex items-center gap-3">
                <div className="flex-1">
                  <span className="font-medium text-sm">{med.name}</span>
                  {med.has_conflicts && (
                    <span className="ml-2 text-xs text-red-600 font-medium">⚠ Conflict</span>
                  )}
                </div>
                <EvidenceBadge status={med.evidence_status} />
                <span className={cn("text-xs font-medium capitalize",
                  med.current_state === 'discontinued' ? 'text-red-600' :
                  med.current_state === 'conflicting' ? 'text-orange-600' : 'text-gray-600'
                )}>
                  {med.current_state}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Missing info */}
      {data?.missing_information?.length > 0 && (
        <Card className="border-purple-200">
          <CardHeader><CardTitle className="text-purple-800">Missing Documentation</CardTitle></CardHeader>
          <CardContent className="p-0">
            {data.missing_information.map(m => (
              <div key={m.id} className="p-3 border-b border-purple-100 last:border-0">
                <p className="text-sm font-medium text-purple-900">{m.description}</p>
                {m.clinician_question && (
                  <p className="text-xs text-purple-700 mt-0.5">? {m.clinician_question}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Unresolved passport */}
      <UnresolvedPassport issues={report.unresolved_passport ?? []} />
    </div>
  )
}

export default function HandoverReportPage() {
  const { data: patientsData } = usePatients(1, 100)
  const [selectedPatient, setSelectedPatient] = useState('')
  const { data: reportsData, isLoading } = useReports(selectedPatient || undefined)
  const { mutate: generateReport, isPending } = useGenerateReport(selectedPatient)
  const [viewingReport, setViewingReport] = useState<HandoverReport | null>(null)

  const reports = reportsData?.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Patient Handover Guardian</h1>
        <p className="text-gray-500 text-sm">
          Generate evidence-linked clinical summaries with Unresolved Issues Passports.
          Uncertain information is never silently converted to verified.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedPatient}
          onChange={e => { setSelectedPatient(e.target.value); setViewingReport(null) }}
        >
          <option value="">— Select patient —</option>
          {patientsData?.data?.map(p => (
            <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
          ))}
        </select>

        {selectedPatient && (
          <Button onClick={() => generateReport()} loading={isPending}>
            <FileText className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
        )}
      </div>

      {viewingReport ? (
        <>
          <Button variant="outline" onClick={() => setViewingReport(null)}>
            ← Back to Reports
          </Button>
          <ReportView report={viewingReport} />
        </>
      ) : (
        <>
          {!selectedPatient && (
            <div className="text-center py-16 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Select a patient to generate or view handover reports</p>
            </div>
          )}

          {selectedPatient && isLoading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-navy-800 border-t-transparent rounded-full" />
            </div>
          )}

          {selectedPatient && !isLoading && reports.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="mb-2">No reports yet</p>
              <p className="text-xs">Run analysis first, then generate a handover report.</p>
            </div>
          )}

          {reports.length > 0 && (
            <div className="space-y-3">
              {reports.map(report => {
                const cfg = safetyGateConfig[report.safety_gate_state]
                return (
                  <Card key={report.id} className="cursor-pointer hover:shadow-md" onClick={() => setViewingReport(report)}>
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className={cn(
                        "px-3 py-1.5 rounded-lg border-2 font-bold text-xs flex-shrink-0",
                        cfg.border, cfg.bg, cfg.color
                      )}>
                        {report.safety_gate_state}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-navy-900">
                          Handover Report v{report.version}
                          {report.is_draft && <span className="ml-2 text-xs text-amber-600">[DRAFT]</span>}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {formatDateTime(report.created_at)} ·{' '}
                          {report.unresolved_passport?.length ?? 0} unresolved issues
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
