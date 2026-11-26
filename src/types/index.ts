// ============================================================
// TRUST-MED AI — Core TypeScript Types
// ============================================================

export type UserRole = 'administrator' | 'clinician' | 'medical_records_reviewer';

export type EvidenceStatus =
  | 'verified'
  | 'supported'
  | 'uncertain'
  | 'conflicting'
  | 'missing_evidence'
  | 'superseded';

export type DocumentType =
  | 'admission_note'
  | 'discharge_summary'
  | 'progress_note'
  | 'lab_report'
  | 'prescription'
  | 'operation_report'
  | 'radiology_report'
  | 'consultation_note'
  | 'referral_letter'
  | 'unknown';

export type DocumentStatus =
  | 'uploaded'
  | 'validated'
  | 'extracting'
  | 'extracted'
  | 'classifying'
  | 'classified'
  | 'analyzing'
  | 'analyzed'
  | 'failed';

export type MedicationState =
  | 'prescribed'
  | 'started'
  | 'continued'
  | 'modified'
  | 'discontinued'
  | 'uncertain'
  | 'conflicting';

export type ContradictionSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ContradictionStatus =
  | 'open'
  | 'confirmed_discrepancy'
  | 'resolved_with_evidence'
  | 'requires_more_documentation'
  | 'escalated';

export type MissingInfoType =
  | 'missing_document'
  | 'missing_result'
  | 'missing_clinical_detail'
  | 'undocumented_treatment_change'
  | 'incomplete_timeline'
  | 'unresolved_reference';

export type SafetyGateState = 'GREEN' | 'YELLOW' | 'RED';

export type AgentName =
  | 'document_detective'
  | 'timeline_agent'
  | 'diagnosis_investigator'
  | 'medication_auditor'
  | 'laboratory_verification_agent'
  | 'evidence_auditor'
  | 'safety_escalation_agent';

export type AgentStatus = 'queued' | 'running' | 'completed' | 'failed' | 'blocked_by_safety';

export type EscalationSeverity = 'warning' | 'critical' | 'blocking';
export type EscalationStatus = 'open' | 'in_review' | 'resolved' | 'closed';

export type ClinicalEventCategory =
  | 'admission'
  | 'discharge'
  | 'investigation'
  | 'prescription'
  | 'procedure'
  | 'progress_note'
  | 'consultation'
  | 'lab_result'
  | 'diagnosis'
  | 'treatment_change'
  | 'unknown';

// ============================================================
// Domain models
// ============================================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface User {
  id: string;
  auth_id: string;
  organization_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
}

export interface Patient {
  id: string;
  organization_id: string;
  mrn?: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
  blood_type?: string;
  allergies: string[];
  is_demo: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Computed / joined
  full_name?: string;
  document_count?: number;
  analysis_count?: number;
}

export interface Document {
  id: string;
  patient_id: string;
  organization_id?: string;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes?: number;
  document_type: DocumentType;
  document_date?: string;
  status: DocumentStatus;
  page_count?: number;
  extraction_error?: string;
  is_demo: boolean;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentExtraction {
  id: string;
  document_id: string;
  page_number: number;
  raw_text?: string;
  cleaned_text?: string;
  extraction_method?: string;
  confidence?: number;
  created_at: string;
}

export interface ClinicalStatement {
  id: string;
  patient_id: string;
  document_id?: string;
  statement_type: string;
  content: string;
  evidence_status: EvidenceStatus;
  evidence_score?: number;
  evidence_explanation?: string;
  source_page?: number;
  source_text?: string;
  is_contradicted: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Diagnosis {
  id: string;
  patient_id: string;
  document_id?: string;
  icd_code?: string;
  description: string;
  status: string;
  onset_date?: string;
  resolution_date?: string;
  evidence_status: EvidenceStatus;
  source_page?: number;
  source_text?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface Medication {
  id: string;
  patient_id: string;
  name: string;
  generic_name?: string;
  drug_class?: string;
  current_state: MedicationState;
  evidence_status: EvidenceStatus;
  has_conflicts: boolean;
  created_at: string;
  updated_at?: string;
  events?: MedicationEvent[];
}

export interface MedicationEvent {
  id: string;
  medication_id: string;
  patient_id: string;
  document_id?: string;
  event_type: MedicationState;
  dosage?: string;
  strength?: string;
  frequency?: string;
  route?: string;
  event_date?: string;
  documented_date?: string;
  source_page?: number;
  source_text?: string;
  evidence_status: EvidenceStatus;
  notes?: string;
  created_at: string;
}

export interface LaboratoryResult {
  id: string;
  patient_id: string;
  document_id?: string;
  test_name: string;
  test_code?: string;
  value?: string;
  numeric_value?: number;
  unit?: string;
  reference_range_low?: number;
  reference_range_high?: number;
  reference_range_text?: string;
  is_abnormal?: boolean;
  is_critical: boolean;
  sample_date?: string;
  reported_date?: string;
  status: string;
  evidence_status: EvidenceStatus;
  source_page?: number;
  source_text?: string;
  notes?: string;
  created_at: string;
}

export interface ClinicalEvent {
  id: string;
  patient_id: string;
  document_id?: string;
  category: ClinicalEventCategory;
  description: string;
  event_date?: string;
  documented_date?: string;
  date_confidence: string;
  evidence_status: EvidenceStatus;
  source_page?: number;
  source_text?: string;
  is_backdated: boolean;
  timeline_gap_before_days?: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface EvidenceReference {
  id: string;
  source_type: string;
  source_id: string;
  document_id: string;
  page_number?: number;
  supporting_text?: string;
  confidence?: number;
  created_at: string;
}

export interface Contradiction {
  id: string;
  patient_id: string;
  category: string;
  description: string;
  statement_a_id?: string;
  statement_b_id?: string;
  document_a_id?: string;
  document_b_id?: string;
  page_a?: number;
  page_b?: number;
  text_a?: string;
  text_b?: string;
  severity: ContradictionSeverity;
  status: ContradictionStatus;
  resolution_note?: string;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  // Joined
  document_a?: Document;
  document_b?: Document;
}

export interface MissingInformation {
  id: string;
  patient_id: string;
  missing_type: MissingInfoType;
  description: string;
  referenced_in_document_id?: string;
  referenced_on_page?: number;
  referenced_text?: string;
  clinician_question?: string;
  is_critical: boolean;
  status: string;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeGraphNode {
  id: string;
  patient_id: string;
  node_type: string;
  label: string;
  reference_id?: string;
  evidence_status: EvidenceStatus;
  metadata: Record<string, unknown>;
  position_x: number;
  position_y: number;
  created_at: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  patient_id: string;
  source_node_id: string;
  target_node_id: string;
  relationship: string;
  evidence_status: EvidenceStatus;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgentRun {
  id: string;
  patient_id: string;
  agent_name: AgentName;
  task?: string;
  status: AgentStatus;
  findings: Record<string, unknown>;
  warnings: string[];
  errors: string[];
  started_at?: string;
  completed_at?: string;
  execution_time_ms?: number;
  created_at: string;
}

export interface Escalation {
  id: string;
  patient_id: string;
  contradiction_id?: string;
  missing_info_id?: string;
  severity: EscalationSeverity;
  status: EscalationStatus;
  title: string;
  description: string;
  blocked_conclusions: string[];
  safety_gate_state: SafetyGateState;
  recommended_action?: string;
  assigned_to?: string;
  resolved_by?: string;
  resolved_at?: string;
  resolution_note?: string;
  created_at: string;
  updated_at: string;
}

export interface HandoverReport {
  id: string;
  patient_id: string;
  generated_by?: string;
  safety_gate_state: SafetyGateState;
  report_data: HandoverReportData;
  unresolved_passport: UnresolvedIssue[];
  pdf_storage_path?: string;
  version: number;
  is_draft: boolean;
  created_at: string;
  updated_at?: string;
}

export interface HandoverReportData {
  patient: Patient;
  summary: string;
  diagnoses: Diagnosis[];
  medications: Medication[];
  lab_results: LaboratoryResult[];
  timeline: ClinicalEvent[];
  contradictions: Contradiction[];
  missing_information: MissingInformation[];
  escalations: Escalation[];
  evidence_summary: EvidenceSummary;
  safety_assessment: SafetyAssessment;
}

export interface UnresolvedIssue {
  issue_id: string;
  description: string;
  related_information: string;
  supporting_documents: string[];
  reason_unresolved: string;
  potentially_affected_records: string[];
  recommended_verification_action: string;
  escalation_status: EscalationStatus;
}

export interface EvidenceSummary {
  total_statements: number;
  verified: number;
  supported: number;
  uncertain: number;
  conflicting: number;
  missing: number;
  superseded: number;
  evidence_completeness_score: number;
}

export interface SafetyAssessment {
  gate_state: SafetyGateState;
  gate_reason: string;
  critical_issues: string[];
  unresolved_contradictions: number;
  missing_critical_info: number;
  can_generate_summary: boolean;
  blocked_conclusions: string[];
}

export interface AnalysisSession {
  id: string;
  patient_id: string;
  triggered_by?: string;
  status: string;
  safety_gate_state?: SafetyGateState;
  total_statements: number;
  verified_count: number;
  uncertain_count: number;
  conflicting_count: number;
  missing_count: number;
  escalation_count: number;
  started_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  organization_id?: string;
  patient_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  error_message?: string;
  created_at: string;
}

// ============================================================
// API response types
// ============================================================

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface DashboardStats {
  total_patients: number;
  total_documents: number;
  verified_statements: number;
  contradictions: number;
  missing_findings: number;
  escalations: number;
  recent_analyses: AnalysisSession[];
  agent_activity: AgentRun[];
}
