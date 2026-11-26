import { useState } from 'react'
import { AlertTriangle, CheckCircle2, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Contradiction, ContradictionStatus } from '@/types'
import { cn } from '@/lib/utils'
import { useContradictions, useReviewContradiction } from '@/hooks/useAnalysis'
import { usePatients } from '@/hooks/usePatients'

const statusOptions: { value: ContradictionStatus; label: string; color: string }[] = [
  { value: 'confirmed_discrepancy', label: 'Confirmed Discrepancy', color: 'text-red-700' },
  { value: 'resolved_with_evidence', label: 'Resolved with Evidence', color: 'text-green-700' },
  { value: 'requires_more_documentation', label: 'Requires More Documentation', color: 'text-amber-700' },
  { value: 'escalated', label: 'Escalated', color: 'text-purple-700' },
]

function ReviewDialog({ contradiction, onClose }: { contradiction: Contradiction; onClose: () => void }) {
  const [status, setStatus] = useState<ContradictionStatus | ''>('')
  const [note, setNote] = useState('')
  const { mutate, isPending } = useReviewContradiction()

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Review Contradiction</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="p-3 bg-gray-50 rounded-lg text-sm">
          <p className="font-medium text-navy-900 mb-2">{contradiction.description}</p>
          <div className="grid grid-cols-2 gap-2">
            {contradiction.text_a && (
              <div className="p-2 bg-red-50 rounded text-xs text-red-800">
                <strong>Source A{contradiction.page_a ? ` (p.${contradiction.page_a})` : ''}:</strong><br />
                &ldquo;{contradiction.text_a}&rdquo;
              </div>
            )}
            {contradiction.text_b && (
              <div className="p-2 bg-orange-50 rounded text-xs text-orange-800">
                <strong>Source B{contradiction.page_b ? ` (p.${contradiction.page_b})` : ''}:</strong><br />
                &ldquo;{contradiction.text_b}&rdquo;
              </div>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Review Decision *</p>
          {statusOptions.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="status" value={opt.value}
                checked={status === opt.value} onChange={() => setStatus(opt.value)} />
              <span className={`text-sm ${opt.color}`}>{opt.label}</span>
            </label>
          ))}
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Resolution Note</p>
          <textarea
            className="w-full border border-gray-200 rounded-md p-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-navy-800"
            placeholder="Explain your decision..."
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          ⚠ Every review decision is recorded in the audit log.
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          loading={isPending}
          disabled={!status}
          onClick={() => {
            if (!status) return
            mutate({ id: contradiction.id, status, resolution_note: note, patientId: contradiction.patient_id }, { onSuccess: onClose })
          }}
        >
          Record Decision
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

export default function ContradictionCenterPage() {
  const { data: patientsData } = usePatients(1, 100)
  const [selectedPatient, setSelectedPatient] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [reviewing, setReviewing] = useState<Contradiction | null>(null)

  const { data, isLoading } = useContradictions(selectedPatient || undefined)
  const contradictions = data?.data ?? []
  const filtered = severityFilter === 'all' ? contradictions : contradictions.filter(c => c.severity === severityFilter)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Contradiction Center</h1>
        <p className="text-gray-500 text-sm">
          Clinical conflicts detected across documents. Each must be reviewed by a qualified clinician.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)}>
          <option value="">— Select patient —</option>
          {patientsData?.data?.map(p => (
            <option key={p.id} value={p.id}>{p.first_name} {p.last_name}{p.is_demo ? ' [DEMO]' : ''}</option>
          ))}
        </select>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
          <option value="all">All Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {selectedPatient && contradictions.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <span className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm font-medium text-red-700">
            {contradictions.filter(c => c.severity === 'critical').length} Critical
          </span>
          <span className="px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-sm font-medium text-orange-700">
            {contradictions.filter(c => c.severity === 'high').length} High
          </span>
          <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm font-medium text-amber-700">
            {contradictions.filter(c => c.status === 'open').length} Open
          </span>
        </div>
      )}

      {!selectedPatient && (
        <div className="text-center py-16 text-gray-400">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Select a patient to view contradictions</p>
        </div>
      )}

      {selectedPatient && isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-navy-800 border-t-transparent rounded-full" />
        </div>
      )}

      {selectedPatient && !isLoading && filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{contradictions.length === 0 ? 'No contradictions detected' : 'No contradictions match the filter'}</p>
        </div>
      )}

      {filtered.map(c => (
        <Card key={c.id} className={cn('border-l-4',
          c.severity === 'critical' ? 'border-l-red-500' :
          c.severity === 'high' ? 'border-l-orange-500' :
          c.severity === 'medium' ? 'border-l-amber-500' : 'border-l-blue-400'
        )}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <AlertTriangle className={cn('w-4 h-4',
                    c.severity === 'critical' ? 'text-red-600' :
                    c.severity === 'high' ? 'text-orange-600' : 'text-amber-600'
                  )} />
                  <span className="font-semibold text-navy-900">{c.description}</span>
                  <Badge variant={c.severity === 'critical' ? 'destructive' : c.severity === 'high' ? 'warning' : 'secondary'}>
                    {c.severity}
                  </Badge>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{c.category}</span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                    c.status === 'open' ? 'bg-red-50 text-red-700' :
                    c.status === 'escalated' ? 'bg-purple-50 text-purple-700' : 'bg-green-50 text-green-700'
                  )}>
                    {c.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {c.text_a && (
                    <div className="p-3 bg-red-50 rounded-lg text-xs text-red-900">
                      <div className="font-semibold mb-1 flex items-center gap-1">
                        <FileText className="w-3 h-3" />Source A{c.page_a && ` — Page ${c.page_a}`}
                      </div>
                      <p className="italic">&ldquo;{c.text_a}&rdquo;</p>
                    </div>
                  )}
                  {c.text_b && (
                    <div className="p-3 bg-orange-50 rounded-lg text-xs text-orange-900">
                      <div className="font-semibold mb-1 flex items-center gap-1">
                        <FileText className="w-3 h-3" />Source B{c.page_b && ` — Page ${c.page_b}`}
                      </div>
                      <p className="italic">&ldquo;{c.text_b}&rdquo;</p>
                    </div>
                  )}
                </div>
                {c.resolution_note && (
                  <div className="mt-3 p-2 bg-green-50 rounded text-xs text-green-800">
                    <strong>Resolution:</strong> {c.resolution_note}
                  </div>
                )}
              </div>
              {c.status === 'open' && (
                <Button variant="outline" size="sm" onClick={() => setReviewing(c)} className="flex-shrink-0">
                  Review
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!reviewing} onOpenChange={() => setReviewing(null)}>
        {reviewing && <ReviewDialog contradiction={reviewing} onClose={() => setReviewing(null)} />}
      </Dialog>
    </div>
  )
}
