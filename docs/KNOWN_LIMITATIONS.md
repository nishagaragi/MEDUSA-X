# TRUST-MED AI — Known Limitations

## Deployment Environment Constraints

### PDF / DOCX / OCR Processing
- **Limitation:** Netlify Functions have a 10-second default timeout and ephemeral filesystem. Full PDF extraction with PyMuPDF and OCR (Tesseract) cannot run in-process.
- **Current behavior:** Documents are uploaded to Supabase Storage. The `POST /documents/:id/process` endpoint marks documents for processing. Extraction must be handled by a background job.
- **Production recommendation:** Use Supabase Edge Functions, a dedicated processing worker, or a managed OCR service (e.g., AWS Textract, Google Document AI) triggered via webhook.
- **Impact:** Text extraction and AI analysis of uploaded documents requires the background processor to be configured separately.

### AI Analysis
- **Limitation:** The AI analysis pipeline requires `AI_PROVIDER_API_KEY` to be configured. Without it, extraction endpoints return a "Service requires configuration" error — they never fabricate results.
- **Impact:** Dashboard stats will show real database counts only. Analysis runs will queue agent runs but AI extraction will fail gracefully.

### PDF Report Generation
- **Limitation:** The `/reports/:id/download` endpoint currently returns a plain text representation. Full PDF generation requires a library like Puppeteer (not viable in Netlify Functions due to binary size).
- **Production recommendation:** Use a PDF generation service (Gotenberg, WeasyPrint, or a Netlify Function with `@sparticuz/chromium`).

### Knowledge Graph Layout
- **Limitation:** Node positions are initialized randomly. For large graphs, automatic layout algorithms (Dagre, ELK) provide better results.
- **Status:** React Flow manual layout and drag-to-arrange are fully functional.

### Background Agent Execution
- **Limitation:** The seven agents currently queue their runs in the database but execute inline within the analysis endpoint. For large document sets, this may exceed serverless timeouts.
- **Production recommendation:** Use a job queue (e.g., Inngest, Trigger.dev, or Supabase pg_cron) to run agents asynchronously.

### Full-text Search
- **Limitation:** Patient and document search uses `ilike` (case-insensitive substring). Full-text search across extracted document content requires PostgreSQL `tsvector` indexes (can be added via migration).

---

## Clinical Limitations

**This is a research prototype and information reconciliation tool. It is NOT:**
- A clinically validated diagnostic system
- A certified medical device
- A replacement for qualified clinical judgment
- Compliant with any specific healthcare regulation without independent assessment

**The system is designed to:**
- Surface contradictions and gaps in documentation
- Assist qualified clinicians in reviewing complex medical records
- Never silently resolve ambiguities or invent clinical information
- Always require human review for safety-critical decisions

---

## Data Privacy

- Use only synthetic/fictional records for demonstrations
- Implement appropriate data handling agreements before processing real patient data
- Supabase Row Level Security is implemented but should be independently audited before clinical use
- Audit logging captures actions but log retention policies must be configured separately
