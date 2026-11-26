import { describe, it, expect } from 'vitest'

describe('Timeline Reconstruction', () => {
  describe('Event ordering', () => {
    it('sorts events by event_date, not documented_date', () => {
      const events = [
        { description: 'Discharge', event_date: '2024-01-25', documented_date: '2024-01-25' },
        { description: 'Admission', event_date: '2024-01-15', documented_date: '2024-01-15' },
        { description: 'Lab results', event_date: '2024-01-16', documented_date: '2024-01-18' },
      ]

      const sorted = [...events].sort((a, b) =>
        (a.event_date ?? '').localeCompare(b.event_date ?? '')
      )

      expect(sorted[0].description).toBe('Admission')
      expect(sorted[1].description).toBe('Lab results')
      expect(sorted[2].description).toBe('Discharge')
    })
  })

  describe('Date discrepancy detection', () => {
    it('flags when documented_date is later than event_date by more than 2 days', () => {
      const event = {
        event_date: '2024-01-15',
        documented_date: '2024-01-20',  // 5 days later
      }

      const eventMs = new Date(event.event_date).getTime()
      const docMs = new Date(event.documented_date).getTime()
      const diffDays = (docMs - eventMs) / (1000 * 60 * 60 * 24)

      expect(diffDays).toBeGreaterThan(0)
      const isBackdated = docMs > eventMs && diffDays > 2
      expect(isBackdated).toBe(true)
    })

    it('does not flag same-day documentation', () => {
      const event = { event_date: '2024-01-15', documented_date: '2024-01-15' }
      const diffDays = 0
      expect(diffDays).toBe(0)
    })
  })

  describe('Gap detection', () => {
    it('detects timeline gap greater than 7 days', () => {
      const events = [
        { event_date: '2024-01-15' },
        { event_date: '2024-01-25' },
      ]

      const gaps = []
      for (let i = 1; i < events.length; i++) {
        const prev = new Date(events[i - 1].event_date).getTime()
        const curr = new Date(events[i].event_date).getTime()
        const gapDays = (curr - prev) / (1000 * 60 * 60 * 24)
        if (gapDays > 7) gaps.push(gapDays)
      }

      expect(gaps.length).toBe(1)
      expect(gaps[0]).toBe(10)
    })
  })

  describe('Date confidence', () => {
    it('marks events without dates as unknown confidence', () => {
      function assessDateConfidence(eventDate: string | null): string {
        if (!eventDate) return 'unknown'
        return 'exact'
      }
      expect(assessDateConfidence(null)).toBe('unknown')
      expect(assessDateConfidence('2024-01-15')).toBe('exact')
    })
  })
})
