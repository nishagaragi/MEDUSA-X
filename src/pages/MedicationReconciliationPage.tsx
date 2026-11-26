import { useState } from 'react'
import { Pill, AlertTriangle, CheckCircle2, XCircle, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EvidenceBadge } from '@/components/ui/badge'
import { usePatients } from '@/hooks/usePatients'
import { useMedications } from '@/hooks/useAnalysis'
import { Medication, MedicationEvent } from '@/types'
import { formatDate, cn } from '@/lib/utils'

const stateColors: Record<string, string> = {
  prescribed:    'bg-blue-50 text-blue-700 border-blue-200',
  started:       'bg-teal-50 text-teal-700 border-teal-200',
  continued:     'bg-green-50 text-green-700 border-green-200',
  modified:      'bg-amber-50 text-amber-700 border-amber-200',
  discontinued:  'bg-red-50 text-red-700 border-red-200',
  uncertain:     'bg-gray-100 text-gray-700 border-gray-300',
  conflicting:   'bg-orange-50 text-orange-700 border-orange-200',
}

function MedTimeline({ events }: { events: MedicationEvent[] }) {
  if (!events?.length) return <p className="text-xs text-gray-400 italic">No events recorded</p>
  return (
    <div className="flex items-center gap-1 flex-wrap mt-2">
      {events.map((ev, i) => (
        <span key={ev.id} className="flex items-center gap-1">
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full border font-medium',
            stateColors[ev.event_type] ?? stateColors.uncertain
          )}>
            {ev.event_type}
            {ev.dosage && ` · ${ev.dosage}`}
          </span>
          {i < events.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
        </span>
      ))}
    </div>
  )
}

function MedCard({ med }: { med: Medication }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <Card className={cn(
      'border-l-4',
      med.has_conflicts ? 'border-l-red-500' :
      med.current_state === 'discontinued' ? 'border-l-gray-400' :
      'border-l-teal-500'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Pill className={cn(
                'w-4 h-4',
                med.has_conflicts ? 'text-red-500' : 'text-teal-600'
              )} />
              <span className="font-semibold text-navy-900">{med.name}</span>
              {med.generic_name && med.generic_name !== med.name && (
                <span className="text-xs text-gray-400">({med.generic_name})</span>
              )}
              {med.drug_class && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {med.drug_class}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full border font-medium',
                stateColors[med.current_state] ?? stateColors.uncertain
              )}>
                {med.current_state}
              </span>
              <EvidenceBadge status={med.evidence_status} />
              {med.has_conflicts && (
                <span className="flex items-center gap-1 text-xs text-red-600 font-semibold">
                  <AlertTriangle className="w-3 h-3" />
                  Conflict — requires human review
                </span>
              )}
            </div>

            {med.events && med.events.length > 0 && (
              <div className="mt-2">
                <button
                  className="text-xs text-gray-500 hover:text-navy-700"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? '▾ Hide lifecycle' : `▸ Show lifecycle (${med.events!.length} events)`}
                </button>
                {expanded && <MedTimeline events={med.events!} />}
              </div>
            )}
          </div>
        </div>

        {expanded && med.events && med.events.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
            {med.events.map(ev => (
              <div key={ev.id} className="text-xs grid grid-cols-5 gap-2 text-gray-500">
                <span className={cn(
                  'font-medium px-1.5 py-0.5 rounded text-center',
                  stateColors[ev.event_type] ?? stateColors.uncertain
                )}>
                  {ev.event_type}
                </span>
                <span>{ev.dosage ?? '—'}</span>
                <span>{ev.frequency ?? '—'}</span>
                <span>{ev.route ?? '—'}</span>
                <span>{ev.event_date ? formatDate(ev.event_date) : '—'}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function MedicationReconciliationPage() {
  const { data: patientsData } = usePatients(1, 100)
  const [selectedPatient, setSelectedPatient] = useState('')
  const { data, isLoading } = useMedications(selectedPatient || undefined)

  const medications = data?.data ?? []
  const conflicts = medications.filter(m => m.has_conflicts).length
  const discontinued = medications.filter(m => m.current_state === 'discontinued').length
  const uncertain = medications.filter(m => m.current_state === 'uncertain' || m.current_state === 'conflicting').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Medication Reconciliation</h1>
        <p className="text-gray-500 text-sm">
          Full medication lifecycle with evidence tracing.
          Conflicts require human review — the system does not automatically choose a version.
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

      {selectedPatient && medications.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {conflicts > 0 && (
            <div className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm font-medium text-red-700 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              {conflicts} conflict{conflicts !== 1 ? 's' : ''} — human review required
            </div>
          )}
          {discontinued > 0 && (
            <div className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 flex items-center gap-1.5">
              <XCircle className="w-4 h-4" />
              {discontinued} discontinued
            </div>
          )}
          {uncertain > 0 && (
            <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm font-medium text-amber-700 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              {uncertain} uncertain/conflicting
            </div>
          )}
          {conflicts === 0 && medications.length > 0 && (
            <div className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              No conflicts detected
            </div>
          )}
        </div>
      )}

      {!selectedPatient && (
        <div className="text-center py-16 text-gray-400">
          <Pill className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Select a patient to view medication reconciliation</p>
        </div>
      )}

      {selectedPatient && isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-navy-800 border-t-transparent rounded-full" />
        </div>
      )}

      {selectedPatient && !isLoading && medications.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Pill className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No medications extracted yet — run analysis first</p>
        </div>
      )}

      {/* Conflicts first, then rest */}
      {medications.length > 0 && (
        <div className="space-y-3">
          {/* Sort: conflicts first, then discontinued, then others */}
          {[...medications]
            .sort((a, b) => {
              if (a.has_conflicts && !b.has_conflicts) return -1
              if (!a.has_conflicts && b.has_conflicts) return 1
              return a.name.localeCompare(b.name)
            })
            .map(med => <MedCard key={med.id} med={med} />)
          }
        </div>
      )}
    </div>
  )
}
