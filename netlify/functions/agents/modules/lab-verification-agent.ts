import { z } from 'zod'
import { supabaseAdmin } from '../../lib/supabase-admin'
import { extractStructured, AIProviderError } from '../../lib/ai-provider'

const LabResultSchema = z.object({
  test_name: z.string(),
  test_code: z.string().nullable(),
  value: z.string().nullable(),
  numeric_value: z.number().nullable(),
  unit: z.string().nullable(),
  reference_range_low: z.number().nullable(),
  reference_range_high: z.number().nullable(),
  reference_range_text: z.string().nullable(),
  is_abnormal: z.boolean().nullable(),
  is_critical: z.boolean().default(false),
  sample_date: z.string().nullable(),
  reported_date: z.string().nullable(),
  status: z.enum(['available', 'missing', 'pending', 'referenced_only']).default('available'),
  evidence_status: z.enum(['verified', 'supported', 'uncertain', 'conflicting', 'missing_evidence', 'superseded']),
  source_page: z.number().nullable(),
  source_text: z.string().nullable(),
})

const LabResponseSchema = z.object({
  lab_results: z.array(LabResultSchema),
  missing_results: z.array(z.string()),
  unit_inconsistencies: z.array(z.string()),
})

const LAB_SYSTEM_PROMPT = `You are a laboratory verification agent. Extract all laboratory test results from medical documents.
For each test: name, value, unit, reference range, abnormal flag, date.
Flag tests that are referenced but have no result available (status: "referenced_only" or "missing").
Flag unit inconsistencies. Never invent values. If a result is missing, mark it as such.
Return valid JSON only.`

export async function runLabVerificationAgent(
  patientId: string,
): Promise<{ findings: Record<string, unknown>; warnings: string[] }> {
  const warnings: string[] = []
  const findings: Record<string, unknown> = {
    results_found: 0,
    missing_results: 0,
    abnormal_values: 0,
    unit_issues: 0,
  }

  const { data: docs } = await supabaseAdmin
    .from('documents')
    .select('id, document_type')
    .eq('patient_id', patientId)
    .in('document_type', ['lab_report', 'admission_note', 'progress_note', 'discharge_summary'])
    .in('status', ['extracted', 'classified', 'analyzed'])

  if (!docs?.length) {
    warnings.push('No lab-relevant documents found')
    return { findings, warnings }
  }

  for (const doc of docs) {
    const { data: extractions } = await supabaseAdmin
      .from('document_extractions')
      .select('page_number, cleaned_text')
      .eq('document_id', doc.id)
      .order('page_number')
      .limit(5)

    if (!extractions?.length) continue

    const text = extractions.map(e => e.cleaned_text ?? '').join('\n\n').slice(0, 4000)

    try {
      const result = await extractStructured(
        LAB_SYSTEM_PROMPT,
        `Extract laboratory results from this ${doc.document_type}:\n\n${text}`,
        LabResponseSchema,
        { temperature: 0 }
      )

      for (const lab of result.lab_results) {
        await supabaseAdmin.from('laboratory_results').insert({
          patient_id: patientId,
          document_id: doc.id,
          test_name: lab.test_name,
          test_code: lab.test_code,
          value: lab.value,
          numeric_value: lab.numeric_value,
          unit: lab.unit,
          reference_range_low: lab.reference_range_low,
          reference_range_high: lab.reference_range_high,
          reference_range_text: lab.reference_range_text,
          is_abnormal: lab.is_abnormal,
          is_critical: lab.is_critical,
          sample_date: lab.sample_date,
          reported_date: lab.reported_date,
          status: lab.status,
          evidence_status: lab.evidence_status,
          source_page: lab.source_page,
          source_text: lab.source_text,
        })
        ;(findings.results_found as number)++
        if (lab.is_abnormal) ;(findings.abnormal_values as number)++
        if (lab.status === 'missing' || lab.status === 'referenced_only') {
          ;(findings.missing_results as number)++
          // Create a ghost record entry
          await supabaseAdmin.from('missing_information').insert({
            patient_id: patientId,
            missing_type: 'missing_result',
            description: `${lab.test_name} result referenced but not available`,
            referenced_in_document_id: doc.id,
            referenced_on_page: lab.source_page,
            referenced_text: lab.source_text,
            clinician_question: `Was the ${lab.test_name} result ever documented? Could not locate in available records.`,
            is_critical: lab.is_critical,
          })
        }
      }

      if (result.missing_results.length > 0) warnings.push(...result.missing_results)
      if (result.unit_inconsistencies.length > 0) {
        ;(findings.unit_issues as number) += result.unit_inconsistencies.length
        warnings.push(...result.unit_inconsistencies)
      }
    } catch (err) {
      if (err instanceof AIProviderError) {
        warnings.push(`Lab extraction unavailable: ${err.message}`)
        break
      }
    }
  }

  return { findings, warnings }
}
