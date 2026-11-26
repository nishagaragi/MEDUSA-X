import { z } from 'zod'
import { supabaseAdmin } from '../../lib/supabase-admin'
import { extractStructured, AIProviderError } from '../../lib/ai-provider'

const AuditResultSchema = z.object({
  statement_id: z.string(),
  original_content: z.string(),
  source_verified: z.boolean(),
  recommended_status: z.enum(['verified', 'supported', 'uncertain', 'conflicting', 'missing_evidence', 'superseded']),
  confidence: z.number().min(0).max(1),
  audit_note: z.string().nullable(),
})

const AuditResponseSchema = z.object({
  audit_results: z.array(AuditResultSchema),
  statements_flagged: z.number(),
  source_gaps: z.array(z.string()),
})

const EVIDENCE_AUDIT_PROMPT = `You are a clinical evidence auditor. For each clinical statement provided,
verify that the stated evidence status is accurate given the source text.
Adjust the recommended status if the source text does not support the original classification.
Never upgrade 'uncertain' to 'verified' without explicit source confirmation.
Return valid JSON only.`

export async function runEvidenceAuditor(
  patientId: string,
): Promise<{ findings: Record<string, unknown>; warnings: string[] }> {
  const warnings: string[] = []
  const findings: Record<string, unknown> = {
    statements_verified: 0,
    statements_flagged: 0,
    source_gaps: [],
  }

  // Get recently created statements that have source text
  const { data: statements } = await supabaseAdmin
    .from('clinical_statements')
    .select('id, content, evidence_status, source_text, source_page')
    .eq('patient_id', patientId)
    .not('source_text', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!statements?.length) {
    warnings.push('No statements with source text to audit')
    return { findings, warnings }
  }

  // Batch audit in groups of 10
  const batchSize = 10
  for (let i = 0; i < statements.length; i += batchSize) {
    const batch = statements.slice(i, i + batchSize)
    const batchText = batch.map((s, idx) =>
      `${idx + 1}. ID: ${s.id}\n   Content: "${s.content}"\n   Current status: ${s.evidence_status}\n   Source: "${s.source_text}"`
    ).join('\n\n')

    try {
      const result = await extractStructured(
        EVIDENCE_AUDIT_PROMPT,
        `Audit these ${batch.length} clinical statements:\n\n${batchText}`,
        AuditResponseSchema,
        { temperature: 0 }
      )

      ;(findings.statements_verified as number) += batch.length
      ;(findings.statements_flagged as number) += result.statements_flagged

      // Update statements where status should change
      for (const audit of result.audit_results) {
        const original = batch.find(s => s.id === audit.statement_id)
        if (!original) continue
        if (audit.recommended_status !== original.evidence_status) {
          await supabaseAdmin
            .from('clinical_statements')
            .update({
              evidence_status: audit.recommended_status,
              evidence_score: audit.confidence,
              evidence_explanation: audit.audit_note,
            })
            .eq('id', audit.statement_id)
        }
      }

      if (result.source_gaps.length > 0) {
        (findings.source_gaps as string[]).push(...result.source_gaps)
        warnings.push(...result.source_gaps)
      }
    } catch (err) {
      if (err instanceof AIProviderError) {
        warnings.push(`Evidence audit unavailable: ${err.message}`)
        break
      }
    }
  }

  // Check for statements without source text — flag as uncertain if currently verified
  const { data: unsourced } = await supabaseAdmin
    .from('clinical_statements')
    .select('id, content, evidence_status')
    .eq('patient_id', patientId)
    .is('source_text', null)
    .eq('evidence_status', 'verified')

  if (unsourced?.length) {
    warnings.push(`${unsourced.length} statements marked 'verified' have no source text — downgrading to 'uncertain'`)
    await supabaseAdmin
      .from('clinical_statements')
      .update({
        evidence_status: 'uncertain',
        evidence_explanation: 'No source text available to verify this statement',
      })
      .in('id', unsourced.map(s => s.id))
    ;(findings.statements_flagged as number) += unsourced.length
  }

  return { findings, warnings }
}
