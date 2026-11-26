import { z } from 'zod'
import { supabaseAdmin } from '../../lib/supabase-admin'
import { extractStructured, SYSTEM_PROMPTS, AIProviderError } from '../../lib/ai-provider'

const StatementSchema = z.object({
  content: z.string(),
  statement_type: z.enum(['diagnosis', 'medication', 'lab_result', 'procedure', 'clinical_event', 'observation', 'other']),
  evidence_status: z.enum(['verified', 'supported', 'uncertain', 'conflicting', 'missing_evidence', 'superseded']),
  evidence_score: z.number().min(0).max(1),
  evidence_explanation: z.string(),
  source_page: z.number().nullable(),
  source_text: z.string().nullable(),
})

const ExtractionResponseSchema = z.object({
  statements: z.array(StatementSchema),
  extraction_notes: z.array(z.string()),
})

export async function extractStatements(
  patientId: string,
  documentId: string,
  textContent: string,
  pageNumber: number
): Promise<{ count: number; warnings: string[] }> {
  const warnings: string[] = []

  try {
    const result = await extractStructured(
      SYSTEM_PROMPTS.statementExtractor,
      `Extract all clinical statements from this medical document page.\n\nPatient context: Document page ${pageNumber}\n\nContent:\n${textContent.slice(0, 4000)}`,
      ExtractionResponseSchema,
      { temperature: 0, maxTokens: 2000 }
    )

    if (result.extraction_notes.length > 0) {
      warnings.push(...result.extraction_notes)
    }

    if (result.statements.length === 0) return { count: 0, warnings }

    // Insert statements
    const { error } = await supabaseAdmin
      .from('clinical_statements')
      .insert(
        result.statements.map(s => ({
          patient_id: patientId,
          document_id: documentId,
          statement_type: s.statement_type,
          content: s.content,
          evidence_status: s.evidence_status,
          evidence_score: s.evidence_score,
          evidence_explanation: s.evidence_explanation,
          source_page: s.source_page,
          source_text: s.source_text,
          is_contradicted: s.evidence_status === 'conflicting',
        }))
      )

    if (error) {
      warnings.push(`Failed to store statements: ${error.message}`)
      return { count: 0, warnings }
    }

    return { count: result.statements.length, warnings }
  } catch (err) {
    if (err instanceof AIProviderError) {
      warnings.push(`AI extraction unavailable: ${err.message}`)
      return { count: 0, warnings }
    }
    throw err
  }
}

export async function detectContradictions(
  patientId: string
): Promise<{ count: number; warnings: string[] }> {
  const warnings: string[] = []

  const { data: statements } = await supabaseAdmin
    .from('clinical_statements')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (!statements?.length) return { count: 0, warnings }

  // Group statements by type for cross-document comparison
  const byType: Record<string, typeof statements> = {}
  statements.forEach(s => {
    if (!byType[s.statement_type]) byType[s.statement_type] = []
    byType[s.statement_type].push(s)
  })

  let contradictionsFound = 0

  for (const [type, stmts] of Object.entries(byType)) {
    if (stmts.length < 2) continue

    // Find pairs from different documents
    for (let i = 0; i < stmts.length; i++) {
      for (let j = i + 1; j < stmts.length; j++) {
        const a = stmts[i]
        const b = stmts[j]
        if (a.document_id === b.document_id) continue

        // Check for potential contradiction using AI
        try {
          const ContradictionCheckSchema = z.object({
            is_contradiction: z.boolean(),
            severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
            description: z.string().optional(),
          })

          const result = await extractStructured(
            SYSTEM_PROMPTS.contradictionDetector,
            `Compare these two clinical statements and determine if they contradict each other:\n\nStatement A: "${a.content}"\nStatement B: "${b.content}"\n\nType: ${type}`,
            ContradictionCheckSchema,
            { temperature: 0 }
          )

          if (result.is_contradiction && result.severity) {
            const { error } = await supabaseAdmin
              .from('contradictions')
              .insert({
                patient_id: patientId,
                category: type,
                description: result.description ?? `Conflicting ${type} statements`,
                statement_a_id: a.id,
                statement_b_id: b.id,
                document_a_id: a.document_id,
                document_b_id: b.document_id,
                page_a: a.source_page,
                page_b: b.source_page,
                text_a: a.content,
                text_b: b.content,
                severity: result.severity,
                status: 'open',
              })

            if (!error) contradictionsFound++
          }
        } catch (err) {
          if (err instanceof AIProviderError) {
            warnings.push(`Contradiction check unavailable: ${err.message}`)
            break  // Stop checking if AI unavailable
          }
        }
      }
    }
  }

  return { count: contradictionsFound, warnings }
}
