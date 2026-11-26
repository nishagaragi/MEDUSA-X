-- ============================================================
-- TRUST-MED AI — Synthetic Demo Data
-- ALL RECORDS ARE FICTIONAL AND FOR DEMONSTRATION ONLY
-- Do not use real patient data for demonstrations
-- ============================================================

-- Demo organization
INSERT INTO organizations (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'TRUST-MED Demo Workspace', 'demo-workspace')
ON CONFLICT DO NOTHING;

-- Demo patient — deliberately inconsistent records
INSERT INTO patients (id, organization_id, mrn, first_name, last_name, date_of_birth, gender, blood_type, is_demo, allergies) VALUES
  (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'DEMO-001',
    'James',
    'Thornton',
    '1952-07-14',
    'Male',
    'A+',
    TRUE,
    '["Penicillin", "NSAIDs"]'
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- Demo documents (5 deliberately inconsistent synthetic records)
-- ============================================================

-- Document 1: Admission note
INSERT INTO documents (id, patient_id, organization_id, original_filename, storage_path, mime_type, document_type, document_date, status, page_count, is_demo) VALUES
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'SYNTHETIC_admission_note_2024_01_15.txt', 'demo/admission_note.txt', 'text/plain',
   'admission_note', '2024-01-15', 'analyzed', 2, TRUE),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'SYNTHETIC_lab_report_2024_01_16.txt', 'demo/lab_report.txt', 'text/plain',
   'lab_report', '2024-01-16', 'analyzed', 3, TRUE),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'SYNTHETIC_prescription_2024_01_17.txt', 'demo/prescription.txt', 'text/plain',
   'prescription', '2024-01-17', 'analyzed', 1, TRUE),
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'SYNTHETIC_progress_note_2024_01_20.txt', 'demo/progress_note.txt', 'text/plain',
   'progress_note', '2024-01-20', 'analyzed', 2, TRUE),
  ('00000000-0000-0000-0001-000000000005', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'SYNTHETIC_discharge_summary_2024_01_25.txt', 'demo/discharge_summary.txt', 'text/plain',
   'discharge_summary', '2024-01-25', 'analyzed', 4, TRUE)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Demo diagnoses — deliberately conflicting status
-- ============================================================
INSERT INTO diagnoses (patient_id, document_id, icd_code, description, status, onset_date, evidence_status, source_page, source_text) VALUES
  -- Heart failure — active in admission, "resolved" in discharge (CONFLICT)
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000001',
   'I50.9', 'Congestive Heart Failure', 'active', '2024-01-15', 'verified', 1,
   'Patient admitted with known congestive heart failure, currently decompensated'),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000005',
   'I50.9', 'Congestive Heart Failure', 'resolved', '2024-01-15', 'conflicting', 1,
   'Heart failure resolved — patient discharged in stable condition'),
  -- Type 2 Diabetes — consistent
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000001',
   'E11.9', 'Type 2 Diabetes Mellitus', 'active', '2015-03-01', 'supported', 1,
   'Background: Type 2 Diabetes Mellitus diagnosed 2015'),
  -- Hypertension — mentioned without evidence
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000004',
   'I10', 'Essential Hypertension', 'active', NULL, 'missing_evidence', 1,
   'Continue antihypertensive as per previous prescription')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Demo medications — deliberately conflicting dosages
-- ============================================================
INSERT INTO medications (id, patient_id, name, generic_name, current_state, evidence_status, has_conflicts) VALUES
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0000-000000000010',
   'Furosemide', 'furosemide', 'conflicting', 'conflicting', TRUE),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0000-000000000010',
   'Metformin', 'metformin', 'discontinued', 'conflicting', TRUE),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0000-000000000010',
   'Lisinopril', 'lisinopril', 'started', 'missing_evidence', FALSE),
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0000-000000000010',
   'Warfarin', 'warfarin', 'uncertain', 'uncertain', FALSE)
ON CONFLICT DO NOTHING;

-- Medication events — conflicting Furosemide dosages across documents
INSERT INTO medication_events (medication_id, patient_id, document_id, event_type, dosage, frequency, route, event_date, documented_date, source_page, source_text, evidence_status) VALUES
  -- Furosemide: 40mg in admission, 80mg in discharge (CONFLICT)
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000001',
   'prescribed', '40mg', 'Once daily', 'Oral', '2024-01-15', '2024-01-15', 1,
   'Furosemide 40mg PO once daily for fluid management', 'verified'),
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000005',
   'modified', '80mg', 'Twice daily', 'Oral', '2024-01-25', '2024-01-25', 2,
   'Discharge: Furosemide 80mg BD — doses doubled for ongoing fluid control', 'conflicting'),
  -- Metformin: discontinued without documentation
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000003',
   'prescribed', '1000mg', 'Twice daily', 'Oral', '2024-01-17', '2024-01-17', 1,
   'Metformin 1000mg BD continue', 'verified'),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000005',
   'discontinued', '1000mg', 'Twice daily', 'Oral', '2024-01-25', '2024-01-25', 3,
   'Metformin stopped — reason not documented', 'uncertain')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Demo laboratory results — referenced but missing result
-- ============================================================
INSERT INTO laboratory_results (patient_id, document_id, test_name, value, unit, reference_range_low, reference_range_high, is_abnormal, sample_date, status, evidence_status, source_page, source_text) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000002',
   'Serum Creatinine', '142', 'μmol/L', 44, 97, TRUE, '2024-01-16', 'available', 'verified', 1,
   'Creatinine: 142 μmol/L (High)'),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000002',
   'eGFR', '38', 'mL/min/1.73m²', 60, NULL, TRUE, '2024-01-16', 'available', 'verified', 1,
   'eGFR: 38 mL/min — moderate CKD'),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000002',
   'Serum BNP', '1240', 'pg/mL', 0, 100, TRUE, '2024-01-16', 'available', 'verified', 2,
   'BNP 1240 pg/mL — elevated, consistent with heart failure'),
  -- Referenced but result NOT available (Ghost record)
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000004',
   'Echocardiogram LVEF', NULL, '%', NULL, NULL, NULL, '2024-01-18', 'missing', 'missing_evidence', 1,
   'Echo ordered — awaiting LVEF result'),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000004',
   'Troponin I', NULL, 'ng/mL', NULL, NULL, NULL, '2024-01-20', 'referenced_only', 'missing_evidence', 2,
   'Troponin sent — results to follow')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Demo clinical events — time discrepancy
-- ============================================================
INSERT INTO clinical_events (patient_id, document_id, category, description, event_date, documented_date, date_confidence, evidence_status, source_page, source_text, is_backdated) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000001',
   'admission', 'Emergency admission — acute decompensated heart failure',
   '2024-01-15', '2024-01-15', 'exact', 'verified', 1,
   'Patient admitted 15/01/2024 via ED', FALSE),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000002',
   'investigation', 'Blood tests and BNP ordered',
   '2024-01-16', '2024-01-16', 'exact', 'verified', 1,
   'Bloods sent 16/01/2024', FALSE),
  -- Echocardiogram ordered, result missing
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000004',
   'investigation', 'Echocardiogram ordered — LVEF result unavailable',
   '2024-01-18', '2024-01-20', 'approximate', 'missing_evidence', 1,
   'Echo requested — no report in file', TRUE),
  -- Treatment change without documentation
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000005',
   'treatment_change', 'Furosemide dose doubled — no prescriber note documenting reason',
   '2024-01-25', '2024-01-25', 'exact', 'uncertain', 2,
   'Furosemide increased to 80mg BD on discharge prescription', FALSE),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000005',
   'discharge', 'Discharged to community care — heart failure management plan',
   '2024-01-25', '2024-01-25', 'exact', 'verified', 1,
   'Patient discharged 25/01/2024', FALSE)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Demo contradictions
-- ============================================================
INSERT INTO contradictions (patient_id, category, description, document_a_id, document_b_id, page_a, page_b, text_a, text_b, severity, status) VALUES
  -- Heart failure status conflict
  ('00000000-0000-0000-0000-000000000010', 'diagnosis',
   'Heart failure documented as "active" in admission but "resolved" in discharge summary',
   '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0001-000000000005',
   1, 1,
   'Patient admitted with known congestive heart failure, currently decompensated',
   'Heart failure resolved — patient discharged in stable condition',
   'high', 'open'),
  -- Furosemide dosage conflict
  ('00000000-0000-0000-0000-000000000010', 'medication',
   'Furosemide prescribed as 40mg once daily in admission but 80mg twice daily in discharge',
   '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0001-000000000005',
   1, 2,
   'Furosemide 40mg PO once daily for fluid management',
   'Discharge: Furosemide 80mg BD — doses doubled for ongoing fluid control',
   'critical', 'open'),
  -- Metformin continuation conflict
  ('00000000-0000-0000-0000-000000000010', 'medication',
   'Metformin listed as active in prescription but discontinued without documentation in discharge',
   '00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0001-000000000005',
   1, 3,
   'Metformin 1000mg BD continue',
   'Metformin stopped — reason not documented',
   'high', 'open')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Demo missing information (Ghost records)
-- ============================================================
INSERT INTO missing_information (patient_id, missing_type, description, referenced_in_document_id, referenced_on_page, referenced_text, clinician_question, is_critical) VALUES
  ('00000000-0000-0000-0000-000000000010', 'missing_result',
   'Echocardiogram LVEF result referenced but report not available',
   '00000000-0000-0000-0001-000000000004', 1,
   'Echo ordered — awaiting LVEF result',
   'What was the LVEF result from the echocardiogram on 18/01/2024? This is essential for heart failure management.',
   TRUE),
  ('00000000-0000-0000-0000-000000000010', 'missing_result',
   'Troponin I result referenced in progress note but not available',
   '00000000-0000-0000-0001-000000000004', 2,
   'Troponin sent — results to follow',
   'Was the Troponin I result ever documented? Could not locate in available records.',
   TRUE),
  ('00000000-0000-0000-0000-000000000010', 'undocumented_treatment_change',
   'Furosemide dose doubled on discharge without prescriber note or clinical justification',
   '00000000-0000-0000-0001-000000000005', 2,
   'Furosemide 80mg BD on discharge',
   'Who authorized doubling the Furosemide dose? No prescriber note found.',
   TRUE),
  ('00000000-0000-0000-0000-000000000010', 'missing_clinical_detail',
   'Metformin stopped on discharge but no reason documented',
   '00000000-0000-0000-0001-000000000005', 3,
   'Metformin stopped — reason not documented',
   'Why was Metformin discontinued? Was this due to renal function (CKD stage 3) or another reason?',
   FALSE)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Demo analysis session
-- ============================================================
INSERT INTO analysis_sessions (
  patient_id, status, safety_gate_state,
  total_statements, verified_count, uncertain_count, conflicting_count, escalation_count,
  started_at, completed_at
) VALUES (
  '00000000-0000-0000-0000-000000000010',
  'completed', 'RED',
  28, 12, 8, 6, 3,
  '2024-01-26T10:00:00Z', '2024-01-26T10:02:30Z'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- Demo escalations (from critical contradictions)
-- ============================================================
INSERT INTO escalations (patient_id, severity, status, title, description, safety_gate_state, recommended_action, blocked_conclusions) VALUES
  ('00000000-0000-0000-0000-000000000010', 'blocking', 'open',
   'Critical: Conflicting Furosemide dosage across documents',
   'Admission prescribes 40mg once daily. Discharge prescribes 80mg twice daily. No dose change documentation found. This represents a 4-fold dosage increase without clinical justification.',
   'RED',
   'Locate prescriber responsible for discharge prescription and confirm intended dose. Do not administer until resolved.',
   '["Medication reconciliation summary", "Discharge medication list", "Community prescribing transfer"]'),
  ('00000000-0000-0000-0000-000000000010', 'critical', 'open',
   'Missing LVEF result — essential for heart failure management',
   'Echocardiogram was ordered and performed but LVEF result is not documented in any available record. This is clinically significant for heart failure management.',
   'RED',
   'Retrieve echocardiogram report from cardiology. Required before discharge plan can be confirmed.',
   '["Heart failure risk stratification", "Long-term management plan"]')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Demo agent runs
-- ============================================================
INSERT INTO agent_runs (patient_id, agent_name, status, findings, warnings, started_at, completed_at, execution_time_ms) VALUES
  ('00000000-0000-0000-0000-000000000010', 'document_detective', 'completed',
   '{"documents_processed": 5, "types_identified": ["admission_note", "lab_report", "prescription", "progress_note", "discharge_summary"]}',
   '[]', '2024-01-26T10:00:01Z', '2024-01-26T10:00:15Z', 14000),
  ('00000000-0000-0000-0000-000000000010', 'timeline_agent', 'completed',
   '{"events_extracted": 5, "gaps_detected": 1, "backdated_entries": 1}',
   '["Echocardiogram event date uncertain — documentation delayed by 2 days"]',
   '2024-01-26T10:00:15Z', '2024-01-26T10:00:35Z', 20000),
  ('00000000-0000-0000-0000-000000000010', 'medication_auditor', 'completed',
   '{"medications_found": 4, "conflicts_detected": 2, "undocumented_changes": 1}',
   '["Metformin discontinuation undocumented", "Furosemide dosage conflict requires human review"]',
   '2024-01-26T10:00:35Z', '2024-01-26T10:00:58Z', 23000),
  ('00000000-0000-0000-0000-000000000010', 'laboratory_verification_agent', 'completed',
   '{"results_found": 5, "missing_results": 2, "abnormal_values": 3}',
   '["Troponin result missing", "LVEF result missing — critical for cardiac management"]',
   '2024-01-26T10:00:58Z', '2024-01-26T10:01:12Z', 14000),
  ('00000000-0000-0000-0000-000000000010', 'diagnosis_investigator', 'completed',
   '{"diagnoses_found": 4, "conflicts": 1, "unsupported": 1}',
   '["CHF status contradicts between admission and discharge"]',
   '2024-01-26T10:01:12Z', '2024-01-26T10:01:30Z', 18000),
  ('00000000-0000-0000-0000-000000000010', 'evidence_auditor', 'completed',
   '{"statements_verified": 12, "statements_flagged": 8, "source_gaps": 3}',
   '[]',
   '2024-01-26T10:01:30Z', '2024-01-26T10:01:48Z', 18000),
  ('00000000-0000-0000-0000-000000000010', 'safety_escalation_agent', 'completed',
   '{"gate_state": "RED", "escalations_created": 2, "conclusions_blocked": 3}',
   '["SAFETY GATE: RED — 1 critical contradiction blocks summary generation", "Human review mandatory before handover"]',
   '2024-01-26T10:01:48Z', '2024-01-26T10:02:00Z', 12000)
ON CONFLICT DO NOTHING;
