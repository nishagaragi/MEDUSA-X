# TRUST-MED AI — Project Audit Report

## Summary
| Category | Count |
|----------|-------|
| Critical | 4 |
| High | 6 |
| Medium | 5 |
| Low | 3 |
| **Total** | **18** |

---

## CRITICAL

| ID | File | Issue | Fix |
|----|------|-------|-----|
| C-001 | `src/lib/supabase.ts` | `throw new Error()` at module load → blank white page | Replaced with graceful stub |
| C-002 | `package.json` | `@supabase/supabase-js` listed — not installed → build crash | Removed from package.json |
| C-003 | `vite.config.ts` | `manualChunks` referenced `@supabase/supabase-js` → Rollup crash | Removed the chunk entry |
| C-004 | All hooks | Every data hook called `/api/v1/...` endpoints requiring Netlify Dev → all pages showed errors | Replaced with localStorage store |

---

## HIGH

| ID | File | Issue | Fix |
|----|------|-------|-----|
| H-001 | `src/hooks/useAuth.ts` | Imported `@supabase/supabase-js` types → TS errors without package | Rewrote with no-auth stub |
| H-002 | `src/pages/AuditPage.tsx` | Imported dead `api` module → runtime error | Rewrote using `auditStore` |
| H-003 | `src/pages/ContradictionCenterPage.tsx` | Used `api.get()` for contradictions → 404 on every load | Rewrote using `useContradictions` hook |
| H-004 | `src/pages/HandoverReportPage.tsx` | Called `/api/v1/reports/:id/download` + `supabase.auth.getSession()` → crash | Replaced with client-side text download |
| H-005 | `src/pages/LoginPage.tsx` | Called `signIn(email, password)` on a no-auth system → TS error | Replaced with direct redirect |
| H-006 | `src/pages/RegisterPage.tsx` | Called `signUp(...)` with wrong arg count → TS error | Replaced with direct redirect |

---

## MEDIUM

| ID | File | Issue | Fix |
|----|------|-------|-----|
| M-001 | `src/types/index.ts` | `Diagnosis` and `Medication` missing `updated_at` field → store.ts TS errors | Added optional `updated_at` |
| M-002 | `src/types/index.ts` | `HandoverReport` missing `updated_at` → useAnalysis.ts TS error | Added optional `updated_at` |
| M-003 | `tsconfig.json` | `netlify/` not excluded → tsc picked up backend TS files with wrong module resolution | Added `"exclude": ["netlify"]` |
| M-004 | `src/hooks/useDashboard.ts` | Called `/api/v1/dashboard` → failed without backend | Replaced with `getDashboardStats()` |
| M-005 | `src/hooks/usePatients.ts` | All calls to `api.get/post/patch/delete` → failed | Replaced with `patientStore` |

---

## LOW

| ID | File | Issue | Fix |
|----|------|-------|-----|
| L-001 | `src/components/SetupScreen.tsx` | No longer needed (Supabase removed) | Left as unused component (doesn't affect build) |
| L-002 | `src/lib/supabase.ts` | File still exists as a stub | Harmless stub kept to prevent import errors |
| L-003 | `netlify/functions/lib/supabase-admin.ts` | Still imports `@supabase/supabase-js` | Only in backend functions, excluded from frontend build |
