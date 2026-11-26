import { z } from 'zod'
import { supabaseAdmin } from '../../lib/supabase-admin'
import { extractStructured, SYSTEM_PROMPTS, AIProviderError } from '../../lib/ai-provider'

const DiagnosisSchema = z.object({
  description: z.string(),
  icd_code: z.string().nullable(),
  status: z.enum(['active', 'resolved', 'suspected', 'ruled_out', 'conflicting']),
  onset_date: z.string().nullable(),
  resolution_date: z.string().nullable(),
  evidence_status: z.enum(['verified', 'supported', 'uncertain', 'conflicting', 'missing_evidence', 'superseded']),
  source_page: z.number().nullable(),
  source_text: z.string().nullable(),
})

const DiagnosisResponseSchema = z.object({
  diagnoses: z.array(DiagnosisSchema),
  conflicts_found: z.array(z.string()),
  unsupported_diagnoses: z.array(z.string()),
})

export async function runDiagnosisInvestigator(
  patientId: string,
): Promise<{ findings: Record<string, unknown>; warnings: string[] }> {
  const warnings: string[] = []
  const findings: Record<string, unknown> = { diagnoses_found: 0, conflicts: 0, unsupported: 0 }

  const { data: docs } = await supabaseAdmin
    .from('documents')
    .select('id, document_type')
    .eq('patient_id', patientId)
    .in('status', ['extracted', 'classified', 'analyzed'])

  if (!docs?.length) {
    warnings.push('No processed documents for diagnosis investigation')
    return { findings, warnings }
  }

  const allDiagnoses: Array<{ description: string; status: string; document_id: string }> = []

  for (const doc of docs) {
    const { data: extractions } = await supabaseAdmin
      .from('document_extractions')
      .select('page_number, cleaned_text')
      .eq('document_id', doc.id)
      .order('page_number')
      .limit(4)

    if (!extractions?.length) continue

    const text = extractions.map(e => e.cleaned_text ?? '').join('\n\n').slice(0, 3500)

    try {
      const result = await extractStructured(
        SYSTEM_PROMPTS.statementExtractor,
        `Extract all documented diagnoses from this ${doc.document_type}.\n\n${text}`,
        DiagnosisResponseSchema,
        { temperature: 0 }
      )

      for (const dx of result.diagnoses) {
        const { error } = await supabaseAdmin.from('diagnoses').insert({
          patient_id: patientId,
          document_id: doc.id,
          icd_code: dx.icd_code,
          description: dx.description,
          status: dx.status,
          onset_date: dx.onset_date,
          resolution_date: dx.resolution_date,
          evidence_status: dx.evidence_status,
          source_page: dx.source_page,
          source_text: dx.source_text,
        })
        if (!error) {
          ;(findings.diagnoses_found as number)++
          allDiagnoses.push({ description: dx.description, status: dx.status, document_id: doc.id })
        }
      }

      if (result.conflicts_found.length > 0) warnings.push(...result.conflicts_found)
      if (result.unsupported_diagnoses.length > 0) {
        ;(findings.unsupported as number) += result.unsupported_diagnoses.length
        warnings.push(...result.unsupported_diagnoses.map(d => `Unsupported diagnosis: ${d}`))
      }
    } catch (err) {
      if (err instanceof AIProviderError) {
        warnings.push(`Diagnosis extraction unavailable: ${err.message}`)
        break
      }
    }
  }

  // Cross-document conflict detection
  const byName: Record<string, typeof allDiagnoses> = {}
  allDiagnoses.forEach(dx => {
    const key = dx.description.toLowerCase().trim()
    if (!byName[key]) byName[key] = []
    byName[key].push(dx)
  })

  for (const [name, dxList] of Object.entries(byName)) {
    if (dxList.length < 2) continue
    const statuses = [...new Set(dxList.map(d => d.status))]
    if (statuses.length > 1) {
      ;(findings.conflicts as number)++
      await supabaseAdmin.from('contradictions').insert({
        patient_id: patientId,
        category: 'diagnosis',
        description: `Conflicting status for "${name}": ${statuses.join(' vs ')}`,
        document_a_id: dxList[0].document_id,
        document_b_id: dxList[1].document_id,
        text_a: `Status: ${dxList[0].status}`,
        text_b: `Status: ${dxList[1].status}`,
        severity: 'high',
        status: 'open',
      })
    }
  }

  return { findings, warnings }
}
