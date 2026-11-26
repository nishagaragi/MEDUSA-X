# TRUST-MED AI — API Endpoint Reference

Base URL: `/api/v1`

All endpoints require `Authorization: Bearer <supabase-jwt>` except where noted.

---

## Authentication

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Register new user and organization |
| `GET` | `/auth/me` | Get current user profile |

### POST /auth/register
```json
{
  "email": "clinician@hospital.org",
  "password": "securepassword",
  "full_name": "Dr. Jane Smith",
  "organization_name": "City General Hospital"
}
```

---

## Dashboard

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/dashboard` | Aggregated stats and recent activity |

---

## Patients

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/patients` | List patients (paginated) |
| `POST` | `/patients` | Create patient |
| `GET` | `/patients/:id` | Get patient details |
| `PATCH` | `/patients/:id` | Update patient |
| `DELETE` | `/patients/:id` | Delete patient (admin only) |

**Query params for GET /patients:** `page`, `limit`, `search`

---

## Documents

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/patients/:id/documents` | Upload document (multipart/form-data, field: `file`) |
| `GET` | `/patients/:id/documents` | List patient documents |
| `GET` | `/documents/:id` | Get document metadata |
| `DELETE` | `/documents/:id` | Delete document |
| `POST` | `/documents/:id/process` | Trigger text extraction |
| `GET` | `/documents/:id/status` | Check processing status |

---

## Analysis

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/patients/:id/analyze` | Run full analysis |
| `GET` | `/patients/:id/analysis` | Get latest analysis session |
| `GET` | `/patients/:id/timeline` | Reconstructed clinical timeline |
| `GET` | `/patients/:id/diagnoses` | Extracted diagnoses |
| `GET` | `/patients/:id/medications` | Medications with lifecycle events |
| `GET` | `/patients/:id/laboratory-results` | Lab results |
| `GET` | `/patients/:id/evidence` | Evidence references |

---

## Contradictions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/patients/:id/contradictions` | List contradictions |
| `GET` | `/contradictions/:id` | Get contradiction details |
| `PATCH` | `/contradictions/:id/review` | Record review decision |

### PATCH /contradictions/:id/review
```json
{
  "status": "confirmed_discrepancy",
  "resolution_note": "Verified with prescribing physician"
}
```
Status values: `confirmed_discrepancy` | `resolved_with_evidence` | `requires_more_documentation` | `escalated`

---

## Missing Information

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/patients/:id/missing-information` | List missing/ghost records |

---

## Safety & Uncertainty

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/patients/:id/uncertainty` | Safety gate assessment + evidence summary |
| `GET` | `/patients/:id/escalations` | Active escalations |
| `POST` | `/patients/:id/escalations` | Create escalation |

---

## Knowledge Graph

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/patients/:id/graph` | Knowledge graph nodes and edges |

---

## Agents

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/patients/:id/agents/run` | Activate all 7 agents |
| `GET` | `/patients/:id/agents/status` | Current agent run statuses |

---

## Reports

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/patients/:id/reports` | Generate handover report |
| `GET` | `/patients/:id/reports` | List reports |
| `GET` | `/reports/:id` | Get full report data |
| `GET` | `/reports/:id/download` | Download report as file |

---

## Audit

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/audit/logs` | Audit log (admin/reviewer only) |

**Query params:** `page`, `limit`, `patient_id`, `action`

---

## Error Responses

All errors return:
```json
{
  "error": "Human-readable message",
  "code": "ERROR_CODE"
}
```

| Status | Code | Meaning |
|--------|------|---------|
| 400 | `ERROR` | Validation failed |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Insufficient role |
| 404 | `NOT_FOUND` | Resource not found |
| 405 | `METHOD_NOT_ALLOWED` | Wrong HTTP method |
| 500 | (generic) | Server error — check logs |
