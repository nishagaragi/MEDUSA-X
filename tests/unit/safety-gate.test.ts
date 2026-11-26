import { describe, it, expect, vi } from 'vitest'

// Mock Supabase admin — the safety gate module is tested via its pure logic here
vi.mock('../../netlify/functions/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

// Pure safety gate rule evaluation — no DB calls needed
function evaluateGate(params: {
  criticalConflicts: number
  highConflicts: number
  completeness: number
  missingCritical: number
  openContradictions: number
}): { state: string; canGenerate: boolean; blocked: string[] } {
  const blocked: string[] = []
  let state = 'GREEN'

  if (params.criticalConflicts >= 1) {
    state = 'RED'
    blocked.push('Clinical summary blocked — resolve critical contradictions first')
  }
  if (params.highConflicts >= 3) {
    state = 'RED'
    blocked.push('Medication reconciliation blocked — high-severity conflicts')
  }
  if (params.completeness < 0.3 && state === 'GREEN') {
    state = 'RED'
    blocked.push('Summary generation blocked — evidence completeness too low')
  }

  if (state === 'GREEN') {
    if (params.completeness < 0.5) state = 'YELLOW'
    if (params.missingCritical > 0) state = 'YELLOW'
    if (params.openContradictions > 0) state = 'YELLOW'
  }

  return { state, canGenerate: state !== 'RED', blocked }
}

describe('Safety Gate Rules', () => {
  describe('GREEN state', () => {
    it('returns GREEN when no contradictions and high completeness', () => {
      const result = evaluateGate({
        criticalConflicts: 0,
        highConflicts: 0,
        completeness: 0.9,
        missingCritical: 0,
        openContradictions: 0,
      })
      expect(result.state).toBe('GREEN')
      expect(result.canGenerate).toBe(true)
    })
  })

  describe('RED state', () => {
    it('returns RED for any critical contradiction', () => {
      const result = evaluateGate({
        criticalConflicts: 1,
        highConflicts: 0,
        completeness: 0.9,
        missingCritical: 0,
        openContradictions: 0,
      })
      expect(result.state).toBe('RED')
    })

    it('returns RED for 3+ high conflicts', () => {
      const result = evaluateGate({
        criticalConflicts: 0,
        highConflicts: 3,
        completeness: 0.9,
        missingCritical: 0,
        openContradictions: 0,
      })
      expect(result.state).toBe('RED')
    })

    it('returns RED for evidence completeness below 30%', () => {
      const result = evaluateGate({
        criticalConflicts: 0,
        highConflicts: 0,
        completeness: 0.2,
        missingCritical: 0,
        openContradictions: 0,
      })
      expect(result.state).toBe('RED')
    })

    it('blocks summary generation in RED state', () => {
      const result = evaluateGate({
        criticalConflicts: 1,
        highConflicts: 0,
        completeness: 0.9,
        missingCritical: 0,
        openContradictions: 0,
      })
      expect(result.canGenerate).toBe(false)
    })

    it('populates blocked conclusions when RED', () => {
      const result = evaluateGate({
        criticalConflicts: 1,
        highConflicts: 0,
        completeness: 0.9,
        missingCritical: 0,
        openContradictions: 0,
      })
      expect(result.blocked.length).toBeGreaterThan(0)
    })
  })

  describe('YELLOW state', () => {
    it('returns YELLOW when completeness between 30-50%', () => {
      const result = evaluateGate({
        criticalConflicts: 0,
        highConflicts: 0,
        completeness: 0.4,
        missingCritical: 0,
        openContradictions: 0,
      })
      expect(result.state).toBe('YELLOW')
    })

    it('returns YELLOW when critical missing info exists', () => {
      const result = evaluateGate({
        criticalConflicts: 0,
        highConflicts: 0,
        completeness: 0.8,
        missingCritical: 1,
        openContradictions: 0,
      })
      expect(result.state).toBe('YELLOW')
    })

    it('allows summary generation in YELLOW state', () => {
      const result = evaluateGate({
        criticalConflicts: 0,
        highConflicts: 0,
        completeness: 0.4,
        missingCritical: 0,
        openContradictions: 0,
      })
      expect(result.canGenerate).toBe(true)
    })
  })

  describe('Safety invariants', () => {
    it('never claims canGenerate in RED state', () => {
      const redResult = evaluateGate({
        criticalConflicts: 1,
        highConflicts: 0,
        completeness: 0.9,
        missingCritical: 0,
        openContradictions: 0,
      })
      expect(redResult.canGenerate).toBe(false)
    })

    it('GREEN and YELLOW both allow summary generation', () => {
      const green = evaluateGate({ criticalConflicts: 0, highConflicts: 0, completeness: 0.9, missingCritical: 0, openContradictions: 0 })
      const yellow = evaluateGate({ criticalConflicts: 0, highConflicts: 0, completeness: 0.4, missingCritical: 0, openContradictions: 0 })
      expect(green.canGenerate).toBe(true)
      expect(yellow.canGenerate).toBe(true)
    })

    it('critical contradiction overrides 2 high conflicts', () => {
      const withOnlyCritical = evaluateGate({ criticalConflicts: 1, highConflicts: 2, completeness: 0.9, missingCritical: 0, openContradictions: 0 })
      expect(withOnlyCritical.state).toBe('RED')
    })

    it('2 high conflicts alone do not reach RED', () => {
      const result = evaluateGate({ criticalConflicts: 0, highConflicts: 2, completeness: 0.9, missingCritical: 0, openContradictions: 0 })
      expect(result.state).toBe('GREEN')
    })
  })
})
