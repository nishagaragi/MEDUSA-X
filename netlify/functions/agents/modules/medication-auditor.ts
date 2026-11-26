import { z } from 'zod'
import { supabaseAdmin } from '../../lib/supabase-admin'
import { extractStructured, SYSTEM_PROMPTS, AIProviderError } from '../../lib/ai-provider'

const MedEventSchema = z.object({
  medication_name: z.string(),
  generic_name: z.string().nullable(),
  drug_class: z.string().nullable(),
  event_type: z.enum(['prescribed', 'started', 'continued', 'modified', 'discontinued', 'uncertain', 'conflicting']),
  dosage: z.string().nullable(),
  strength: z.string().nullable(),
  frequency: z.string().nullable(),
  route: z.string().nullable(),
  event_date: z.string().nullable(),
  evidence_status: z.enum(['verified', 'supported', 'uncertain', 'conflicting', 'missing_evidence', 'superseded']),
  source_page: z.number().nullable(),
  source_text: z.string().nullable(),
})

const MedResponseSchema = z.object({
  medication_events: z.array(MedEventSchema),
  conflicts_detected: z.array(z.string()),
  undocumented_changes: z.array(z.string()),
})

export async function runMedicationAuditor(
  patientId: string,
): Promise<{ findings: Record<string, unknown>; warnings: string[] }> {
  const warnings: string[] = []
  const findings: Record<string, unknown> = {
    medications_found: 0,
    conflicts_detected: 0,
    undocumented_changes: 0,
  }

  const { data: docs } = await supabaseAdmin
    .from('documents')
    .select('id, document_type')
    .eq('patient_id', patientId)
    .in('status', ['extracted', 'classified', 'analyzed'])
    .order('document_type')

  if (!docs?.length) {
    warnings.push('No processed documents for medication reconciliation')
    return { findings, warnings }
  }

  // Map: medication name → { id, events[] }
  const medMap: Record<string, { id: string; events: Array<{ dosage: string | null; event_type: string; document_id: string }> }> = {}

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
        SYSTEM_PROMPTS.medicationReconciler,
        `Document type: ${doc.document_type}\n\nExtract all medication information:\n\n${text}`,
        MedResponseSchema,
        { temperature: 0 }
      )

      for (const ev of result.medication_events) {
        const nameKey = ev.medication_name.toLowerCase().trim()

        // Upsert medication record
        let medId: string
        if (medMap[nameKey]) {
          medId = medMap[nameKey].id
        } else {
          const { data: existing } = await supabaseAdmin
            .from('medications')
            .select('id')
            .eq('patient_id', patientId)
            .ilike('name', ev.medication_name)
            .single()

          if (existing) {
            medId = existing.id
          } else {
            const { data: newMed } = await supabaseAdmin
              .from('medications')
              .insert({
                patient_id: patientId,
                name: ev.medication_name,
                generic_name: ev.generic_name,
                drug_class: ev.drug_class,
                current_state: ev.event_type,
                evidence_status: ev.evidence_status,
              })
              .select('id')
              .single()
            medId = newMed?.id ?? ''
          }
          medMap[nameKey] = { id: medId, events: [] }
          ;(findings.medications_found as number)++
        }

        if (!medId) continue

        await supabaseAdmin.from('medication_events').insert({
          medication_id: medId,
          patient_id: patientId,
          document_id: doc.id,
          event_type: ev.event_type,
          dosage: ev.dosage,
          strength: ev.strength,
          frequency: ev.frequency,
          route: ev.route,
          event_date: ev.event_date,
          evidence_status: ev.evidence_status,
          source_page: ev.source_page,
          source_text: ev.source_text,
        })

        medMap[nameKey].events.push({
          dosage: ev.dosage,
          event_type: ev.event_type,
          document_id: doc.id,
        })
      }

      if (result.conflicts_detected.length > 0) {
        warnings.push(...result.conflicts_detected)
        ;(findings.conflicts_detected as number) += result.conflicts_detected.length
      }
      if (result.undocumented_changes.length > 0) {
        warnings.push(...result.undocumented_changes)
        ;(findings.undocumented_changes as number) += result.undocumented_changes.length
      }
    } catch (err) {
      if (err instanceof AIProviderError) {
        warnings.push(`Medication extraction unavailable: ${err.message}`)
        break
      }
    }
  }

  // Detect dosage conflicts across documents
  for (const [name, med] of Object.entries(medMap)) {
    const dosages = [...new Set(med.events.map(e => e.dosage).filter(Boolean))]
    if (dosages.length > 1) {
      ;(findings.conflicts_detected as number)++
      await supabaseAdmin.from('medications').update({ has_conflicts: true, current_state: 'conflicting' }).eq('id', med.id)
      await supabaseAdmin.from('contradictions').insert({
        patient_id: patientId,
        category: 'medication',
        description: `Conflicting dosage for ${name}: ${dosages.join(' vs ')}`,
        document_a_id: med.events[0]?.document_id,
        document_b_id: med.events[med.events.length - 1]?.document_id,
        text_a: `${name} ${dosages[0]}`,
        text_b: `${name} ${dosages[dosages.length - 1]}`,
        severity: 'critical',
        status: 'open',
      })
    }

    // Update current state to latest event type
    const latestEvent = med.events[med.events.length - 1]
    if (latestEvent) {
      await supabaseAdmin
        .from('medications')
        .update({ current_state: latestEvent.event_type })
        .eq('id', med.id)
    }
  }

  return { findings, warnings }
}
