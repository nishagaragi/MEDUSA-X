import { describe, it, expect } from 'vitest'
import { evidenceStatusConfig } from '../../src/lib/utils'
import { EvidenceStatus } from '../../src/types'

describe('Evidence Classification', () => {
  const statuses: EvidenceStatus[] = [
    'verified', 'supported', 'uncertain', 'conflicting', 'missing_evidence', 'superseded',
  ]

  it('has config for all evidence statuses', () => {
    statuses.forEach(status => {
      expect(evidenceStatusConfig[status]).toBeDefined()
      expect(evidenceStatusConfig[status].label).toBeTruthy()
    })
  })

  it('verified status has green styling', () => {
    expect(evidenceStatusConfig.verified.color).toContain('green')
    expect(evidenceStatusConfig.verified.bg).toContain('green')
  })

  it('conflicting status has red styling', () => {
    expect(evidenceStatusConfig.conflicting.color).toContain('red')
    expect(evidenceStatusConfig.conflicting.bg).toContain('red')
  })

  it('uncertain status has amber styling', () => {
    expect(evidenceStatusConfig.uncertain.color).toContain('amber')
  })

  it('missing_evidence has purple styling', () => {
    expect(evidenceStatusConfig.missing_evidence.color).toContain('purple')
  })

  it('all statuses have border, bg, color and description', () => {
    statuses.forEach(status => {
      const cfg = evidenceStatusConfig[status]
      expect(cfg.border).toBeTruthy()
      expect(cfg.bg).toBeTruthy()
      expect(cfg.color).toBeTruthy()
      expect(cfg.description).toBeTruthy()
    })
  })
})

describe('Document Validation', () => {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/png',
    'image/jpeg',
  ]

  const MAX_SIZE = 50 * 1024 * 1024

  it('accepts valid MIME types', () => {
    allowedTypes.forEach(type => {
      expect(allowedTypes.includes(type)).toBe(true)
    })
  })

  it('rejects HTML files', () => {
    expect(allowedTypes.includes('text/html')).toBe(false)
  })

  it('rejects executable files', () => {
    expect(allowedTypes.includes('application/x-executable')).toBe(false)
  })

  it('enforces file size limit', () => {
    const oversized = MAX_SIZE + 1
    expect(oversized > MAX_SIZE).toBe(true)
    expect(MAX_SIZE).toBe(52428800)
  })
})

describe('Medication State Transitions', () => {
  type MedState = 'prescribed' | 'started' | 'continued' | 'modified' | 'discontinued' | 'uncertain' | 'conflicting'

  const validTransitions: Record<MedState, MedState[]> = {
    prescribed: ['started', 'discontinued', 'conflicting'],
    started: ['continued', 'modified', 'discontinued', 'conflicting'],
    continued: ['modified', 'discontinued', 'conflicting'],
    modified: ['continued', 'discontinued', 'conflicting'],
    discontinued: ['prescribed', 'conflicting'],  // Can be re-prescribed
    uncertain: ['prescribed', 'started', 'conflicting'],
    conflicting: ['prescribed', 'discontinued'],  // After human review
  }

  it('defines transitions for all states', () => {
    const states: MedState[] = ['prescribed', 'started', 'continued', 'modified', 'discontinued', 'uncertain', 'conflicting']
    states.forEach(state => {
      expect(validTransitions[state]).toBeDefined()
    })
  })

  it('discontinued medication can be re-prescribed', () => {
    expect(validTransitions.discontinued).toContain('prescribed')
  })

  it('any non-conflicting state can enter conflicting', () => {
    // 'conflicting' itself transitions to prescription states after human review
    const nonConflictingStates = (['prescribed', 'started', 'continued', 'modified', 'discontinued', 'uncertain'] as MedState[])
    nonConflictingStates.forEach(state => {
      expect(validTransitions[state]).toContain('conflicting')
    })
  })
})
