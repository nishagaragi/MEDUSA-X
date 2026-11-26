import { z } from 'zod'
import { supabaseAdmin } from '../../lib/supabase-admin'
import { extractStructured, SYSTEM_PROMPTS, AIProviderError } from '../../lib/ai-provider'

const TimelineEventSchema = z.object({
  description: z.string(),
  category: z.enum([
    'admission', 'discharge', 'investigation', 'prescription',
    'procedure', 'progress_note', 'consultation', 'lab_result',
    'diagnosis', 'treatment_change', 'unknown',
  ]),
  event_date: z.string().nullable(),
  documented_date: z.string().nullable(),
  date_confidence: z.enum(['exact', 'approximate', 'inferred', 'unknown']).default('unknown'),
  evidence_status: z.enum(['verified', 'supported', 'uncertain', 'conflicting', 'missing_evidence', 'superseded']),
  source_page: z.number().nullable(),
  source_text: z.string().nullable(),
  is_backdated: z.boolean().default(false),
})

const TimelineResponseSchema = z.object({
  events: z.array(TimelineEventSchema),
  gaps_detected: z.array(z.string()),
  date_issues: z.array(z.string()),
})

export async function runTimelineAgent(
  patientId: string,
): Promise<{ findings: Record<string, unknown>; warnings: string[] }> {
  const warnings: string[] = []
  const findings: Record<string, unknown> = { events_extracted: 0, gaps_detected: 0, date_issues: [] }

  // Get all extracted document text
  const { data: docs } = await supabaseAdmin
    .from('documents')
    .select('id, document_type, document_date')
    .eq('patient_id', patientId)
    .in('status', ['extracted', 'classified', 'analyzed'])

  if (!docs?.length) {
    warnings.push('No processed documents available for timeline reconstruction')
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

    const textContent = extractions.map(e => e.cleaned_text ?? '').join('\n\n').slice(0, 3500)

    try {
      const result = await extractStructured(
        SYSTEM_PROMPTS.timelineReconstructor,
        `Document type: ${doc.document_type}\nDocument date: ${doc.document_date ?? 'unknown'}\n\nContent:\n${textContent}`,
        TimelineResponseSchema,
        { temperature: 0 }
      )

      if (result.events.length > 0) {
        await supabaseAdmin.from('clinical_events').insert(
          result.events.map(ev => ({
            patient_id: patientId,
            document_id: doc.id,
            category: ev.category,
            description: ev.description,
            event_date: ev.event_date,
            documented_date: ev.documented_date,
            date_confidence: ev.date_confidence,
            evidence_status: ev.evidence_status,
            source_page: ev.source_page,
            source_text: ev.source_text,
            is_backdated: ev.is_backdated,
          }))
        )
        ;(findings.events_extracted as number) += result.events.length
      }

      if (result.gaps_detected.length > 0) warnings.push(...result.gaps_detected)
      if (result.date_issues.length > 0) {
        (findings.date_issues as string[]).push(...result.date_issues)
        ;(findings.gaps_detected as number) += result.gaps_detected.length
      }
    } catch (err) {
      if (err instanceof AIProviderError) {
        warnings.push(`Timeline extraction unavailable: ${err.message}`)
        break
      }
    }
  }

  // Detect gaps between events
  const { data: events } = await supabaseAdmin
    .from('clinical_events')
    .select('event_date')
    .eq('patient_id', patientId)
    .not('event_date', 'is', null)
    .order('event_date')

  if (events && events.length > 1) {
    for (let i = 1; i < events.length; i++) {
      const prev = new Date(events[i - 1].event_date!).getTime()
      const curr = new Date(events[i].event_date!).getTime()
      const gapDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24))
      if (gapDays > 7) {
        // Update the event to record gap
        await supabaseAdmin
          .from('clinical_events')
          .update({ timeline_gap_before_days: gapDays })
          .eq('patient_id', patientId)
          .eq('event_date', events[i].event_date)
      }
    }
  }

  return { findings, warnings }
}
