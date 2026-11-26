-- ============================================================
-- TRUST-MED AI — Initial Database Schema
-- Migration 001: Core tables
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Organizations (tenancy)
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Users
-- ============================================================
CREATE TYPE user_role AS ENUM ('administrator', 'clinician', 'medical_records_reviewer');

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE,  -- Supabase auth.users id
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'clinician',
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- Patients
-- ============================================================
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  mrn TEXT,  -- Medical Record Number
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT,
  blood_type TEXT,
  allergies JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  is_demo BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patients_organization ON patients(organization_id);
CREATE INDEX idx_patients_mrn ON patients(mrn);
CREATE INDEX idx_patients_is_demo ON patients(is_demo);

-- ============================================================
-- Documents
-- ============================================================
CREATE TYPE document_type AS ENUM (
  'admission_note', 'discharge_summary', 'progress_note',
  'lab_report', 'prescription', 'operation_report',
  'radiology_report', 'consultation_note', 'referral_letter',
  'unknown'
);

CREATE TYPE document_status AS ENUM (
  'uploaded', 'validated', 'extracting', 'extracted',
  'classifying', 'classified', 'analyzing', 'analyzed', 'failed'
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,  -- Supabase Storage path
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT,
  document_type document_type DEFAULT 'unknown',
  document_date DATE,  -- Clinical date on the document
  status document_status DEFAULT 'uploaded',
  page_count INTEGER,
  extraction_error TEXT,
  is_demo BOOLEAN DEFAULT FALSE,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_patient ON documents(patient_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_type ON documents(document_type);

-- ============================================================
-- Document Extractions (extracted text per page)
-- ============================================================
CREATE TABLE IF NOT EXISTS document_extractions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  raw_text TEXT,
  cleaned_text TEXT,
  extraction_method TEXT,  -- 'pdf_text', 'ocr', 'docx'
  confidence FLOAT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_extractions_document ON document_extractions(document_id);
CREATE INDEX idx_extractions_page ON document_extractions(document_id, page_number);

-- ============================================================
-- Clinical Statements (atomic verified claims)
-- ============================================================
CREATE TYPE evidence_status AS ENUM (
  'verified', 'supported', 'uncertain', 'conflicting', 'missing_evidence', 'superseded'
);

CREATE TABLE IF NOT EXISTS clinical_statements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id),
  statement_type TEXT NOT NULL,  -- 'diagnosis', 'medication', 'lab_result', 'procedure', etc.
  content TEXT NOT NULL,
  evidence_status evidence_status DEFAULT 'uncertain',
  evidence_score FLOAT CHECK (evidence_score >= 0 AND evidence_score <= 1),
  evidence_explanation TEXT,
  source_page INTEGER,
  source_text TEXT,
  is_contradicted BOOLEAN DEFAULT FALSE,
  is_superseded_by UUID REFERENCES clinical_statements(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_statements_patient ON clinical_statements(patient_id);
CREATE INDEX idx_statements_document ON clinical_statements(document_id);
CREATE INDEX idx_statements_status ON clinical_statements(evidence_status);
CREATE INDEX idx_statements_type ON clinical_statements(statement_type);

-- ============================================================
-- Diagnoses
-- ============================================================
CREATE TABLE IF NOT EXISTS diagnoses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id),
  icd_code TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'active', 'resolved', 'suspected', 'ruled_out', 'conflicting'
  onset_date DATE,
  resolution_date DATE,
  evidence_status evidence_status DEFAULT 'uncertain',
  source_page INTEGER,
  source_text TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_diagnoses_patient ON diagnoses(patient_id);
CREATE INDEX idx_diagnoses_status ON diagnoses(status);

-- ============================================================
-- Medications
-- ============================================================
CREATE TYPE medication_state AS ENUM (
  'prescribed', 'started', 'continued', 'modified',
  'discontinued', 'uncertain', 'conflicting'
);

CREATE TABLE IF NOT EXISTS medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  generic_name TEXT,
  drug_class TEXT,
  current_state medication_state DEFAULT 'uncertain',
  evidence_status evidence_status DEFAULT 'uncertain',
  has_conflicts BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_medications_patient ON medications(patient_id);
CREATE INDEX idx_medications_state ON medications(current_state);

CREATE TABLE IF NOT EXISTS medication_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  document_id UUID REFERENCES documents(id),
  event_type medication_state NOT NULL,
  dosage TEXT,
  strength TEXT,
  frequency TEXT,
  route TEXT,
  event_date DATE,
  documented_date DATE,
  source_page INTEGER,
  source_text TEXT,
  evidence_status evidence_status DEFAULT 'uncertain',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_med_events_medication ON medication_events(medication_id);
CREATE INDEX idx_med_events_patient ON medication_events(patient_id);

-- ============================================================
-- Laboratory Results
-- ============================================================
CREATE TABLE IF NOT EXISTS laboratory_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id),
  test_name TEXT NOT NULL,
  test_code TEXT,
  value TEXT,
  numeric_value FLOAT,
  unit TEXT,
  reference_range_low FLOAT,
  reference_range_high FLOAT,
  reference_range_text TEXT,
  is_abnormal BOOLEAN,
  is_critical BOOLEAN DEFAULT FALSE,
  sample_date DATE,
  reported_date DATE,
  status TEXT DEFAULT 'available',  -- 'available', 'missing', 'pending', 'referenced_only'
  evidence_status evidence_status DEFAULT 'uncertain',
  source_page INTEGER,
  source_text TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_labs_patient ON laboratory_results(patient_id);
CREATE INDEX idx_labs_test_name ON laboratory_results(test_name);
CREATE INDEX idx_labs_status ON laboratory_results(status);

-- ============================================================
-- Clinical Events (timeline reconstruction)
-- ============================================================
CREATE TYPE clinical_event_category AS ENUM (
  'admission', 'discharge', 'investigation', 'prescription',
  'procedure', 'progress_note', 'consultation', 'lab_result',
  'diagnosis', 'treatment_change', 'unknown'
);

CREATE TABLE IF NOT EXISTS clinical_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id),
  category clinical_event_category DEFAULT 'unknown',
  description TEXT NOT NULL,
  event_date DATE,  -- When it clinically occurred
  documented_date DATE,  -- When it was recorded
  date_confidence TEXT DEFAULT 'exact',  -- 'exact', 'approximate', 'inferred', 'unknown'
  evidence_status evidence_status DEFAULT 'uncertain',
  source_page INTEGER,
  source_text TEXT,
  is_backdated BOOLEAN DEFAULT FALSE,
  timeline_gap_before_days INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_patient ON clinical_events(patient_id);
CREATE INDEX idx_events_date ON clinical_events(patient_id, event_date);
CREATE INDEX idx_events_category ON clinical_events(category);

-- ============================================================
-- Evidence References
-- ============================================================
CREATE TABLE IF NOT EXISTS evidence_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_type TEXT NOT NULL,  -- 'clinical_statement', 'diagnosis', 'medication_event', etc.
  source_id UUID NOT NULL,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number INTEGER,
  supporting_text TEXT,
  confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evidence_source ON evidence_references(source_type, source_id);
CREATE INDEX idx_evidence_document ON evidence_references(document_id);

-- ============================================================
-- Contradictions
-- ============================================================
CREATE TYPE contradiction_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE contradiction_status AS ENUM (
  'open', 'confirmed_discrepancy', 'resolved_with_evidence',
  'requires_more_documentation', 'escalated'
);

CREATE TABLE IF NOT EXISTS contradictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  category TEXT NOT NULL,  -- 'medication', 'diagnosis', 'lab_result', 'timeline', 'treatment'
  description TEXT NOT NULL,
  statement_a_id UUID REFERENCES clinical_statements(id),
  statement_b_id UUID REFERENCES clinical_statements(id),
  document_a_id UUID REFERENCES documents(id),
  document_b_id UUID REFERENCES documents(id),
  page_a INTEGER,
  page_b INTEGER,
  text_a TEXT,
  text_b TEXT,
  severity contradiction_severity DEFAULT 'medium',
  status contradiction_status DEFAULT 'open',
  resolution_note TEXT,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contradictions_patient ON contradictions(patient_id);
CREATE INDEX idx_contradictions_status ON contradictions(status);
CREATE INDEX idx_contradictions_severity ON contradictions(severity);

-- ============================================================
-- Missing Information
-- ============================================================
CREATE TYPE missing_info_type AS ENUM (
  'missing_document', 'missing_result', 'missing_clinical_detail',
  'undocumented_treatment_change', 'incomplete_timeline', 'unresolved_reference'
);

CREATE TABLE IF NOT EXISTS missing_information (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  missing_type missing_info_type NOT NULL,
  description TEXT NOT NULL,
  referenced_in_document_id UUID REFERENCES documents(id),
  referenced_on_page INTEGER,
  referenced_text TEXT,
  clinician_question TEXT,
  is_critical BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'open',  -- 'open', 'pending_review', 'resolved', 'accepted_as_missing'
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_missing_patient ON missing_information(patient_id);
CREATE INDEX idx_missing_type ON missing_information(missing_type);

-- ============================================================
-- Knowledge Graph Nodes + Edges
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_graph_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL,  -- 'diagnosis', 'medication', 'lab_test', 'event', 'document', 'statement'
  label TEXT NOT NULL,
  reference_id UUID,  -- ID in the respective table
  evidence_status evidence_status DEFAULT 'uncertain',
  metadata JSONB DEFAULT '{}',
  position_x FLOAT DEFAULT 0,
  position_y FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_graph_nodes_patient ON knowledge_graph_nodes(patient_id);
CREATE INDEX idx_graph_nodes_type ON knowledge_graph_nodes(node_type);

CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL,  -- 'supports', 'contradicts', 'references', 'occurred_before', etc.
  evidence_status evidence_status DEFAULT 'uncertain',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_graph_edges_patient ON knowledge_graph_edges(patient_id);
CREATE INDEX idx_graph_edges_source ON knowledge_graph_edges(source_node_id);
CREATE INDEX idx_graph_edges_target ON knowledge_graph_edges(target_node_id);

-- ============================================================
-- Agent Runs
-- ============================================================
CREATE TYPE agent_name AS ENUM (
  'document_detective', 'timeline_agent', 'diagnosis_investigator',
  'medication_auditor', 'laboratory_verification_agent',
  'evidence_auditor', 'safety_escalation_agent'
);

CREATE TYPE agent_status AS ENUM (
  'queued', 'running', 'completed', 'failed', 'blocked_by_safety'
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  agent_name agent_name NOT NULL,
  task TEXT,
  status agent_status DEFAULT 'queued',
  findings JSONB DEFAULT '{}',
  warnings JSONB DEFAULT '[]',
  errors JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  execution_time_ms INTEGER,
  triggered_by UUID REFERENCES users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_runs_patient ON agent_runs(patient_id);
CREATE INDEX idx_agent_runs_agent ON agent_runs(agent_name);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);

-- ============================================================
-- Escalations
-- ============================================================
CREATE TYPE escalation_severity AS ENUM ('warning', 'critical', 'blocking');
CREATE TYPE escalation_status AS ENUM ('open', 'in_review', 'resolved', 'closed');

CREATE TABLE IF NOT EXISTS escalations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  contradiction_id UUID REFERENCES contradictions(id),
  missing_info_id UUID REFERENCES missing_information(id),
  severity escalation_severity DEFAULT 'warning',
  status escalation_status DEFAULT 'open',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  blocked_conclusions JSONB DEFAULT '[]',
  safety_gate_state TEXT NOT NULL DEFAULT 'RED',  -- 'GREEN', 'YELLOW', 'RED'
  recommended_action TEXT,
  assigned_to UUID REFERENCES users(id),
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_escalations_patient ON escalations(patient_id);
CREATE INDEX idx_escalations_status ON escalations(status);
CREATE INDEX idx_escalations_severity ON escalations(severity);

-- ============================================================
-- Handover Reports
-- ============================================================
CREATE TABLE IF NOT EXISTS handover_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  generated_by UUID REFERENCES users(id),
  safety_gate_state TEXT NOT NULL,
  report_data JSONB NOT NULL DEFAULT '{}',
  unresolved_passport JSONB DEFAULT '[]',
  pdf_storage_path TEXT,
  version INTEGER DEFAULT 1,
  is_draft BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_handover_patient ON handover_reports(patient_id);

-- ============================================================
-- Audit Logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  patient_id UUID REFERENCES patients(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_patient ON audit_logs(patient_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ============================================================
-- Analysis Sessions (track full analysis runs)
-- ============================================================
CREATE TABLE IF NOT EXISTS analysis_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  triggered_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'running',  -- 'running', 'completed', 'failed', 'partial'
  safety_gate_state TEXT,
  total_statements INTEGER DEFAULT 0,
  verified_count INTEGER DEFAULT 0,
  uncertain_count INTEGER DEFAULT 0,
  conflicting_count INTEGER DEFAULT 0,
  missing_count INTEGER DEFAULT 0,
  escalation_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_analysis_patient ON analysis_sessions(patient_id);

-- ============================================================
-- Updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_statements_updated_at BEFORE UPDATE ON clinical_statements FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_diagnoses_updated_at BEFORE UPDATE ON diagnoses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_medications_updated_at BEFORE UPDATE ON medications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_contradictions_updated_at BEFORE UPDATE ON contradictions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_missing_updated_at BEFORE UPDATE ON missing_information FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_escalations_updated_at BEFORE UPDATE ON escalations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_handover_updated_at BEFORE UPDATE ON handover_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();
