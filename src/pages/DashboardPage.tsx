import { Link } from 'react-router-dom'
import type { ComponentType } from 'react'
import {
  Users, FileText, CheckCircle2, AlertTriangle,
  Ghost, ArrowUpRight, Bot, Activity, Clock, TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDashboard } from '@/hooks/useDashboard'
import { formatDateTime, safetyGateConfig } from '@/lib/utils'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from 'recharts'

function StatCard({
  label, value, icon: Icon, color, linkTo,
}: {
  label: string
  value: number | string
  icon: ComponentType<{ className?: string }>
  color: string
  linkTo?: string
}) {
  const content = (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{label}</p>
            <p className="text-3xl font-bold text-navy-900">{value}</p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (linkTo) return <Link to={linkTo}>{content}</Link>
  return content
}

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboard()

  const stats = data?.data

  const evidenceChartData = stats ? [
    { name: 'Verified', value: stats.verified_statements, color: '#16a34a' },
    { name: 'Contradictions', value: stats.contradictions, color: '#dc2626' },
    { name: 'Missing', value: stats.missing_findings, color: '#7c3aed' },
    { name: 'Escalations', value: stats.escalations, color: '#d97706' },
  ] : []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-navy-800 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700 font-medium">Failed to load dashboard</p>
        <p className="text-red-600 text-sm mt-1">Please check your database connection and try again.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Clinical Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">TRUST-MED AI — Clinical Intelligence Platform</p>
        </div>
        <Link to="/patients">
          <Button>
            <Users className="w-4 h-4 mr-2" />
            New Patient
          </Button>
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Total Patients"
          value={stats?.total_patients ?? 0}
          icon={Users}
          color="bg-blue-50 text-blue-700"
          linkTo="/patients"
        />
        <StatCard
          label="Documents"
          value={stats?.total_documents ?? 0}
          icon={FileText}
          color="bg-teal-50 text-teal-700"
          linkTo="/upload"
        />
        <StatCard
          label="Verified Statements"
          value={stats?.verified_statements ?? 0}
          icon={CheckCircle2}
          color="bg-green-50 text-green-700"
        />
        <StatCard
          label="Contradictions"
          value={stats?.contradictions ?? 0}
          icon={AlertTriangle}
          color="bg-red-50 text-red-700"
          linkTo="/contradictions"
        />
        <StatCard
          label="Missing Records"
          value={stats?.missing_findings ?? 0}
          icon={Ghost}
          color="bg-purple-50 text-purple-700"
          linkTo="/ghost-records"
        />
        <StatCard
          label="Escalations"
          value={stats?.escalations ?? 0}
          icon={ArrowUpRight}
          color="bg-amber-50 text-amber-700"
          linkTo="/uncertainty"
        />
      </div>

      {/* Charts + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evidence summary pie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-navy-700" />
              Evidence Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {evidenceChartData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={evidenceChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => value > 0 ? `${name} (${value})` : ''}
                    labelLine={false}
                  >
                    {evidenceChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                No analysis data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent analyses */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-navy-700" />
              Recent Analyses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.recent_analyses?.length ? (
              <div className="space-y-3">
                {stats.recent_analyses.slice(0, 5).map(session => {
                  const gate = session.safety_gate_state ?? 'YELLOW'
                  const gateConfig = safetyGateConfig[gate as keyof typeof safetyGateConfig]
                  return (
                    <div key={session.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                      <div className={`text-xs font-bold px-2 py-1 rounded-full border ${gateConfig.border} ${gateConfig.bg} ${gateConfig.color}`}>
                        {gate}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-navy-900 truncate">
                          Patient analysis
                        </div>
                        <div className="text-xs text-gray-500">
                          {session.total_statements} statements · {session.conflicting_count} conflicts
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">{formatDateTime(session.started_at)}</div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-gray-400">
                <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No analyses yet</p>
                <Link to="/patients" className="text-xs text-navy-700 mt-1 hover:underline">
                  Upload documents to get started
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-navy-700" />
            Recent Agent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.agent_activity?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {stats.agent_activity.slice(0, 6).map(run => (
                <div key={run.id} className="p-3 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${
                      run.status === 'completed' ? 'bg-green-500' :
                      run.status === 'running' ? 'bg-blue-500 animate-pulse' :
                      run.status === 'failed' ? 'bg-red-500' :
                      'bg-gray-400'
                    }`} />
                    <span className="text-xs font-semibold text-navy-900 capitalize">
                      {run.agent_name.replace(/_/g, ' ')}
                    </span>
                    <Badge variant={
                      run.status === 'completed' ? 'success' :
                      run.status === 'failed' ? 'destructive' :
                      'info'
                    } className="ml-auto">
                      {run.status}
                    </Badge>
                  </div>
                  {run.execution_time_ms && (
                    <p className="text-xs text-gray-400">{(run.execution_time_ms / 1000).toFixed(1)}s</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">
              No agent runs yet. Run analysis on a patient to activate the agent swarm.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
