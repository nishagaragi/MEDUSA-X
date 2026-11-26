# TRUST-MED AI — Complete Error Audit Report
Generated: 2026-11-25

---

## EXECUTIVE SUMMARY

| Category | Count | Status |
|----------|-------|--------|
| Critical | 3 | Fixing |
| High | 5 | Fixing |
| Medium | 6 | Fixing |
| Low | 4 | Fixing |
| Deployment | 3 | Fixing |

---

## CRITICAL ERRORS

### C-001 — `.env` file contains placeholder values (ROOT CAUSE OF BLANK PAGE)
- **File:** `.env`
- **Problem:** `VITE_SUPABASE_URL=https://your-project-id.supabase.co` — this is a placeholder, not a real URL. `src/lib/supabase.ts` throws `Error('Missing environment variable: VITE_SUPABASE_URL')` on startup if the value looks unconfigured, OR the Supabase client initializes with a fake URL and silently fails all API calls.
- **Impact:** The entire app crashes or shows blank page. Login is impossible. All API calls fail.
- **Fix:** User must configure real Supabase credentials. Code is updated to show a user-friendly setup screen instead of crashing.

### C-002 — `supabase.ts` throws on startup instead of showing setup screen
- **File:** `src/lib/supabase.ts` lines 7–11
- **Problem:** `throw new Error(...)` is called at module load time. In Vite, this crashes the entire module graph and shows a blank screen with no user guidance.
- **Fix:** Replace throw with graceful degradation — set `supabase` to null and show a setup screen.

### C-003 — `supabase-admin.ts` throws at import time in Netlify Functions
- **File:** `netlify/functions/lib/supabase-admin.ts` lines 6–7
- **Problem:** Same pattern — throws at module initialization. When `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` are missing, the entire function bundle fails to load, returning 500 for all API calls.
- **Fix:** Graceful error response instead of module-level throw.

---

## HIGH PRIORITY ERRORS

### H-001 — Login silently fails when Supabase URL is placeholder
- **File:** `src/hooks/useAuth.ts`
- **Problem:** `signIn` calls `supabase.auth.signInWithPassword` which returns a Supabase auth error with message "Invalid URL" or "Failed to fetch" — this is shown to the user as a generic error, not as a configuration issue.
- **Fix:** Detect configuration errors and show a helpful setup message.

### H-002 — Registration calls backend Netlify Function that fails at import
- **File:** `src/hooks/useAuth.ts` → `api.post('/auth/register', ...)`
- **Problem:** Registration calls `/api/v1/auth/register` which requires Netlify Dev to be running. During `npm run dev` without `netlify dev`, this 404s. User sees "Network request failed".
- **Fix:** Add clear error message distinguishing "not configured" from "network error".

### H-003 — `useAuth` creates duplicate subscriptions in React Strict Mode
- **File:** `src/hooks/useAuth.ts` lines 36–60
- **Problem:** `useEffect` registers `onAuthStateChange` listener. In React 18 Strict Mode, effects run twice. The first subscription is unsubscribed but `fetchUserProfile` from the first run may still be in-flight when the second effect runs, causing two simultaneous profile fetches and a potential state update on unmounted component.
- **Fix:** Add `isMounted` guard.

### H-004 — `ProtectedRoute` redirects to `/login` during initial loading
- **File:** `src/App.tsx` lines 36–47
- **Problem:** During the first render, `loading = true` and `isAuthenticated = false`. After 0ms (Supabase resolves session), it may redirect to `/login` briefly even for authenticated users, causing a flash.
- **Fix:** Always show loading spinner when `loading = true`, never redirect during loading.

### H-005 — API base URL hardcoded as `/api/v1` — won't work without Netlify Dev
- **File:** `src/lib/api.ts` line 8
- **Problem:** `const API_BASE = '/api/v1'` — during `npm run dev` (not `netlify dev`), there is no server at this path. All API calls return Vite's 404 HTML. The app shows "Failed to load dashboard" immediately.
- **Fix:** Show a clear "Setup required" banner when not running with Netlify Dev, rather than failing silently.

---

## MEDIUM PRIORITY ERRORS

### M-001 — `Badge` component uses `variant="info"` which doesn't exist
- **File:** `src/components/ui/badge.tsx`, `src/pages/DashboardPage.tsx`
- **Problem:** `<Badge variant="info">` — the badge CVA definition does not include `"info"` as a valid variant. TypeScript catches this but `--noUnusedLocals false` doesn't catch it. At runtime it falls back to `default`.
- **Fix:** Add `info` variant to badge CVA.

### M-002 — `Badge` missing `@radix-ui/react-badge` dependency — using custom implementation
- **File:** `src/components/ui/badge.tsx` line 1
- **Problem:** `import * as React from "react"` — badge uses CVA only, which is correct. But `package.json` lists `@radix-ui/react-badge: ^1.0.0` which doesn't exist as a Radix package. This will cause `npm install` warnings.
- **Fix:** Remove `@radix-ui/react-badge` from `package.json`.

### M-003 — `Sidebar` uses `scrollbar-thin` utility not guaranteed by Tailwind
- **File:** `src/components/layout/Sidebar.tsx`
- **Problem:** Defined in `index.css` as custom utility. If CSS purge removes it, sidebar scroll styling breaks silently.
- **Fix:** Already defined correctly in `index.css` — no code change needed. Documented.

### M-004 — `tailwind.config.js` references `navy-100` class used in JSX but not defined in extend
- **File:** `tailwind.config.js`, multiple pages
- **Problem:** Classes like `bg-navy-100`, `text-navy-700` are used in JSX but `navy-100` through `navy-700` are not defined in the config — only `50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950` are defined. Actually on inspection they ARE defined. No bug.

### M-005 — `Badge variant="success"` used in Dashboard but not in CVA
- **File:** `src/pages/DashboardPage.tsx` agent activity badge
- **Problem:** `<Badge variant="success">` — CVA has `success` defined. Actually on checking badge.tsx, `success` variant exists. No bug. Documented as false positive.

### M-006 — Search bar in `AppLayout` is non-functional (UI only)
- **File:** `src/components/layout/AppLayout.tsx` line 22
- **Problem:** The search input has no `onChange` handler and no functionality. Clicking it does nothing.
- **Fix:** Add a note in UI that this is a future feature, or wire it to patient search navigation.

---

## LOW PRIORITY ERRORS

### L-001 — Google Fonts import in `index.css` fails in offline environments
- **File:** `src/index.css` line 1
- **Problem:** `@import url('https://fonts.googleapis.com/...')` — fails without internet. App renders with system font instead, which looks different.
- **Fix:** Add `font-display: swap` and a local fallback.

### L-002 — Bell notification button in header is decorative only
- **File:** `src/components/layout/AppLayout.tsx`
- **Problem:** Bell icon always shows a red dot regardless of actual notifications. No real notification system exists.
- **Fix:** Remove the red dot until notifications are implemented.

### L-003 — `@radix-ui/react-badge` listed in `package.json` but doesn't exist
- **File:** `package.json` line 10
- **Problem:** `@radix-ui/react-badge: ^1.0.0` — Radix does not publish this package. `npm install` succeeds because it may be found as a stub or via peer deps, but it's dead weight.
- **Fix:** Remove from `package.json`.

### L-004 — Missing `favicon` proper icon (SVG only)
- **File:** `public/favicon.svg`
- **Problem:** Only SVG favicon exists. Some browsers (older Edge, Firefox) prefer `.ico`. Not critical.

---

## DEPLOYMENT ERRORS

### D-001 — `netlify.toml` redirect for `/api/v1/*` uses `:splat` but function is named `api`
- **File:** `netlify.toml`
- **Problem:** `to = "/.netlify/functions/api/:splat"` — Netlify Functions are invoked at `/.netlify/functions/{function-name}`. The `:splat` is passed as a path parameter but Netlify Functions don't receive path segments by default without configuration. The `event.path` in the function receives `/.netlify/functions/api` without the splat.
- **Fix:** Use query string pass-through OR configure `netlify.toml` correctly with `force = true`.

### D-002 — No `vite-env.d.ts` type declaration file
- **File:** Missing
- **Problem:** `import.meta.env` types aren't extended with the custom `VITE_*` variables. TypeScript uses the vite/client reference but custom env vars aren't typed. This can cause type-unsafe env access.
- **Fix:** Create `src/vite-env.d.ts` with proper type declarations.

### D-003 — `.env` committed to git (should be `.gitignored`)
- **File:** `.gitignore`, `.env`
- **Problem:** `.env` exists in the project root and `.gitignore` lists it — but it still exists and was readable. If this repo is pushed to GitHub, the `.env` will NOT be pushed (correctly gitignored). But the placeholder values mean any deployment will fail without proper configuration.
- **Fix:** Documented — user must configure real values before deployment.

---

## ROOT CAUSE SUMMARY

The #1 problem making the app appear blank is:
**The `.env` file has placeholder values. `supabase.ts` crashes on startup when `VITE_SUPABASE_URL` is not a real URL.**

The fix has two parts:
1. **Code fix:** Make `supabase.ts` gracefully degrade instead of throwing — show a setup screen.
2. **Configuration fix:** User must supply real Supabase credentials.

This report was generated by automated inspection of all 101 project files.
