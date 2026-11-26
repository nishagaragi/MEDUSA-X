import { useState } from 'react'
import {
  Bot, Play, AlertTriangle,
  Clock, FileSearch, Calendar, Stethoscope,
  Pill, FlaskConical, Shield, ShieldAlert,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePatients } from '@/hooks/usePatients'
import { useAgents, useRunAgents } from '@/hooks/useAnalysis'
import { AgentRun, AgentStatus } from '@/types'
import { formatDateTime, cn } from '@/lib/utils'
import type { ComponentType } from 'react'

// Fix #11: Store colors as separate fields so Tailwind JIT can statically scan them
const AGENT_META: Record<string, {
  title: string
  icon: ComponentType<{ className?: string }>
  description: string
  iconColor: string
  iconBg: string
}> = {
  document_detective: {
    title: 'Document Detective',
    icon: FileSearch,
    description: 'Classifies documents, extracts text and metadata, identifies document types.',
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
  },
  timeline_agent: {
    title: 'Timeline Agent',
    icon: Calendar,
    description: 'Reconstructs clinical chronology, detects date inconsistencies and timeline gaps.',
    iconColor: 'text-teal-600',
    iconBg: 'bg-teal-50',
  },
  diagnosis_investigator: {
    title: 'Diagnosis Investigator',
    icon: Stethoscope,
    description: 'Extracts documented diagnoses, detects conflicts and missing evidence.',
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-50',
  },
  medication_auditor: {
    title: 'Medication Auditor',
    icon: Pill,
    description: 'Reconciles medication history, detects conflicts and undocumented changes.',
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-50',
  },
  laboratory_verification_agent: {
    title: 'Lab Verification Agent',
    icon: FlaskConical,
    description: 'Extracts test names, values, units and reference ranges; flags inconsistencies.',
    iconColor: 'text-green-600',
    iconBg: 'bg-green-50',
  },
  evidence_auditor: {
    title: 'Evidence Auditor',
    icon: Shield,
    description: 'Verifies generated statements against originals and validates source references.',
    iconColor: 'text-indigo-600',
    iconBg: 'bg-indigo-50',
  },
  safety_escalation_agent: {
    title: 'Safety & Escalation Agent',
    icon: ShieldAlert,
    description: 'Evaluates unresolved contradictions, checks evidence sufficiency, blocks unsafe conclusions.',
    iconColor: 'text-red-600',
    iconBg: 'bg-red-50',
  },
}

// Fix #4: destructure agentKey and use it as fallback for AGENT_META lookup
function AgentCard({ run, agentKey }: { run?: AgentRun; agentKey: string }) {
  const meta = AGENT_META[run?.agent_name ?? agentKey] ?? {
    title: agentKey.replace(/_/g, ' '),
    icon: Bot,
    description: '',
    iconColor: 'text-gray-600',
    iconBg: 'bg-gray-50',
  }
  const Icon = meta.icon

  const statusColors: Record<AgentStatus, string> = {
    queued: 'bg-gray-100 text-gray-600',
    running: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    blocked_by_safety: 'bg-orange-100 text-orange-700',
  }

  const status = run?.status ?? 'queued'

  return (
    <Card className={cn(
      'transition-shadow',
      status === 'running' && 'ring-2 ring-blue-400',
      status === 'failed' && 'ring-2 ring-red-200',
      status === 'blocked_by_safety' && 'ring-2 ring-orange-200',
    )}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', meta.iconBg)}>
            <Icon className={cn('w-5 h-5', meta.iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-navy-900">{meta.title}</div>
            <p className="text-xs text-gray-500 mt-0.5">{meta.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', statusColors[status])}>
            {status.replace(/_/g, ' ')}
            {status === 'running' && (
              <span className="ml-1 inline-block w-2 h-2 rounded-full bg-current animate-pulse" />
            )}
          </span>
          {run?.execution_time_ms != null && (
            <span className="text-xs text-gray-400">
              <Clock className="w-3 h-3 inline mr-0.5" />
              {(run.execution_time_ms / 1000).toFixed(1)}s
            </span>
          )}
        </div>

        {run?.warnings && run.warnings.length > 0 && (
          <div className="mb-2 space-y-0.5">
            {run.warnings.slice(0, 2).map((w, i) => (
              <p key={`warn-${i}`} className="text-xs text-amber-700 flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                {w}
              </p>
            ))}
          </div>
        )}

        {run?.errors && run.errors.length > 0 && (
          <div className="space-y-0.5">
            {run.errors.slice(0, 2).map((e, i) => (
              <p key={`err-${i}`} className="text-xs text-red-700 flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                {e}
              </p>
            ))}
          </div>
        )}

        {run?.completed_at && (
          <p className="text-xs text-gray-400 mt-2">{formatDateTime(run.completed_at)}</p>
        )}

        {!run && (
          <p className="text-xs text-gray-400">Not yet activated</p>
        )}
      </CardContent>
    </Card>
  )
}

export default function AgentControlPage() {
  const { data: patientsData } = usePatients(1, 100)
  const [selectedPatient, setSelectedPatient] = useState('')
  const { data: agentsData, isLoading } = useAgents(selectedPatient || undefined)
  const { mutate: runAgents, isPending } = useRunAgents(selectedPatient)

  const agents = agentsData?.data ?? []
  const isRunning = agents.some(a => a.status === 'running' || a.status === 'queued')
  const completedCount = agents.filter(a => a.status === 'completed').length
  const failedCount = agents.filter(a => a.status === 'failed').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Agent Control Center</h1>
        <p className="text-gray-500 text-sm">
          Seven specialized AI agents working in concert. Each reports structured findings without inventing facts.
        </p>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
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

        {selectedPatient && (
          <Button
            onClick={() => runAgents()}
            loading={isPending || isRunning}
            disabled={!selectedPatient}
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Agents Running…
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run All Agents
              </>
            )}
          </Button>
        )}

        {agents.length > 0 && (
          <div className="flex gap-2 text-sm">
            <span className="text-green-700 font-medium">{completedCount} completed</span>
            {failedCount > 0 && <span className="text-red-700 font-medium">{failedCount} failed</span>}
            {isRunning && <span className="text-blue-700 font-medium animate-pulse">Running…</span>}
          </div>
        )}
      </div>

      {agents.some(a => a.status === 'blocked_by_safety') && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-orange-800">Safety Gate Active</p>
            <p className="text-sm text-orange-700">
              One or more agents were blocked by the Safety &amp; Escalation Agent.
              Unsafe conclusions have not been generated. Human review required.
            </p>
          </div>
        </div>
      )}

      {!selectedPatient ? (
        <div className="text-center py-16 text-gray-400">
          <Bot className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Select a patient to view the Clinical Detective Swarm</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-navy-800 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Object.keys(AGENT_META).map(key => {
            const run = agents.find(a => a.agent_name === key)
            return <AgentCard key={key} agentKey={key} run={run} />
          })}
        </div>
      )}
    </div>
  )
}
