import { useState } from 'react'
import {
  Radar, Shield, AlertTriangle, XCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePatients } from '@/hooks/usePatients'
import { useUncertainty, useEscalations } from '@/hooks/useAnalysis'
import { safetyGateConfig, cn, formatDateTime } from '@/lib/utils'
import { SafetyGateState } from '@/types'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar as RadarComponent, ResponsiveContainer,
} from 'recharts'

function SafetyGateDisplay({ state, reason }: { state: SafetyGateState; reason: string }) {
  const cfg = safetyGateConfig[state]
  return (
    <div className={cn(
      "rounded-xl border-2 p-6 text-center",
      cfg.border, cfg.bg
    )}>
      <div className={`text-5xl font-black mb-2 ${cfg.color}`}>{cfg.icon}</div>
      <div className={`text-3xl font-black ${cfg.color}`}>{state}</div>
      <div className={`text-lg font-semibold ${cfg.color} mt-1`}>{cfg.label}</div>
      <p className={`text-sm mt-3 ${cfg.color} max-w-sm mx-auto`}>{cfg.description}</p>
      {reason && (
        <p className={`text-sm mt-3 font-medium ${cfg.color}`}>{reason}</p>
      )}
    </div>
  )
}

export default function UncertaintyRadarPage() {
  const { data: patientsData } = usePatients(1, 100)
  const [selectedPatient, setSelectedPatient] = useState('')
  const { data: uncertaintyData, isLoading } = useUncertainty(selectedPatient || undefined)
  const { data: escalationsData } = useEscalations(selectedPatient || undefined)

  const safety = uncertaintyData?.data?.safety_assessment
  const evidence = uncertaintyData?.data?.evidence_summary
  const escalations = escalationsData?.data ?? []

  const radarData = evidence ? [
    { subject: 'Verified', value: evidence.verified },
    { subject: 'Supported', value: evidence.supported },
    { subject: 'Uncertain', value: evidence.uncertain },
    { subject: 'Conflicting', value: evidence.conflicting },
    { subject: 'Missing', value: evidence.missing },
    { subject: 'Superseded', value: evidence.superseded },
  ] : []

  const evidencePct = (count: number) =>
    evidence?.total_statements
      ? Math.round((count / evidence.total_statements) * 100)
      : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Uncertainty Radar</h1>
        <p className="text-gray-500 text-sm">
          Evidence completeness assessment and safety gate evaluation.
          The system cannot proceed through a RED gate.
        </p>
      </div>

      <select
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        value={selectedPatient}
        onChange={e => setSelectedPatient(e.target.value)}
      >
        <option value="">— Select patient —</option>
        {patientsData?.data?.map(p => (
          <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
        ))}
      </select>

      {!selectedPatient && (
        <div className="text-center py-16 text-gray-400">
          <Radar className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Select a patient to view the uncertainty assessment</p>
        </div>
      )}

      {selectedPatient && isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-navy-800 border-t-transparent rounded-full" />
        </div>
      )}

      {selectedPatient && !isLoading && !safety && (
        <div className="text-center py-16 text-gray-400">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Run analysis to generate the uncertainty assessment</p>
        </div>
      )}

      {safety && evidence && (
        <>
          {/* Safety gate */}
          <SafetyGateDisplay
            state={safety.gate_state as SafetyGateState}
            reason={safety.gate_reason}
          />

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Evidence breakdown */}
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Evidence Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Verified', count: evidence.verified, color: 'bg-green-500' },
                  { label: 'Supported', count: evidence.supported, color: 'bg-teal-500' },
                  { label: 'Uncertain', count: evidence.uncertain, color: 'bg-amber-500' },
                  { label: 'Conflicting', count: evidence.conflicting, color: 'bg-red-500' },
                  { label: 'Missing', count: evidence.missing, color: 'bg-purple-500' },
                  { label: 'Superseded', count: evidence.superseded, color: 'bg-gray-400' },
                ].map(({ label, count, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{label}</span>
                      <span className="font-medium">{count} ({evidencePct(count)}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${color} rounded-full`}
                        style={{ width: `${evidencePct(count)}%` }}
                      />
                    </div>
                  </div>
                ))}

                <div className="pt-3 border-t border-gray-100">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">Completeness Score</span>
                    <span className={cn(
                      "font-bold",
                      evidence.evidence_completeness_score >= 0.7 ? 'text-green-700' :
                      evidence.evidence_completeness_score >= 0.4 ? 'text-amber-700' :
                      'text-red-700'
                    )}>
                      {Math.round(evidence.evidence_completeness_score * 100)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Radar chart */}
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Evidence Radar</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} />
                    <RadarComponent
                      name="Statements"
                      dataKey="value"
                      stroke="#1c3a6e"
                      fill="#1c3a6e"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Safety issues */}
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Critical Issues</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Unresolved Contradictions</span>
                  <span className={cn("font-bold", safety.unresolved_contradictions > 0 ? 'text-red-700' : 'text-green-700')}>
                    {safety.unresolved_contradictions}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Missing Critical Info</span>
                  <span className={cn("font-bold", safety.missing_critical_info > 0 ? 'text-purple-700' : 'text-green-700')}>
                    {safety.missing_critical_info}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Can Generate Summary</span>
                  <span className={cn("font-bold", safety.can_generate_summary ? 'text-green-700' : 'text-red-700')}>
                    {safety.can_generate_summary ? 'Yes' : 'No'}
                  </span>
                </div>

                {safety.blocked_conclusions.length > 0 && (
                  <div className="mt-3 p-3 bg-red-50 rounded-lg">
                    <p className="text-xs font-semibold text-red-800 mb-2">Blocked Conclusions:</p>
                    {safety.blocked_conclusions.map((c, i) => (
                      <p key={`block-${i}`} className="text-xs text-red-700 flex items-start gap-1">
                        <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        {c}
                      </p>
                    ))}
                  </div>
                )}

                {safety.critical_issues.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {safety.critical_issues.map((issue, i) => (
                      <p key={`issue-${i}`} className="text-xs text-amber-700 flex items-start gap-1">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        {issue}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Escalations */}
          {escalations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Active Escalations</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {escalations.map(esc => (
                  <div key={esc.id} className="p-4 border-b border-gray-100 last:border-0">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0",
                        esc.safety_gate_state === 'RED' ? 'bg-red-100 text-red-700' :
                        esc.safety_gate_state === 'YELLOW' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      )}>
                        {esc.safety_gate_state}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-navy-900">{esc.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{esc.description}</p>
                        {esc.recommended_action && (
                          <p className="text-xs text-blue-700 mt-1">
                            <span className="font-medium">Recommended:</span> {esc.recommended_action}
                          </p>
                        )}
                      </div>
                      <span className={cn(
                        "ml-auto text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0",
                        esc.severity === 'blocking' ? 'bg-red-100 text-red-700' :
                        esc.severity === 'critical' ? 'bg-orange-100 text-orange-700' :
                        'bg-amber-100 text-amber-700'
                      )}>
                        {esc.severity}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
