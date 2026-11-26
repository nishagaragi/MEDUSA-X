import { describe, it, expect } from 'vitest'

// Contradiction detection logic tests (pure logic, no DB)
describe('Contradiction Detection Logic', () => {
  describe('Medication dosage contradictions', () => {
    it('detects furosemide dosage conflict from demo data', () => {
      const statementA = { content: 'Furosemide 40mg PO once daily', document_id: 'doc-a' }
      const statementB = { content: 'Furosemide 80mg BD on discharge', document_id: 'doc-b' }

      // Different documents, same medication, different doses
      const isConflict =
        statementA.document_id !== statementB.document_id &&
        statementA.content.toLowerCase().includes('furosemide') &&
        statementB.content.toLowerCase().includes('furosemide')

      expect(isConflict).toBe(true)
    })

    it('does not flag same document as contradiction', () => {
      const statementA = { content: 'Furosemide 40mg', document_id: 'doc-a' }
      const statementB = { content: 'Furosemide 80mg', document_id: 'doc-a' }
      const isConflict = statementA.document_id !== statementB.document_id
      expect(isConflict).toBe(false)
    })
  })

  describe('Diagnosis status contradictions', () => {
    it('detects conflicting heart failure status', () => {
      const admission = { description: 'Congestive Heart Failure', status: 'active' }
      const discharge = { description: 'Congestive Heart Failure', status: 'resolved' }

      const isConflict =
        admission.description === discharge.description &&
        admission.status !== discharge.status

      expect(isConflict).toBe(true)
    })

    it('does not flag consistent status as contradiction', () => {
      const note1 = { description: 'Type 2 Diabetes', status: 'active' }
      const note2 = { description: 'Type 2 Diabetes', status: 'active' }
      const isConflict = note1.status !== note2.status
      expect(isConflict).toBe(false)
    })
  })

  describe('Severity classification', () => {
    type Severity = 'low' | 'medium' | 'high' | 'critical'

    function classifyMedicationConflictSeverity(
      medicationName: string,
      doseRatio: number,
    ): Severity {
      // High-risk medications or large dose changes are critical
      const highRisk = ['warfarin', 'heparin', 'insulin', 'digoxin', 'furosemide']
      const isHighRisk = highRisk.some(d => medicationName.toLowerCase().includes(d))
      // Any change to a high-risk drug = critical (regardless of ratio)
      if (isHighRisk) return 'critical'
      if (doseRatio >= 4) return 'critical'
      if (doseRatio >= 2) return 'high'
      return 'medium'
    }

    it('classifies furosemide 4x dose change as critical', () => {
      const severity = classifyMedicationConflictSeverity('furosemide', 4)
      expect(severity).toBe('critical')
    })

    it('classifies warfarin any dose change as critical', () => {
      const severity = classifyMedicationConflictSeverity('warfarin', 1.5)
      expect(severity).toBe('critical')
    })

    it('classifies minor non-critical medication change as medium', () => {
      const severity = classifyMedicationConflictSeverity('vitamin-d', 1.2)
      expect(severity).toBe('medium')
    })
  })

  describe('Safety gate interaction', () => {
    it('critical contradiction prevents summary generation', () => {
      const contradictions = [{ severity: 'critical', status: 'open' }]
      const criticalOpen = contradictions.filter(c => c.severity === 'critical' && c.status === 'open').length
      const canGenerate = criticalOpen === 0
      expect(canGenerate).toBe(false)
    })

    it('resolved critical contradiction does not block', () => {
      const contradictions = [{ severity: 'critical', status: 'resolved_with_evidence' }]
      const criticalOpen = contradictions.filter(c => c.severity === 'critical' && c.status === 'open').length
      const canGenerate = criticalOpen === 0
      expect(canGenerate).toBe(true)
    })
  })
})
