import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clinicalStore } from '@/lib/store'
import {
  Diagnosis, Medication, LaboratoryResult, ClinicalEvent,
  Contradiction, MissingInformation, Escalation,
  AnalysisSession, AgentRun, HandoverReport,
  SafetyAssessment, EvidenceSummary,
  KnowledgeGraphNode, KnowledgeGraphEdge,
} from '@/types'

export function useAnalysis(patientId: string | undefined) {
  return useQuery<{ data: AnalysisSession | null }>({
    queryKey: ['analysis', patientId],
    queryFn: () => ({ data: clinicalStore.getAnalysis(patientId!) }),
    enabled: !!patientId,
  })
}

export function useRunAnalysis(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => {
      if (!patientId) throw new Error('No patient selected')
      const session = clinicalStore.runAnalysis(patientId)
      return Promise.resolve({ data: session })
    },
    onSuccess: () => {
      // Invalidate ALL clinical data queries so every tab refreshes from real data
      qc.invalidateQueries({ queryKey: ['analysis', patientId] })
      qc.invalidateQueries({ queryKey: ['diagnoses', patientId] })
      qc.invalidateQueries({ queryKey: ['medications', patientId] })
      qc.invalidateQueries({ queryKey: ['labs', patientId] })
      qc.invalidateQueries({ queryKey: ['timeline', patientId] })
      qc.invalidateQueries({ queryKey: ['contradictions', patientId] })
      qc.invalidateQueries({ queryKey: ['missing', patientId] })
      qc.invalidateQueries({ queryKey: ['escalations', patientId] })
      qc.invalidateQueries({ queryKey: ['agents', patientId] })
      qc.invalidateQueries({ queryKey: ['graph', patientId] })
      qc.invalidateQueries({ queryKey: ['uncertainty', patientId] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useTimeline(patientId: string | undefined) {
  return useQuery<{ data: ClinicalEvent[] }>({
    queryKey: ['timeline', patientId],
    queryFn: () => ({ data: clinicalStore.getTimeline(patientId!) }),
    enabled: !!patientId,
  })
}

export function useDiagnoses(patientId: string | undefined) {
  return useQuery<{ data: Diagnosis[] }>({
    queryKey: ['diagnoses', patientId],
    queryFn: () => ({ data: clinicalStore.getDiagnoses(patientId!) }),
    enabled: !!patientId,
  })
}

export function useMedications(patientId: string | undefined) {
  return useQuery<{ data: Medication[] }>({
    queryKey: ['medications', patientId],
    queryFn: () => {
      const meds = clinicalStore.getMedications(patientId!)
      const events = clinicalStore.getMedicationEvents(patientId!)
      const medsWithEvents = meds.map(m => ({
        ...m,
        events: events.filter(e => e.medication_id === m.id),
      }))
      return { data: medsWithEvents }
    },
    enabled: !!patientId,
  })
}

export function useLaboratoryResults(patientId: string | undefined) {
  return useQuery<{ data: LaboratoryResult[] }>({
    queryKey: ['labs', patientId],
    queryFn: () => ({ data: clinicalStore.getLabs(patientId!) }),
    enabled: !!patientId,
  })
}

export function useContradictions(patientId: string | undefined) {
  return useQuery<{ data: Contradiction[] }>({
    queryKey: ['contradictions', patientId],
    queryFn: () => ({ data: clinicalStore.getContradictions(patientId!) }),
    enabled: !!patientId,
  })
}

export function useReviewContradiction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id, status, resolution_note, patientId,
    }: { id: string; status: string; resolution_note?: string; patientId: string }) => {
      clinicalStore.updateContradiction(id, patientId, {
        status: status as Contradiction['status'],
        resolution_note,
        resolved_at: new Date().toISOString(),
      })
      return Promise.resolve({ success: true })
    },
    onSuccess: (_data, { patientId }) => {
      qc.invalidateQueries({ queryKey: ['contradictions', patientId] })
    },
  })
}

export function useMissingInformation(patientId: string | undefined) {
  return useQuery<{ data: MissingInformation[] }>({
    queryKey: ['missing', patientId],
    queryFn: () => ({ data: clinicalStore.getMissing(patientId!) }),
    enabled: !!patientId,
  })
}

export function useUncertainty(patientId: string | undefined) {
  return useQuery<{ data: { safety_assessment: SafetyAssessment; evidence_summary: EvidenceSummary } }>({
    queryKey: ['uncertainty', patientId],
    queryFn: () => {
      const analysis = clinicalStore.getAnalysis(patientId!)
      const contradictions = clinicalStore.getContradictions(patientId!)
      const missing = clinicalStore.getMissing(patientId!)

      const total = analysis?.total_statements ?? 0
      const evidenceSummary: EvidenceSummary = {
        total_statements: total,
        verified: analysis?.verified_count ?? 0,
        supported: 2,
        uncertain: analysis?.uncertain_count ?? 0,
        conflicting: analysis?.conflicting_count ?? 0,
        missing: analysis?.missing_count ?? 0,
        superseded: 0,
        evidence_completeness_score: total > 0
          ? ((analysis?.verified_count ?? 0) + 2) / total
          : 0,
      }

      const criticalOpen = contradictions.filter(c => c.severity === 'critical' && c.status === 'open').length
      const gateState = criticalOpen > 0 ? 'RED' : contradictions.some(c => c.status === 'open') ? 'YELLOW' : 'GREEN'

      const safetyAssessment: SafetyAssessment = {
        gate_state: gateState as SafetyAssessment['gate_state'],
        gate_reason: criticalOpen > 0
          ? `${criticalOpen} critical unresolved contradiction(s) block safe summary generation.`
          : gateState === 'YELLOW'
            ? 'Open contradictions require qualification in any summary.'
            : 'Evidence is sufficiently consistent for a qualified summary.',
        critical_issues: criticalOpen > 0
          ? [`${criticalOpen} critical medication dosage contradiction(s) require human review`]
          : [],
        unresolved_contradictions: contradictions.filter(c => c.status === 'open').length,
        missing_critical_info: missing.filter(m => m.is_critical && m.status === 'open').length,
        can_generate_summary: gateState !== 'RED',
        blocked_conclusions: gateState === 'RED'
          ? ['Medication reconciliation summary', 'Clinical handover report', 'Discharge medication list']
          : [],
      }

      return { data: { safety_assessment: safetyAssessment, evidence_summary: evidenceSummary } }
    },
    enabled: !!patientId,
  })
}

export function useEscalations(patientId: string | undefined) {
  return useQuery<{ data: Escalation[] }>({
    queryKey: ['escalations', patientId],
    queryFn: () => ({ data: clinicalStore.getEscalations(patientId!) }),
    enabled: !!patientId,
  })
}

export function useKnowledgeGraph(patientId: string | undefined) {
  return useQuery<{ data: { nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] } }>({
    queryKey: ['graph', patientId],
    queryFn: () => ({ data: clinicalStore.getKnowledgeGraph(patientId!) }),
    enabled: !!patientId,
  })
}

export function useAgents(patientId: string | undefined) {
  return useQuery<{ data: AgentRun[] }>({
    queryKey: ['agents', patientId],
    queryFn: () => ({ data: clinicalStore.getAgentRuns(patientId!) }),
    enabled: !!patientId,
  })
}

export function useRunAgents(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => {
      if (!patientId) throw new Error('No patient selected')
      const session = clinicalStore.runAnalysis(patientId)
      return Promise.resolve({ data: { session_id: session.id } })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents', patientId] })
      qc.invalidateQueries({ queryKey: ['analysis', patientId] })
      qc.invalidateQueries({ queryKey: ['diagnoses', patientId] })
      qc.invalidateQueries({ queryKey: ['medications', patientId] })
      qc.invalidateQueries({ queryKey: ['labs', patientId] })
      qc.invalidateQueries({ queryKey: ['timeline', patientId] })
      qc.invalidateQueries({ queryKey: ['contradictions', patientId] })
      qc.invalidateQueries({ queryKey: ['missing', patientId] })
      qc.invalidateQueries({ queryKey: ['escalations', patientId] })
      qc.invalidateQueries({ queryKey: ['graph', patientId] })
      qc.invalidateQueries({ queryKey: ['uncertainty', patientId] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useGenerateReport(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => {
      if (!patientId) throw new Error('No patient selected')
      const analysis = clinicalStore.getAnalysis(patientId)
      const contradictions = clinicalStore.getContradictions(patientId)
      const missing = clinicalStore.getMissing(patientId)
      const gateState = analysis?.safety_gate_state ?? 'YELLOW'

      const report: HandoverReport = {
        id: crypto.randomUUID(),
        patient_id: patientId,
        safety_gate_state: gateState as HandoverReport['safety_gate_state'],
        report_data: {
          patient: { id: patientId } as never,
          summary: gateState === 'RED'
            ? '❌ SUMMARY BLOCKED — Safety Gate: RED\n\nCritical unresolved contradictions prevent safe summary generation.\nHuman clinical review is required before this report can be used.'
            : 'Clinical summary generated from extracted documentation. All information must be verified by a qualified clinician.',
          diagnoses: clinicalStore.getDiagnoses(patientId),
          medications: clinicalStore.getMedications(patientId),
          lab_results: clinicalStore.getLabs(patientId),
          timeline: clinicalStore.getTimeline(patientId),
          contradictions,
          missing_information: missing,
          escalations: clinicalStore.getEscalations(patientId),
          evidence_summary: { total_statements: analysis?.total_statements ?? 0, verified: analysis?.verified_count ?? 0, supported: 2, uncertain: analysis?.uncertain_count ?? 0, conflicting: analysis?.conflicting_count ?? 0, missing: analysis?.missing_count ?? 0, superseded: 0, evidence_completeness_score: 0.5 },
          safety_assessment: { gate_state: gateState as never, gate_reason: '', critical_issues: [], unresolved_contradictions: contradictions.filter(c => c.status === 'open').length, missing_critical_info: missing.filter(m => m.is_critical).length, can_generate_summary: gateState !== 'RED', blocked_conclusions: [] },
        },
        unresolved_passport: contradictions.filter(c => c.status === 'open').map(c => ({
          issue_id: c.id,
          description: c.description,
          related_information: `${c.category} contradiction (${c.severity})`,
          supporting_documents: [c.document_a_id, c.document_b_id].filter(Boolean) as string[],
          reason_unresolved: 'Conflicting statements require clinician review',
          potentially_affected_records: ['Clinical summary', 'Medication reconciliation'],
          recommended_verification_action: 'Review original source documents',
          escalation_status: 'open' as const,
        })),
        version: (clinicalStore.getReports(patientId).length + 1),
        is_draft: gateState !== 'GREEN',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      clinicalStore.saveReport(patientId, report)
      return Promise.resolve({ data: report })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports', patientId] })
    },
  })
}

export function useReports(patientId: string | undefined) {
  return useQuery<{ data: HandoverReport[] }>({
    queryKey: ['reports', patientId],
    queryFn: () => ({ data: clinicalStore.getReports(patientId!) }),
    enabled: !!patientId,
  })
}
