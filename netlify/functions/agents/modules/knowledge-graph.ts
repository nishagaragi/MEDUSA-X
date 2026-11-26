import { supabaseAdmin } from '../../lib/supabase-admin'

/**
 * Builds the patient knowledge graph from extracted clinical data.
 * Nodes: diagnoses, medications, lab tests, clinical events, documents
 * Edges: supports, contradicts, references, occurred_before, associated_with, potentially_affects
 */
export async function buildKnowledgeGraph(patientId: string): Promise<void> {
  // Clear existing graph for fresh rebuild
  await supabaseAdmin.from('knowledge_graph_edges').delete().eq('patient_id', patientId)
  await supabaseAdmin.from('knowledge_graph_nodes').delete().eq('patient_id', patientId)

  const nodeMap: Record<string, string> = {} // key → node id

  async function upsertNode(key: string, type: string, label: string, evidenceStatus: string, refId?: string, x = 0, y = 0) {
    if (nodeMap[key]) return nodeMap[key]
    const { data } = await supabaseAdmin
      .from('knowledge_graph_nodes')
      .insert({
        patient_id: patientId,
        node_type: type,
        label: label.slice(0, 100),
        reference_id: refId,
        evidence_status: evidenceStatus,
        position_x: x + Math.random() * 50,
        position_y: y + Math.random() * 50,
      })
      .select('id')
      .single()
    if (data?.id) nodeMap[key] = data.id
    return data?.id ?? null
  }

  async function addEdge(sourceKey: string, targetKey: string, relationship: string, evidenceStatus = 'uncertain') {
    const sourceId = nodeMap[sourceKey]
    const targetId = nodeMap[targetKey]
    if (!sourceId || !targetId) return
    await supabaseAdmin.from('knowledge_graph_edges').insert({
      patient_id: patientId,
      source_node_id: sourceId,
      target_node_id: targetId,
      relationship,
      evidence_status: evidenceStatus,
    })
  }

  // ---- Documents ----
  const { data: docs } = await supabaseAdmin
    .from('documents')
    .select('id, original_filename, document_type')
    .eq('patient_id', patientId)

  for (const doc of docs ?? []) {
    await upsertNode(`doc:${doc.id}`, 'document', doc.original_filename.slice(0, 50), 'supported', doc.id, 50, 50)
  }

  // ---- Diagnoses ----
  const { data: diagnoses } = await supabaseAdmin
    .from('diagnoses')
    .select('id, description, evidence_status, document_id')
    .eq('patient_id', patientId)

  let dxX = 200
  for (const dx of diagnoses ?? []) {
    await upsertNode(`dx:${dx.id}`, 'diagnosis', dx.description, dx.evidence_status, dx.id, dxX, 150)
    dxX += 180
    if (dx.document_id) {
      await addEdge(`doc:${dx.document_id}`, `dx:${dx.id}`, 'references', dx.evidence_status)
    }
  }

  // ---- Medications ----
  const { data: medications } = await supabaseAdmin
    .from('medications')
    .select('id, name, evidence_status, has_conflicts')
    .eq('patient_id', patientId)

  let medX = 200
  for (const med of medications ?? []) {
    await upsertNode(`med:${med.id}`, 'medication', med.name, med.evidence_status, med.id, medX, 300)
    medX += 180
  }

  // ---- Lab Tests ----
  const { data: labs } = await supabaseAdmin
    .from('laboratory_results')
    .select('id, test_name, evidence_status, document_id, is_abnormal')
    .eq('patient_id', patientId)

  let labX = 200
  for (const lab of labs ?? []) {
    const label = `${lab.test_name}${lab.is_abnormal ? ' ⚠' : ''}`
    await upsertNode(`lab:${lab.id}`, 'lab_test', label, lab.evidence_status, lab.id, labX, 450)
    labX += 180
    if (lab.document_id) {
      await addEdge(`doc:${lab.document_id}`, `lab:${lab.id}`, 'references', lab.evidence_status)
    }
  }

  // ---- Clinical Events (key ones) ----
  const { data: events } = await supabaseAdmin
    .from('clinical_events')
    .select('id, description, evidence_status, document_id, category')
    .eq('patient_id', patientId)
    .in('category', ['admission', 'discharge', 'procedure', 'diagnosis'])
    .order('event_date')
    .limit(10)

  let evX = 200
  for (let i = 0; i < (events ?? []).length; i++) {
    const ev = events![i]
    await upsertNode(`ev:${ev.id}`, 'event', ev.description.slice(0, 50), ev.evidence_status, ev.id, evX, 600)
    evX += 180
    if (ev.document_id) {
      await addEdge(`doc:${ev.document_id}`, `ev:${ev.id}`, 'references', ev.evidence_status)
    }
    // Occurred before chain
    if (i > 0) {
      await addEdge(`ev:${events![i - 1].id}`, `ev:${ev.id}`, 'occurred_before', 'supported')
    }
  }

  // ---- Contradictions → potentially_affects edges ----
  const { data: contradictions } = await supabaseAdmin
    .from('contradictions')
    .select('id, category, statement_a_id, statement_b_id, severity')
    .eq('patient_id', patientId)

  for (const c of contradictions ?? []) {
    // Link contradicting items
    if (c.category === 'medication') {
      // Find medications involved and add contradicts edge
      const meds = medications ?? []
      if (meds.length >= 2) {
        // Link first two meds with conflicting evidence as example
        const conflictingMeds = meds.filter(m => m.has_conflicts)
        if (conflictingMeds.length >= 2) {
          await addEdge(`med:${conflictingMeds[0].id}`, `med:${conflictingMeds[1].id}`, 'contradicts', 'conflicting')
        }
      }
    }
    if (c.category === 'diagnosis') {
      const conflictingDx = (diagnoses ?? []).filter(d => d.evidence_status === 'conflicting')
      if (conflictingDx.length >= 2) {
        await addEdge(`dx:${conflictingDx[0].id}`, `dx:${conflictingDx[1].id}`, 'contradicts', 'conflicting')
      }
    }
  }

  // ---- Diagnosis ↔ Medication associations ----
  // Simple heuristic: link diagnoses to medications that commonly treat them
  const heuristicLinks: Array<[string, string]> = [
    ['heart failure', 'furosemide'],
    ['heart failure', 'warfarin'],
    ['diabetes', 'metformin'],
    ['hypertension', 'lisinopril'],
  ]

  for (const [dxTerm, medTerm] of heuristicLinks) {
    const matchDx = (diagnoses ?? []).find(d => d.description.toLowerCase().includes(dxTerm))
    const matchMed = (medications ?? []).find(m => m.name.toLowerCase().includes(medTerm))
    if (matchDx && matchMed) {
      await addEdge(`dx:${matchDx.id}`, `med:${matchMed.id}`, 'associated_with', matchDx.evidence_status)
    }
  }
}
