/**
 * TRUST-MED AI — Client-side Clinical NLP Engine
 *
 * Extracts clinical information from document text without an AI API.
 * Uses rule-based pattern matching grounded in what the text actually says.
 * Every finding is linked to the source page and exact supporting text.
 *
 * PRINCIPLE: If the text does not say it, we do not report it.
 * We never fabricate diagnoses, medications, or values.
 */

import { ExtractionResult, ExtractedPage } from './pdfExtractor'
import {
  Diagnosis, Medication, MedicationEvent, LaboratoryResult,
  ClinicalEvent, Contradiction, MissingInformation,
  EvidenceStatus, MedicationState, ClinicalEventCategory,
} from '@/types'

// ============================================================
// Pattern libraries
// ============================================================

const DIAGNOSIS_PATTERNS: { pattern: RegExp; icd?: string; category: string }[] = [
  { pattern: /(?:diagnosed?\s+with|diagnosis[:\s]+|known\s+)([A-Za-z\s]+(?:failure|disease|disorder|syndrome|mellitus|hypertension|diabetes|cancer|infection|pneumonia|sepsis|stroke|infarction|fibrillation|ischemia|insufficiency)[^.;,\n]{0,60})/gi, category: 'primary' },
  { pattern: /(?:history\s+of|background:|past\s+medical\s+history[:\s]*)([A-Za-z\s,]+(?:failure|disease|disorder|syndrome|mellitus|hypertension|diabetes|cancer|infection|pneumonia|sepsis|stroke|infarction|fibrillation|ischemia|insufficiency)[^.;\n]{0,60})/gi, category: 'background' },
  { pattern: /(?:admitted\s+with|presenting\s+with|presenting\s+complaint[:\s]*)([^.;\n]{5,80})/gi, category: 'presenting' },
  { pattern: /(?:ICD[-\s]?\d{1,2}[-\s]?\d{0,4}[-\s]?\w?[:\s]+)([^.;\n]{5,60})/gi, category: 'icd_coded' },
]

const MEDICATION_PATTERNS: { pattern: RegExp }[] = [
  { pattern: /([A-Z][a-z]+(?:in|ol|il|am|ide|ate|ine|one|acid|umab|mab|zole|pril|artan|statin|mycin|cillin|cyclin|zosin|ipine|lam|zepam|pam|apine|done|dine|xetine|traline|amide|zide|furan|mide|fen|ifen|fen|profen|phen|fen))\s*(\d+\s*(?:mg|mcg|μg|iu|IU|g|ml|%)?)\s*(?:([\w\s]+(?:daily|twice|once|three|four|bd|tds|qds|od|bid|tid|qid|hs|prn|PRN|stat|STAT)))?/g },
  { pattern: /([A-Z][a-z]+(?:umab|zumab|ximab|kinumab|lizumab))\s*(\d+\s*(?:mg|mcg|g))/g },
  { pattern: /(?:prescribed?|started?|commenced?|continue(?:d|s)?|given|administered)[:\s]+([A-Z][a-z]+\w*)\s*(\d+\s*(?:mg|mcg|g|ml))/gi },
  { pattern: /(?:stopped?|discontinued?|ceased?|withheld)[:\s]+([A-Z][a-z]+\w*)/gi },
]

const LAB_PATTERNS: { pattern: RegExp; name?: string }[] = [
  { pattern: /(?:creatinine|Creatinine)[:\s]*(\d+(?:\.\d+)?)\s*(μmol\/L|umol\/L|mg\/dL|mmol\/L)/gi },
  { pattern: /(?:eGFR|GFR)[:\s]*(\d+(?:\.\d+)?)\s*(mL\/min(?:\/1\.73m²)?|ml\/min)/gi },
  { pattern: /(?:BNP|NT-proBNP|NT proBNP)[:\s]*(\d+(?:\.\d+)?)\s*(pg\/mL|ng\/L|pmol\/L)/gi },
  { pattern: /(?:haemoglobin|hemoglobin|Hb)[:\s]*(\d+(?:\.\d+)?)\s*(g\/dL|g\/L|mmol\/L)/gi },
  { pattern: /(?:potassium|K\+?)[:\s]*(\d+(?:\.\d+)?)\s*(mmol\/L|mEq\/L)/gi },
  { pattern: /(?:sodium|Na\+?)[:\s]*(\d+(?:\.\d+)?)\s*(mmol\/L|mEq\/L)/gi },
  { pattern: /(?:glucose|blood\s+glucose|BSL|BGL)[:\s]*(\d+(?:\.\d+)?)\s*(mmol\/L|mg\/dL)/gi },
  { pattern: /(?:HbA1c|A1C|glycated\s+haemoglobin)[:\s]*(\d+(?:\.\d+)?)\s*(%|mmol\/mol)/gi },
  { pattern: /(?:troponin|Troponin(?:\s+[IT])?)[:\s]*(\d+(?:\.\d+)?)\s*(ng\/mL|μg\/L|ng\/L|pg\/mL)/gi },
  { pattern: /(?:LVEF|ejection\s+fraction|EF)[:\s]*(\d+)\s*(%|percent)/gi },
  { pattern: /(?:WBC|white\s+(?:blood\s+)?cell)[:\s]*(\d+(?:\.\d+)?)\s*(?:×\s*10[⁹9]\/L|\/mm³|cells\/μL)/gi },
  { pattern: /(?:platelet|PLT)[:\s]*(\d+(?:\.\d+)?)\s*(?:×\s*10[⁹9]\/L|\/mm³)/gi },
  { pattern: /(?:ALT|alanine\s+(?:amino)?transferase)[:\s]*(\d+(?:\.\d+)?)\s*(?:U\/L|IU\/L)/gi },
  { pattern: /(?:INR)[:\s]*(\d+(?:\.\d+)?)/gi },
  { pattern: /(?:TSH|thyroid\s+stimulating)[:\s]*(\d+(?:\.\d+)?)\s*(mIU\/L|mU\/L)/gi },
  { pattern: /(?:CRP|C-reactive\s+protein)[:\s]*(\d+(?:\.\d+)?)\s*(mg\/L|mg\/dL)/gi },
]

const TIMELINE_PATTERNS: { pattern: RegExp; category: ClinicalEventCategory }[] = [
  { pattern: /(?:admitted|admission|presented\s+to\s+(?:ED|A&E|hospital|ward))[^.;\n]{0,80}/gi, category: 'admission' },
  { pattern: /(?:discharged?|discharge\s+(?:from|date|summary))[^.;\n]{0,80}/gi, category: 'discharge' },
  { pattern: /(?:procedure|operation|surgery|surgical)[^.;\n]{0,80}/gi, category: 'procedure' },
  { pattern: /(?:referred?|referral|transferred?|consultation\s+(?:with|from|to))[^.;\n]{0,80}/gi, category: 'consultation' },
  { pattern: /(?:prescribed?|started?\s+on|commenced?)[^.;\n]{0,80}/gi, category: 'prescription' },
  { pattern: /(?:test\s+ordered?|investigation\s+ordered?|sent\s+for|requested)[^.;\n]{0,80}/gi, category: 'investigation' },
]

const DATE_PATTERNS = [
  /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/g,
  /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/gi,
  /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
]

const MISSING_PATTERNS = [
  { pattern: /(?:awaiting?|pending|results?\s+to\s+follow|not\s+yet\s+available|outstanding)[^.;\n]{0,80}/gi, type: 'missing_result' as const },
  { pattern: /(?:report\s+not\s+(?:available|found|received)|no\s+report|missing\s+(?:report|result|document))[^.;\n]{0,80}/gi, type: 'missing_document' as const },
  { pattern: /(?:reason\s+not\s+documented?|undocumented?|without\s+(?:documentation|reason|note))[^.;\n]{0,80}/gi, type: 'undocumented_treatment_change' as const },
  { pattern: /(?:referred?\s+for|ordered?|requested?)[^.;\n]{0,80}(?:no\s+result|result\s+not|not\s+completed?)[^.;\n]{0,80}/gi, type: 'missing_result' as const },
]

const DOCUMENT_TYPE_PATTERNS: { keywords: string[]; type: string }[] = [
  { keywords: ['admission note', 'admitted', 'emergency department', 'presenting complaint', 'ED attendance'], type: 'admission_note' },
  { keywords: ['discharge summary', 'discharged', 'discharge letter', 'discharge plan'], type: 'discharge_summary' },
  { keywords: ['progress note', 'ward round', 'progress', 'nursing note'], type: 'progress_note' },
  { keywords: ['lab report', 'laboratory', 'pathology', 'blood results', 'investigation results'], type: 'lab_report' },
  { keywords: ['prescription', 'prescribed', 'medication chart', 'drug chart', 'pharmacy'], type: 'prescription' },
  { keywords: ['operation', 'surgery', 'operative note', 'surgical', 'anaesthetic'], type: 'operation_report' },
  { keywords: ['radiology', 'imaging', 'x-ray', 'ct scan', 'mri', 'ultrasound', 'echo'], type: 'radiology_report' },
  { keywords: ['consultation', 'referral', 'specialist'], type: 'consultation_note' },
]

// ============================================================
// Utility functions
// ============================================================

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function extractFirstDate(text: string): string | undefined {
  const monthNames: Record<string, string> = {
    jan: '01', january: '01', feb: '02', february: '02',
    mar: '03', march: '03', apr: '04', april: '04',
    may: '05', jun: '06', june: '06', jul: '07', july: '07',
    aug: '08', august: '08', sep: '09', september: '09',
    oct: '10', october: '10', nov: '11', november: '11',
    dec: '12', december: '12',
  }

  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = text.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // Try DD Month YYYY
  const dmy2Match = text.match(/\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})\b/i)
  if (dmy2Match) {
    const [, d, m, y] = dmy2Match
    const month = monthNames[m.toLowerCase().slice(0, 3)]
    if (month) return `${y}-${month}-${d.padStart(2, '0')}`
  }

  return undefined
}

function classifyDocumentType(text: string): string {
  const lower = text.toLowerCase()
  for (const { keywords, type } of DOCUMENT_TYPE_PATTERNS) {
    if (keywords.some(k => lower.includes(k))) return type
  }
  return 'unknown'
}

function generateId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

function truncate(text: string, max = 200): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

function assessEvidenceStatus(
  text: string,
  context: string,
): EvidenceStatus {
  const lower = text.toLowerCase()
  const ctxLower = context.toLowerCase()

  if (
    lower.includes('confirmed') || lower.includes('verified') ||
    /\d+(?:\.\d+)?\s*(?:mg|mmol|μmol|pg|ng|g|%|mL)/.test(text)
  ) return 'verified'

  if (
    lower.includes('possible') || lower.includes('query') || lower.includes('?') ||
    lower.includes('suspected') || lower.includes('likely') || lower.includes('probable')
  ) return 'uncertain'

  if (
    lower.includes('no evidence') || lower.includes('not documented') ||
    lower.includes('not recorded') || lower.includes('awaiting')
  ) return 'missing_evidence'

  if (
    lower.includes('discontinued') || lower.includes('stopped') || lower.includes('changed from')
  ) return 'superseded'

  return 'supported'
}

// ============================================================
// DIAGNOSIS EXTRACTOR
// ============================================================

export function extractDiagnoses(
  pages: ExtractedPage[],
  patientId: string,
  documentId: string,
): Diagnosis[] {
  const diagnoses: Diagnosis[] = []
  const seen = new Set<string>()

  for (const page of pages) {
    for (const { pattern } of DIAGNOSIS_PATTERNS) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(page.text)) !== null) {
        const rawDescription = cleanText(match[1] ?? match[0])
        if (rawDescription.length < 4 || rawDescription.length > 120) continue

        // Normalise to prevent exact duplicates
        const key = rawDescription.toLowerCase().replace(/\s+/g, ' ')
        if (seen.has(key)) continue
        seen.add(key)

        const sourceText = truncate(match[0])
        const evidenceStatus = assessEvidenceStatus(rawDescription, page.text)
        const docDate = extractFirstDate(page.text)

        // Determine status
        let status = 'active'
        const lower = rawDescription.toLowerCase()
        if (lower.includes('resolved') || lower.includes('cured') || lower.includes('no longer')) status = 'resolved'
        if (lower.includes('suspected') || lower.includes('possible') || lower.includes('query')) status = 'suspected'
        if (lower.includes('ruled out') || lower.includes('excluded')) status = 'ruled_out'

        diagnoses.push({
          id: generateId(),
          patient_id: patientId,
          document_id: documentId,
          description: rawDescription,
          status,
          onset_date: docDate,
          evidence_status: evidenceStatus,
          source_page: page.pageNumber,
          source_text: sourceText,
          created_at: now(),
          updated_at: now(),
        })
      }
    }
  }

  return diagnoses.slice(0, 20) // cap at 20 per document
}

// ============================================================
// MEDICATION EXTRACTOR
// ============================================================

export function extractMedications(
  pages: ExtractedPage[],
  patientId: string,
  documentId: string,
): { medications: Partial<Medication>[]; events: Partial<MedicationEvent>[] } {
  const medications: Partial<Medication>[] = []
  const events: Partial<MedicationEvent>[] = []
  const seen = new Set<string>()

  for (const page of pages) {
    const text = page.text

    // Check for stopped/discontinued medications
    const stopPattern = /(?:stopped?|discontinued?|ceased?|withheld?)[:\s]+([A-Z][a-z]+\w*)/gi
    let stopMatch
    while ((stopMatch = stopPattern.exec(text)) !== null) {
      const name = cleanText(stopMatch[1])
      if (name.length < 3) continue
      const key = name.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        const id = generateId()
        medications.push({
          id,
          patient_id: patientId,
          name,
          current_state: 'discontinued' as MedicationState,
          evidence_status: 'supported' as EvidenceStatus,
          has_conflicts: false,
          created_at: now(),
        })
        events.push({
          id: generateId(),
          medication_id: id,
          patient_id: patientId,
          document_id: documentId,
          event_type: 'discontinued' as MedicationState,
          event_date: extractFirstDate(text),
          evidence_status: 'supported' as EvidenceStatus,
          source_page: page.pageNumber,
          source_text: truncate(stopMatch[0]),
          created_at: now(),
        })
      }
    }

    // Extract medications with dosages
    const medPattern = /\b([A-Z][a-z]+(?:in|ol|il|am|ide|ate|ine|one|acid|umab|mab|zole|pril|artan|statin|mycin|cillin|cyclin|zosin|ipine|lam|zepam|pam|apine|done|dine|xetine|traline|amide|zide|furan|mide|fen|ifen|profen|phen))\b\s*(\d+\s*(?:mg|mcg|μg|g|ml|%)?)?/g
    let medMatch
    while ((medMatch = medPattern.exec(text)) !== null) {
      const name = cleanText(medMatch[1])
      if (name.length < 4 || name.length > 30) continue
      // Skip common non-medication words
      const skipWords = ['taken', 'given', 'using', 'other', 'their', 'these', 'those', 'being', 'doing', 'having', 'getting']
      if (skipWords.includes(name.toLowerCase())) continue

      const dosage = medMatch[2] ? cleanText(medMatch[2]) : undefined
      const key = name.toLowerCase()

      let eventType: MedicationState = 'prescribed'
      const surrounding = text.slice(Math.max(0, medMatch.index - 50), medMatch.index + 100).toLowerCase()
      if (surrounding.includes('started')) eventType = 'started'
      if (surrounding.includes('continu')) eventType = 'continued'
      if (surrounding.includes('modif') || surrounding.includes('changed') || surrounding.includes('adjust')) eventType = 'modified'
      if (surrounding.includes('stopped') || surrounding.includes('discontinued')) eventType = 'discontinued'
      if (surrounding.includes('uncertain') || surrounding.includes('unclear')) eventType = 'uncertain'

      if (!seen.has(key)) {
        seen.add(key)
        const id = generateId()
        medications.push({
          id,
          patient_id: patientId,
          name,
          current_state: eventType,
          evidence_status: dosage ? 'verified' : 'supported' as EvidenceStatus,
          has_conflicts: false,
          created_at: now(),
        })
        events.push({
          id: generateId(),
          medication_id: id,
          patient_id: patientId,
          document_id: documentId,
          event_type: eventType,
          dosage,
          event_date: extractFirstDate(text),
          evidence_status: dosage ? 'verified' : 'supported' as EvidenceStatus,
          source_page: page.pageNumber,
          source_text: truncate(medMatch[0]),
          created_at: now(),
        })
      }
    }
  }

  return { medications: medications.slice(0, 15), events: events.slice(0, 30) }
}

// ============================================================
// LAB RESULTS EXTRACTOR
// ============================================================

export function extractLabResults(
  pages: ExtractedPage[],
  patientId: string,
  documentId: string,
): LaboratoryResult[] {
  const results: LaboratoryResult[] = []
  const seen = new Set<string>()

  for (const page of pages) {
    for (const { pattern } of LAB_PATTERNS) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(page.text)) !== null) {
        const fullMatch = match[0]
        const value = match[1]
        const unit = match[2] ?? ''

        // Extract test name from the beginning of the match
        const testNameMatch = fullMatch.match(/^([A-Za-z\s\-+()0-9]+?)(?:\s*[:=]?\s*\d)/)
        const testName = testNameMatch ? cleanText(testNameMatch[1]) : cleanText(fullMatch.split(/[\d:]/)[0])
        if (testName.length < 2) continue

        const key = `${testName.toLowerCase()}_${value}`
        if (seen.has(key)) continue
        seen.add(key)

        const numericValue = value ? parseFloat(value) : undefined
        const isAbnormal = detectAbnormal(testName, numericValue, unit)
        const isCritical = detectCritical(testName, numericValue, unit)
        const evidenceStatus: EvidenceStatus = numericValue !== undefined ? 'verified' : 'missing_evidence'

        results.push({
          id: generateId(),
          patient_id: patientId,
          document_id: documentId,
          test_name: testName,
          value: value ?? undefined,
          numeric_value: numericValue,
          unit: unit || undefined,
          reference_range_low: getReferenceRangeLow(testName, unit),
          reference_range_high: getReferenceRangeHigh(testName, unit),
          is_abnormal: isAbnormal,
          is_critical: isCritical,
          sample_date: extractFirstDate(page.text),
          status: 'available',
          evidence_status: evidenceStatus,
          source_page: page.pageNumber,
          source_text: truncate(fullMatch),
          created_at: now(),
        })
      }
    }

    // Also detect referenced-but-missing results
    const missingLabPattern = /(?:awaiting?|pending|not\s+yet\s+available)\s+([A-Za-z\s]+(?:result|report|scan|echo|biopsy|culture))[^.;\n]{0,60}/gi
    let missingMatch
    while ((missingMatch = missingLabPattern.exec(page.text)) !== null) {
      const testName = cleanText(missingMatch[1])
      const key = `missing_${testName.toLowerCase()}`
      if (!seen.has(key) && testName.length > 3) {
        seen.add(key)
        results.push({
          id: generateId(),
          patient_id: patientId,
          document_id: documentId,
          test_name: testName,
          value: undefined,
          is_critical: false,
          sample_date: extractFirstDate(page.text),
          status: 'missing',
          evidence_status: 'missing_evidence',
          source_page: page.pageNumber,
          source_text: truncate(missingMatch[0]),
          created_at: now(),
        })
      }
    }
  }

  return results.slice(0, 20)
}

function detectAbnormal(testName: string, value: number | undefined, unit: string): boolean | undefined {
  if (value === undefined) return undefined
  const name = testName.toLowerCase()
  if (name.includes('creatinine') && value > 110) return true
  if (name.includes('egfr') && value < 60) return true
  if (name.includes('bnp') && value > 400) return true
  if (name.includes('potassium') && (value < 3.5 || value > 5.5)) return true
  if (name.includes('sodium') && (value < 135 || value > 145)) return true
  if (name.includes('inr') && value > 3.0) return true
  if (name.includes('troponin') && value > 0.04) return true
  if (name.includes('hba1c') && value > 7.0 && unit.includes('%')) return true
  return undefined
}

function detectCritical(testName: string, value: number | undefined, unit: string): boolean {
  if (value === undefined) return false
  const name = testName.toLowerCase()
  if (name.includes('potassium') && (value < 2.5 || value > 6.5)) return true
  if (name.includes('sodium') && (value < 120 || value > 160)) return true
  if (name.includes('bnp') && value > 1000) return true
  if (name.includes('troponin') && value > 1.0) return true
  if (name.includes('inr') && value > 5.0) return true
  if (name.includes('egfr') && value < 15) return true
  return false
}

function getReferenceRangeLow(testName: string, unit: string): number | undefined {
  const name = testName.toLowerCase()
  if (name.includes('creatinine') && unit.includes('μmol')) return 44
  if (name.includes('egfr')) return 60
  if (name.includes('bnp')) return 0
  if (name.includes('potassium')) return 3.5
  if (name.includes('sodium')) return 135
  if (name.includes('haemoglobin') || name.includes('hemoglobin')) return 11.5
  return undefined
}

function getReferenceRangeHigh(testName: string, unit: string): number | undefined {
  const name = testName.toLowerCase()
  if (name.includes('creatinine') && unit.includes('μmol')) return 97
  if (name.includes('bnp')) return 100
  if (name.includes('potassium')) return 5.0
  if (name.includes('sodium')) return 145
  if (name.includes('haemoglobin') || name.includes('hemoglobin')) return 16.5
  if (name.includes('inr')) return 3.0
  return undefined
}

// ============================================================
// TIMELINE EXTRACTOR
// ============================================================

export function extractTimeline(
  pages: ExtractedPage[],
  patientId: string,
  documentId: string,
): ClinicalEvent[] {
  const events: ClinicalEvent[] = []
  const seen = new Set<string>()

  for (const page of pages) {
    for (const { pattern, category } of TIMELINE_PATTERNS) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(page.text)) !== null) {
        const description = cleanText(match[0])
        if (description.length < 10 || description.length > 200) continue
        const key = description.toLowerCase().slice(0, 50)
        if (seen.has(key)) continue
        seen.add(key)

        const eventDate = extractFirstDate(description) ?? extractFirstDate(page.text)
        events.push({
          id: generateId(),
          patient_id: patientId,
          document_id: documentId,
          category,
          description: truncate(description, 150),
          event_date: eventDate,
          documented_date: eventDate,
          date_confidence: eventDate ? 'exact' : 'unknown',
          evidence_status: 'supported',
          is_backdated: false,
          source_page: page.pageNumber,
          source_text: truncate(match[0], 150),
          metadata: {},
          created_at: now(),
        })
      }
    }
  }

  return events.slice(0, 20)
}

// ============================================================
// MISSING INFORMATION DETECTOR
// ============================================================

export function extractMissingInformation(
  pages: ExtractedPage[],
  patientId: string,
  documentId: string,
): Partial<MissingInformation>[] {
  const missing: Partial<MissingInformation>[] = []
  const seen = new Set<string>()

  for (const page of pages) {
    for (const { pattern, type } of MISSING_PATTERNS) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(page.text)) !== null) {
        const description = cleanText(match[0])
        if (description.length < 10) continue
        const key = description.toLowerCase().slice(0, 40)
        if (seen.has(key)) continue
        seen.add(key)

        missing.push({
          id: generateId(),
          patient_id: patientId,
          missing_type: type,
          description: truncate(description, 150),
          referenced_in_document_id: documentId,
          referenced_on_page: page.pageNumber,
          referenced_text: truncate(match[0]),
          clinician_question: generateClinicianQuestion(description, type),
          is_critical: type === 'missing_result' || type === 'undocumented_treatment_change',
          status: 'open',
          created_at: now(),
          updated_at: now(),
        })
      }
    }
  }

  return missing.slice(0, 10)
}

function generateClinicianQuestion(description: string, type: string): string {
  if (type === 'missing_result') {
    return `Was the result obtained? If so, where is it documented?`
  }
  if (type === 'undocumented_treatment_change') {
    return `Who authorised this change and what was the clinical justification?`
  }
  if (type === 'missing_document') {
    return `Is this document available? Where was it filed?`
  }
  return `Please clarify: ${description.slice(0, 100)}`
}

// ============================================================
// CONTRADICTION DETECTOR
// ============================================================

/**
 * Compare extracted data across multiple documents to find genuine conflicts.
 * A conflict is raised only when the same item (medication, diagnosis) appears
 * with materially different values or statuses in different source documents.
 * We do NOT flag every clinical change as an error — only cases where the
 * same attribute is documented differently at the same point in time,
 * or where a change lacks any supporting documentation.
 */
export function detectContradictions(
  patientId: string,
  allMedEvents: Array<{ documentId: string; name: string; dosage?: string; eventType: string; page: number; text: string }>,
  allDiagnoses: Array<{ documentId: string; description: string; status: string; page: number; text: string }>,
): Partial<Contradiction>[] {
  const contradictions: Partial<Contradiction>[] = []

  // ---- Medication dosage conflicts ----
  // Group events by medication name across DIFFERENT documents
  const medByName: Record<string, typeof allMedEvents> = {}
  for (const ev of allMedEvents) {
    const key = ev.name.toLowerCase()
    if (!medByName[key]) medByName[key] = []
    medByName[key].push(ev)
  }

  for (const [name, events] of Object.entries(medByName)) {
    // Find events from different documents with different dosages
    const withDosage = events.filter(e => e.dosage && e.dosage.trim())
    for (let i = 0; i < withDosage.length; i++) {
      for (let j = i + 1; j < withDosage.length; j++) {
        const a = withDosage[i]
        const b = withDosage[j]
        if (a.documentId === b.documentId) continue
        if (a.dosage === b.dosage) continue

        // Different dosages in different documents — check if this is a modification
        // (modification with documentation is NOT a contradiction)
        // We flag it only if neither event explicitly says "changed from X to Y"
        const isDocumentedChange =
          a.text.toLowerCase().includes('changed') ||
          a.text.toLowerCase().includes('increased') ||
          a.text.toLowerCase().includes('decreased') ||
          b.text.toLowerCase().includes('changed') ||
          b.text.toLowerCase().includes('increased') ||
          b.text.toLowerCase().includes('decreased')

        const severity = isDocumentedChange ? 'medium' : 'critical'

        contradictions.push({
          id: generateId(),
          patient_id: patientId,
          category: 'medication',
          description: `${name}: dosage documented as "${a.dosage}" in one document and "${b.dosage}" in another${isDocumentedChange ? ' (change mentioned but not fully documented)' : ' without documented justification'}`,
          document_a_id: a.documentId,
          document_b_id: b.documentId,
          page_a: a.page,
          page_b: b.page,
          text_a: truncate(a.text),
          text_b: truncate(b.text),
          severity: severity as Contradiction['severity'],
          status: 'open',
          created_at: now(),
          updated_at: now(),
        })
      }
    }
  }

  // ---- Diagnosis status conflicts ----
  // Same diagnosis with contradictory status in different documents
  const dxByName: Record<string, typeof allDiagnoses> = {}
  for (const dx of allDiagnoses) {
    const key = dx.description.toLowerCase().slice(0, 40)
    if (!dxByName[key]) dxByName[key] = []
    dxByName[key].push(dx)
  }

  for (const [, dxList] of Object.entries(dxByName)) {
    if (dxList.length < 2) continue
    const statuses = [...new Set(dxList.map(d => d.status))]
    // Only flag active vs resolved (not active vs suspected — that's normal)
    if (statuses.includes('active') && statuses.includes('resolved')) {
      const a = dxList.find(d => d.status === 'active')!
      const b = dxList.find(d => d.status === 'resolved')!
      if (a.documentId === b.documentId) continue

      contradictions.push({
        id: generateId(),
        patient_id: patientId,
        category: 'diagnosis',
        description: `"${dxList[0].description}" is documented as active in one source but resolved in another`,
        document_a_id: a.documentId,
        document_b_id: b.documentId,
        page_a: a.page,
        page_b: b.page,
        text_a: truncate(a.text),
        text_b: truncate(b.text),
        severity: 'high',
        status: 'open',
        created_at: now(),
        updated_at: now(),
      })
    }
  }

  return contradictions
}

// ============================================================
// SAFETY GATE EVALUATOR
// ============================================================

export function evaluateSafetyGate(
  contradictions: Partial<Contradiction>[],
  missing: Partial<MissingInformation>[],
  totalStatements: number,
  verifiedCount: number,
): { gate: 'GREEN' | 'YELLOW' | 'RED'; reason: string; blockedConclusions: string[] } {
  const criticalContradictions = contradictions.filter(c => c.severity === 'critical').length
  const openContradictions = contradictions.length
  const criticalMissing = missing.filter(m => m.is_critical).length
  const completeness = totalStatements > 0 ? verifiedCount / totalStatements : 0

  if (criticalContradictions >= 1) {
    return {
      gate: 'RED',
      reason: `${criticalContradictions} critical unresolved contradiction(s) prevent a reliable conclusion.`,
      blockedConclusions: ['Clinical summary blocked', 'Medication reconciliation blocked', 'Discharge medication list blocked'],
    }
  }

  if (completeness < 0.3 && totalStatements > 0) {
    return {
      gate: 'RED',
      reason: `Evidence completeness is too low (${Math.round(completeness * 100)}%) for a safe summary.`,
      blockedConclusions: ['Summary generation blocked due to insufficient verified evidence'],
    }
  }

  if (openContradictions > 0 || criticalMissing > 0 || completeness < 0.6) {
    return {
      gate: 'YELLOW',
      reason: openContradictions > 0
        ? `${openContradictions} open contradiction(s) must be noted in any summary.`
        : `${criticalMissing} critical documentation gap(s) remain unresolved.`,
      blockedConclusions: [],
    }
  }

  return {
    gate: 'GREEN',
    reason: 'Evidence is sufficiently consistent for a qualified summary.',
    blockedConclusions: [],
  }
}

// ============================================================
// DOCUMENT CLASSIFIER
// ============================================================

export function classifyDocument(text: string, filename: string): string {
  const combined = (text + ' ' + filename).toLowerCase()
  for (const { keywords, type } of DOCUMENT_TYPE_PATTERNS) {
    if (keywords.some(k => combined.includes(k.toLowerCase()))) return type
  }
  return 'unknown'
}
