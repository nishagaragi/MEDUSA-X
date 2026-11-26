import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { EvidenceStatus, SafetyGateState, ContradictionSeverity } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return 'Unknown date'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return 'Invalid date'
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return 'Unknown'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return 'Invalid'
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return 'Unknown size'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const evidenceStatusConfig: Record<EvidenceStatus, {
  label: string
  color: string
  bg: string
  border: string
  description: string
}> = {
  verified: {
    label: 'Verified',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    description: 'Confirmed by multiple consistent sources',
  },
  supported: {
    label: 'Supported',
    color: 'text-teal-700',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    description: 'Supported by at least one source with no contradiction',
  },
  uncertain: {
    label: 'Uncertain',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    description: 'Insufficient evidence to confirm or deny',
  },
  conflicting: {
    label: 'Conflicting',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    description: 'Sources disagree — requires human review',
  },
  missing_evidence: {
    label: 'Missing Evidence',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    description: 'Referenced but no supporting documentation found',
  },
  superseded: {
    label: 'Superseded',
    color: 'text-gray-600',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    description: 'Replaced or overridden by a later statement',
  },
}

export const safetyGateConfig: Record<SafetyGateState, {
  label: string
  color: string
  bg: string
  border: string
  icon: string
  description: string
}> = {
  GREEN: {
    label: 'PROCEED',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-400',
    icon: '✓',
    description: 'Evidence is sufficiently consistent for a traceable, qualified information summary.',
  },
  YELLOW: {
    label: 'QUALIFY',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-400',
    icon: '⚠',
    description: 'Information is missing, outdated or uncertain. Supported facts shown; unresolved issues flagged.',
  },
  RED: {
    label: 'ESCALATE',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-400',
    icon: '✕',
    description: 'Critical unresolved contradiction or insufficient evidence. Conclusion blocked. Human verification required.',
  },
}

export const severityConfig: Record<ContradictionSeverity, {
  label: string
  color: string
  bg: string
}> = {
  low: { label: 'Low', color: 'text-blue-700', bg: 'bg-blue-50' },
  medium: { label: 'Medium', color: 'text-amber-700', bg: 'bg-amber-50' },
  high: { label: 'High', color: 'text-orange-700', bg: 'bg-orange-50' },
  critical: { label: 'Critical', color: 'text-red-700', bg: 'bg-red-50' },
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}…`
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
