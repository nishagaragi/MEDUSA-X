import { z } from 'zod'
import { supabaseAdmin } from '../../lib/supabase-admin'
import { extractStructured, SYSTEM_PROMPTS, AIProviderError } from '../../lib/ai-provider'

const DocumentClassificationSchema = z.object({
  document_type: z.enum([
    'admission_note', 'discharge_summary', 'progress_note',
    'lab_report', 'prescription', 'operation_report',
    'radiology_report', 'consultation_note', 'referral_letter',
    'unknown',
  ]),
  document_date: z.string().nullable(),
  page_count_estimate: z.number().nullable(),
  key_identifiers: z.array(z.string()),
  confidence: z.number().min(0).max(1),
})

export async function runDocumentDetective(
  patientId: string,
  agentRunId: string
): Promise<{ findings: Record<string, unknown>; warnings: string[] }> {
  const warnings: string[] = []
  const findings: Record<string, unknown> = {}

  try {
    // Fetch documents that need processing
    const { data: documents, error } = await supabaseAdmin
      .from('documents')
      .select('id, original_filename, document_type, status')
      .eq('patient_id', patientId)
      .in('status', ['extracted', 'classified', 'analyzed'])

    if (error) throw error
    if (!documents?.length) {
      findings.message = 'No documents ready for classification'
      return { findings, warnings }
    }

    findings.documents_processed = 0
    findings.classifications = []

    for (const doc of documents) {
      // Get extracted text
      const { data: extractions } = await supabaseAdmin
        .from('document_extractions')
        .select('page_number, cleaned_text')
        .eq('document_id', doc.id)
        .order('page_number')
        .limit(3)

      if (!extractions?.length) {
        warnings.push(`Document ${doc.original_filename}: no extracted text available`)
        continue
      }

      const textSample = extractions.map(e => e.cleaned_text ?? '').join('\n\n').slice(0, 3000)

      let classification
      try {
        classification = await extractStructured(
          SYSTEM_PROMPTS.documentClassifier,
          `Classify this medical document:\n\nFilename: ${doc.original_filename}\n\nContent sample:\n${textSample}`,
          DocumentClassificationSchema,
          { temperature: 0 }
        )
      } catch (err) {
        if (err instanceof AIProviderError) {
          warnings.push(`Document ${doc.original_filename}: AI classification unavailable — ${err.message}`)
          continue
        }
        throw err
      }

      // Update document type if classification has high confidence
      if (classification.confidence > 0.6 && doc.document_type === 'unknown') {
        await supabaseAdmin
          .from('documents')
          .update({
            document_type: classification.document_type,
            document_date: classification.document_date,
          })
          .eq('id', doc.id)
      }

      ;(findings.classifications as unknown[]).push({
        document_id: doc.id,
        filename: doc.original_filename,
        classified_as: classification.document_type,
        confidence: classification.confidence,
      })
      ;(findings.documents_processed as number)++
    }

    return { findings, warnings }
  } catch (err) {
    throw err
  }
}
