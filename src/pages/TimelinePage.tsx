import { useState } from 'react'
import { Clock, AlertTriangle, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EvidenceBadge } from '@/components/ui/badge'
import { usePatients } from '@/hooks/usePatients'
import { useTimeline } from '@/hooks/useAnalysis'
import { ClinicalEvent } from '@/types'
import { formatDate, cn } from '@/lib/utils'

const categoryColors: Record<string, string> = {
  admission: 'bg-blue-100 text-blue-700',
  discharge: 'bg-green-100 text-green-700',
  investigation: 'bg-purple-100 text-purple-700',
  prescription: 'bg-teal-100 text-teal-700',
  procedure: 'bg-orange-100 text-orange-700',
  progress_note: 'bg-gray-100 text-gray-600',
  consultation: 'bg-indigo-100 text-indigo-700',
  lab_result: 'bg-cyan-100 text-cyan-700',
  diagnosis: 'bg-red-100 text-red-700',
  treatment_change: 'bg-amber-100 text-amber-700',
  unknown: 'bg-gray-100 text-gray-600',
}

function TimelineEvent({ event }: { event: ClinicalEvent }) {
  const catColor = categoryColors[event.category] ?? categoryColors.unknown
  return (
    <div className="relative flex gap-4 pb-6">
      {/* Line */}
      <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-200" />
      {/* Dot */}
      <div className={cn(
        'relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ring-4 ring-white',
        event.evidence_status === 'verified' ? 'bg-green-500' :
        event.evidence_status === 'conflicting' ? 'bg-red-500' :
        event.evidence_status === 'missing_evidence' ? 'bg-purple-500' :
        event.evidence_status === 'uncertain' ? 'bg-amber-400' :
        'bg-blue-500'
      )}>
        <Clock className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 pt-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-medium text-sm text-navy-900">{event.description}</span>
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', catColor)}>
            {event.category.replace(/_/g, ' ')}
          </span>
          <EvidenceBadge status={event.evidence_status} />
          {event.is_backdated && (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
              Backdated entry
            </span>
          )}
        </div>

        <div className="text-xs text-gray-500 flex items-center gap-3 flex-wrap">
          {event.event_date ? (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Clinical: {formatDate(event.event_date)}
            </span>
          ) : (
            <span className="text-gray-400 italic">Clinical date unknown</span>
          )}
          {event.documented_date && event.documented_date !== event.event_date && (
            <span className="text-amber-600 font-medium">
              Documented: {formatDate(event.documented_date)}
            </span>
          )}
          {event.timeline_gap_before_days !== undefined && event.timeline_gap_before_days > 7 && (
            <span className="text-purple-600 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {event.timeline_gap_before_days}d gap before this event
            </span>
          )}
        </div>

        {event.source_text && (
          <p className="text-xs text-gray-400 italic mt-1 max-w-xl">
            "{event.source_text}"
            {event.source_page && <span className="ml-1 not-italic">(p.{event.source_page})</span>}
          </p>
        )}
      </div>
    </div>
  )
}

export default function TimelinePage() {
  const { data: patientsData } = usePatients(1, 100)
  const [selectedPatient, setSelectedPatient] = useState('')
  const { data, isLoading } = useTimeline(selectedPatient || undefined)

  const events = (data?.data ?? []).sort((a, b) =>
    (a.event_date ?? a.documented_date ?? '').localeCompare(b.event_date ?? b.documented_date ?? '')
  )

  const gaps = events.filter(e => e.timeline_gap_before_days && e.timeline_gap_before_days > 7).length
  const backdated = events.filter(e => e.is_backdated).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Medical Time Machine</h1>
        <p className="text-gray-500 text-sm">
          Clinical chronology reconstructed from source documents.
          Event time is distinguished from documentation time. Missing dates are never invented.
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

      {selectedPatient && events.length > 0 && (gaps > 0 || backdated > 0) && (
        <div className="flex gap-3 flex-wrap">
          {gaps > 0 && (
            <div className="px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg text-sm font-medium text-purple-700">
              {gaps} timeline gap{gaps !== 1 ? 's' : ''} detected
            </div>
          )}
          {backdated > 0 && (
            <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm font-medium text-amber-700">
              {backdated} backdated entr{backdated !== 1 ? 'ies' : 'y'}
            </div>
          )}
        </div>
      )}

      {!selectedPatient && (
        <div className="text-center py-16 text-gray-400">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Select a patient to view the clinical timeline</p>
        </div>
      )}

      {selectedPatient && isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-navy-800 border-t-transparent rounded-full" />
        </div>
      )}

      {selectedPatient && !isLoading && events.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No timeline events extracted yet — run analysis first</p>
        </div>
      )}

      {events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              {events.length} events · ordered by clinical date
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="mt-2">
              {events.map(ev => <TimelineEvent key={ev.id} event={ev} />)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
