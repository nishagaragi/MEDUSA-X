import { useQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { auditStore } from '@/lib/store'
import { AuditLog } from '@/types'
import { formatDateTime, cn } from '@/lib/utils'

const actionColors: Record<string, string> = {
  upload: 'bg-blue-50 text-blue-700',
  analysis: 'bg-purple-50 text-purple-700',
  review: 'bg-teal-50 text-teal-700',
  escalation: 'bg-red-50 text-red-700',
  delete: 'bg-red-100 text-red-800',
  create: 'bg-green-50 text-green-700',
  update: 'bg-amber-50 text-amber-700',
  report: 'bg-indigo-50 text-indigo-700',
}

export default function AuditPage() {
  const { data, isLoading } = useQuery<{ data: AuditLog[]; total: number }>({
    queryKey: ['audit-logs'],
    queryFn: () => {
      const logs = auditStore.getLogs()
      return { data: logs, total: logs.length }
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Audit & Security</h1>
          <p className="text-gray-500 text-sm">
            Complete audit trail of all clinical actions and system events.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5" />
          {data?.total ?? 0} total events
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-navy-800 border-t-transparent rounded-full" />
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left p-3 font-medium text-gray-600 whitespace-nowrap">Time</th>
                  <th className="text-left p-3 font-medium text-gray-600">Action</th>
                  <th className="text-left p-3 font-medium text-gray-600">Resource</th>
                  <th className="text-left p-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {(!data?.data?.length) && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-400">
                      No audit events yet. Events are recorded as you use the application.
                    </td>
                  </tr>
                )}
                {data?.data?.map(log => {
                  const actionKey = Object.keys(actionColors).find(k => log.action.toLowerCase().includes(k)) ?? ''
                  const colorClass = actionColors[actionKey] ?? 'bg-gray-100 text-gray-600'
                  return (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3 text-gray-500 text-xs whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="p-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', colorClass)}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600 text-xs">
                        {log.resource_type && (
                          <span>
                            {log.resource_type}
                            {log.resource_id ? ` · ${log.resource_id.slice(0, 8)}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={log.success ? 'text-green-600 text-xs font-medium' : 'text-red-600 text-xs font-medium'}>
                          {log.success ? 'Success' : 'Failed'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
