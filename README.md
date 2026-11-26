# TRUST-MED AI
### The Self-Verifying Agentic Clinical Intelligence Platform

> **"Medical Records Are Not Always the Truth. Your AI Should Know the Difference."**

TRUST-MED AI is a full-stack agentic clinical intelligence platform that investigates evidence, reconstructs patient histories, detects contradictions, traces the impact of unreliable information, and — critically — knows when to stop.

⚠️ **For demonstration and research use with synthetic records only. Not certified for clinical use.**

---

## Eight Integrated Innovations

| # | Module | Capability |
|---|--------|-----------|
| 01 | Clinical Truth Engine | Evidence status for every statement: Verified / Supported / Uncertain / Conflicting / Missing / Superseded |
| 02 | Medical Time Machine | Chronological reconstruction, gap detection, event vs. documentation time |
| 03 | Medication Detective | Full lifecycle tracking, conflict detection, undocumented changes |
| 04 | Ghost Record Detector | Missing results, referenced but unavailable documents, incomplete timelines |
| 05 | Clinical Detective Swarm | 7 specialized AI agents operating on structured JSON evidence |
| 06 | Clinical Butterfly Effect | Interactive knowledge graph, impact propagation from uncertain data |
| 07 | Uncertainty Radar | Safety gate: GREEN / YELLOW / RED — blocks unsafe conclusions |
| 08 | Patient Handover Guardian | Evidence-linked summaries, Unresolved Issues Passport, PDF export |

---

## The Safety Gate

The defining feature is **controlled clinical abstention**:

- **GREEN — PROCEED:** Evidence is consistent → qualified summary generated
- **YELLOW — QUALIFY:** Gaps or uncertainty exist → facts shown with caveats
- **RED — ESCALATE:** Critical contradiction or insufficient evidence → **conclusion blocked**, human review required

The system cannot silently resolve contradictions, invent dates, or choose between conflicting medication dosages.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Visualizations | Recharts, React Flow |
| Backend | Node.js, Netlify Functions (serverless) |
| Database | Supabase PostgreSQL + Row Level Security |
| Storage | Supabase Storage (private buckets) |
| AI | OpenAI-compatible API (configurable) |
| Validation | Zod (frontend + backend) |
| Testing | Vitest |

---

## Quick Start

### Prerequisites
- Node.js 18+ (https://nodejs.org)
- Supabase account (https://supabase.com)
- OpenAI API key (or compatible provider)
- Netlify CLI: `npm install -g netlify-cli`

### Local development

```powershell
# 1. Install dependencies
cd trust-med-ai
npm install

# 2. Configure environment
Copy-Item .env.example .env
# Edit .env with your Supabase and AI credentials

# 3. Apply database migrations
# → Paste supabase/migrations/001_initial_schema.sql in Supabase SQL Editor
# → Paste supabase/migrations/002_row_level_security.sql in Supabase SQL Editor

# 4. Create Storage bucket
# → Supabase Dashboard → Storage → New bucket "medical-documents" (Private)

# 5. Load demo data (optional)
# → Paste supabase/seed/demo-data.sql in Supabase SQL Editor

# 6. Start development server
netlify dev        # Full stack (recommended)
# OR
npm run dev        # Frontend only
```

### Run tests

```powershell
npm test                 # All tests
npm run test:coverage    # With coverage report
```

---

## Project Structure

```
trust-med-ai/
├── src/                          # React frontend
│   ├── components/               # UI components
│   ├── pages/                    # 13 application pages
│   ├── hooks/                    # Data fetching hooks
│   ├── lib/                      # Supabase client, API, utils
│   └── types/                    # TypeScript types
├── netlify/functions/            # Serverless backend
│   ├── api.ts                    # API router
│   ├── auth/                     # Authentication
│   ├── patients/                 # Patient management
│   ├── documents/                # Document upload & processing
│   ├── analysis/                 # Clinical analysis endpoints
│   ├── reports/                  # Handover report generation
│   ├── audit/                    # Audit logs
│   ├── dashboard/                # Dashboard stats
│   └── agents/modules/           # AI agent modules
├── supabase/
│   ├── migrations/               # Database schema (apply in order)
│   └── seed/                     # Synthetic demo data
├── tests/
│   ├── unit/                     # Unit tests
│   └── safety/                   # Safety scenario tests
└── docs/                         # Setup guides
```

---

## Application Pages

1. **Landing Page** — Project overview and CTA
2. **Dashboard** — Live stats, recent analyses, agent activity
3. **Patients** — Create and manage patients
4. **Document Upload** — Drag-and-drop multi-file upload
5. **Patient Reconstruction** — Diagnoses, medications, labs, timeline
6. **Contradiction Center** — Review and resolve clinical conflicts
7. **Medication Reconciliation** — Lifecycle tracking with conflict detection
8. **Ghost Record Detector** — Missing documentation finder
9. **Knowledge Graph** — Interactive clinical knowledge visualization
10. **Uncertainty Radar** — Safety gate assessment with evidence breakdown
11. **Agent Control Center** — Seven-agent swarm status panel
12. **Patient Handover** — Report generation with Unresolved Issues Passport
13. **Audit & Security** — Full audit trail (admin/reviewer only)

---

## Deployment

See [`docs/NETLIFY_DEPLOYMENT.md`](docs/NETLIFY_DEPLOYMENT.md) for full deployment instructions.

---

## Known Limitations

See [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md) for a complete list.

Key notes:
- OCR/PDF extraction requires a background processing service (not in-process for large files)
- AI analysis requires a configured `AI_PROVIDER_API_KEY`
- PDF report export returns text format; full PDF requires additional setup
- This is a research prototype, not a certified clinical system

---

## Synthetic Demo Patient

The seed data includes **James Thornton (DEMO-001)** with deliberately inconsistent records:

| Conflict | Documents | Type |
|----------|-----------|------|
| Furosemide 40mg vs 80mg BD | Admission vs Discharge | Critical contradiction |
| CHF "active" vs "resolved" | Admission vs Discharge | High contradiction |
| Metformin stopped without documentation | Prescription vs Discharge | High contradiction |
| LVEF echocardiogram result missing | Progress note | Ghost record |
| Troponin result referenced but unavailable | Progress note | Ghost record |
| Echocardiogram documentation delayed 2 days | Progress note | Timeline discrepancy |

Expected safety gate: **RED** — multiple critical contradictions block summary generation.

---

*TRUST-MED AI · Clinical information reconciliation prototype · Not for direct patient care*
