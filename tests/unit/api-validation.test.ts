import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// API validation schemas mirroring backend
const CreatePatientSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  mrn: z.string().optional(),
  blood_type: z.string().optional(),
  allergies: z.array(z.string()).default([]),
})

const ReviewContradictionSchema = z.object({
  status: z.enum([
    'confirmed_discrepancy',
    'resolved_with_evidence',
    'requires_more_documentation',
    'escalated',
  ]),
  resolution_note: z.string().optional(),
})

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1),
  organization_name: z.string().optional(),
})

describe('API Input Validation', () => {
  describe('Patient creation', () => {
    it('accepts valid patient data', () => {
      const valid = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '1980-01-01',
        gender: 'Male',
      }
      expect(CreatePatientSchema.safeParse(valid).success).toBe(true)
    })

    it('rejects empty first name', () => {
      const invalid = { first_name: '', last_name: 'Doe' }
      expect(CreatePatientSchema.safeParse(invalid).success).toBe(false)
    })

    it('rejects missing required fields', () => {
      const invalid = { first_name: 'John' }  // missing last_name
      expect(CreatePatientSchema.safeParse(invalid).success).toBe(false)
    })

    it('allergies defaults to empty array', () => {
      const minimal = { first_name: 'John', last_name: 'Doe' }
      const result = CreatePatientSchema.safeParse(minimal)
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.allergies).toEqual([])
    })
  })

  describe('Contradiction review', () => {
    it('accepts valid review status', () => {
      const valid = { status: 'confirmed_discrepancy', resolution_note: 'Verified with original records' }
      expect(ReviewContradictionSchema.safeParse(valid).success).toBe(true)
    })

    it('rejects unknown status', () => {
      const invalid = { status: 'just_ignore_it' }
      expect(ReviewContradictionSchema.safeParse(invalid).success).toBe(false)
    })

    it('resolution_note is optional', () => {
      const minimal = { status: 'escalated' }
      expect(ReviewContradictionSchema.safeParse(minimal).success).toBe(true)
    })
  })

  describe('Registration', () => {
    it('accepts valid registration', () => {
      const valid = { email: 'test@example.com', password: 'secure123', full_name: 'Dr Smith' }
      expect(RegisterSchema.safeParse(valid).success).toBe(true)
    })

    it('rejects invalid email', () => {
      const invalid = { email: 'not-an-email', password: 'secure123', full_name: 'Dr Smith' }
      expect(RegisterSchema.safeParse(invalid).success).toBe(false)
    })

    it('rejects password shorter than 8 characters', () => {
      const invalid = { email: 'test@example.com', password: 'short', full_name: 'Dr Smith' }
      expect(RegisterSchema.safeParse(invalid).success).toBe(false)
    })
  })

  describe('Evidence status values', () => {
    const EvidenceStatusSchema = z.enum([
      'verified', 'supported', 'uncertain', 'conflicting', 'missing_evidence', 'superseded',
    ])

    it('accepts all valid evidence statuses', () => {
      const valid = ['verified', 'supported', 'uncertain', 'conflicting', 'missing_evidence', 'superseded']
      valid.forEach(s => {
        expect(EvidenceStatusSchema.safeParse(s).success).toBe(true)
      })
    })

    it('rejects unknown evidence status from AI', () => {
      const invalid = ['high_confidence', 'probably_true', 'AI_verified', '']
      invalid.forEach(s => {
        expect(EvidenceStatusSchema.safeParse(s).success).toBe(false)
      })
    })
  })
})
