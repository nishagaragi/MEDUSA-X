-- ============================================================
-- TRUST-MED AI — Row Level Security Policies
-- Migration 002: RLS setup
-- ============================================================

-- Enable RLS on all sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE laboratory_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE contradictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE missing_information ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper function: get current user's internal user record
-- ============================================================
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_current_user_org()
RETURNS UUID AS $$
  SELECT organization_id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Users: users can read their own record; admins see all in org
-- ============================================================
CREATE POLICY "users_read_own" ON users
  FOR SELECT USING (auth_id = auth.uid() OR organization_id = get_current_user_org());

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth_id = auth.uid());

-- ============================================================
-- Patients: org members can access patients in same org
-- ============================================================
CREATE POLICY "patients_org_access" ON patients
  FOR ALL USING (organization_id = get_current_user_org());

-- ============================================================
-- Documents: patients must be in same org
-- ============================================================
CREATE POLICY "documents_org_access" ON documents
  FOR ALL USING (
    patient_id IN (
      SELECT id FROM patients WHERE organization_id = get_current_user_org()
    )
  );

-- ============================================================
-- Clinical data: patient must be in same org
-- ============================================================
CREATE POLICY "statements_org_access" ON clinical_statements
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE organization_id = get_current_user_org())
  );

CREATE POLICY "diagnoses_org_access" ON diagnoses
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE organization_id = get_current_user_org())
  );

CREATE POLICY "medications_org_access" ON medications
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE organization_id = get_current_user_org())
  );

CREATE POLICY "med_events_org_access" ON medication_events
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE organization_id = get_current_user_org())
  );

CREATE POLICY "labs_org_access" ON laboratory_results
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE organization_id = get_current_user_org())
  );

CREATE POLICY "events_org_access" ON clinical_events
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE organization_id = get_current_user_org())
  );

CREATE POLICY "contradictions_org_access" ON contradictions
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE organization_id = get_current_user_org())
  );

CREATE POLICY "missing_org_access" ON missing_information
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE organization_id = get_current_user_org())
  );

CREATE POLICY "graph_nodes_org_access" ON knowledge_graph_nodes
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE organization_id = get_current_user_org())
  );

CREATE POLICY "graph_edges_org_access" ON knowledge_graph_edges
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE organization_id = get_current_user_org())
  );

CREATE POLICY "agent_runs_org_access" ON agent_runs
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE organization_id = get_current_user_org())
  );

CREATE POLICY "escalations_org_access" ON escalations
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE organization_id = get_current_user_org())
  );

CREATE POLICY "handover_org_access" ON handover_reports
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE organization_id = get_current_user_org())
  );

CREATE POLICY "analysis_org_access" ON analysis_sessions
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE organization_id = get_current_user_org())
  );

-- Document extractions: via document
CREATE POLICY "extractions_org_access" ON document_extractions
  FOR ALL USING (
    document_id IN (
      SELECT d.id FROM documents d
      JOIN patients p ON d.patient_id = p.id
      WHERE p.organization_id = get_current_user_org()
    )
  );

-- Evidence references: via document
CREATE POLICY "evidence_refs_org_access" ON evidence_references
  FOR ALL USING (
    document_id IN (
      SELECT d.id FROM documents d
      JOIN patients p ON d.patient_id = p.id
      WHERE p.organization_id = get_current_user_org()
    )
  );

-- ============================================================
-- Audit logs: admins see org-wide; others see own
-- ============================================================
CREATE POLICY "audit_own_or_admin" ON audit_logs
  FOR SELECT USING (
    user_id = get_current_user_id()
    OR get_current_user_role() = 'administrator'
  );

CREATE POLICY "audit_insert_own" ON audit_logs
  FOR INSERT WITH CHECK (user_id = get_current_user_id());
