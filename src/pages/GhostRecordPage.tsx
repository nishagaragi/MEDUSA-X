import { useState } from 'react'
import { Ghost, AlertCircle, FileQuestion, FlaskConical, Pill, FileText, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePatients } from '@/hooks/usePatients'
import { useMissingInformation } from '@/hooks/useAnalysis'
import { MissingInfoType } from '@/types'
import { formatDate, cn } from '@/lib/utils'
import type { ComponentType } from 'react'

const typeConfig: Record<MissingInfoType, {
  label: string
  icon: ComponentType<{ className?: string }>
  color: string
  bg: string
  borderColor: string
}> = {
  missing_document:            { label: 'Missing Document',            icon: FileText,     color: 'text-red-700',    bg: 'bg-red-50',    borderColor: 'border-l-red-500'    },
  missing_result:              { label: 'Missing Result',              icon: FlaskConical, color: 'text-purple-700', bg: 'bg-purple-50', borderColor: 'border-l-purple-500' },
  missing_clinical_detail:     { label: 'Missing Clinical Detail',     icon: FileQuestion, color: 'text-amber-700',  bg: 'bg-amber-50',  borderColor: 'border-l-amber-500'  },
  undocumented_treatment_change: { label: 'Undocumented Treatment Change', icon: Pill,     color: 'text-orange-700', bg: 'bg-orange-50', borderColor: 'border-l-orange-500' },
  incomplete_timeline:         { label: 'Incomplete Timeline',         icon: Clock,        color: 'text-blue-700',   bg: 'bg-blue-50',   borderColor: 'border-l-blue-500'   },
  unresolved_reference:        { label: 'Unresolved Reference',        icon: AlertCircle,  color: 'text-gray-700',   bg: 'bg-gray-50',   borderColor: 'border-l-gray-400'   },
}

export default function GhostRecordPage() {
  const { data: patientsData } = usePatients(1, 100)
  const [selectedPatient, setSelectedPatient] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const { data, isLoading } = useMissingInformation(selectedPatient || undefined)

  const missing = data?.data ?? []
  const filtered = typeFilter === 'all' ? missing : missing.filter(m => m.missing_type === typeFilter)

  const counts: Partial<Record<MissingInfoType, number>> = {}
  missing.forEach(m => { counts[m.missing_type] = (counts[m.missing_type] ?? 0) + 1 })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Ghost Record Detector</h1>
        <p className="text-gray-500 text-sm">
          Documents, results, and details referenced but not available.
          Missing documentation does not prove an event did not happen.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
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
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="all">All Types</option>
          {Object.entries(typeConfig).map(([value, { label }]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Type summary */}
      {selectedPatient && missing.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(counts).map(([type, count]) => {
            const cfg = typeConfig[type as MissingInfoType]
            if (!cfg || !count) return null
            const Icon = cfg.icon
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  typeFilter === type
                    ? `${cfg.bg} ${cfg.color} border-current`
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {cfg.label} ({count})
              </button>
            )
          })}
        </div>
      )}

      {!selectedPatient && (
        <div className="text-center py-16 text-gray-400">
          <Ghost className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Select a patient to view ghost records</p>
        </div>
      )}

      {selectedPatient && isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-navy-800 border-t-transparent rounded-full" />
        </div>
      )}

      {selectedPatient && !isLoading && missing.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Ghost className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No missing records detected</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(item => {
            const cfg = typeConfig[item.missing_type]
            const Icon = cfg.icon
            return (
              <Card key={item.id} className={cn('border-l-4', cfg.borderColor)}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", cfg.bg)}>
                      <Icon className={cn("w-4 h-4", cfg.color)} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", cfg.bg, cfg.color)}>
                          {cfg.label}
                        </span>
                        {item.is_critical && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                            Critical
                          </span>
                        )}
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          item.status === 'open' ? 'bg-gray-100 text-gray-600' :
                          item.status === 'resolved' ? 'bg-green-100 text-green-700' :
                          'bg-amber-100 text-amber-700'
                        )}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="font-medium text-sm text-navy-900">{item.description}</p>
                      {item.referenced_text && (
                        <p className="text-xs text-gray-500 mt-1 italic">
                          Referenced: "{item.referenced_text}"
                          {item.referenced_on_page && ` (page ${item.referenced_on_page})`}
                        </p>
                      )}
                      {item.clinician_question && (
                        <p className="text-xs text-blue-700 mt-1.5 flex items-start gap-1">
                          <span className="font-medium">? For clinician:</span>
                          {item.clinician_question}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
