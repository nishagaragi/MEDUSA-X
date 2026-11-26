# TRUST-MED AI — Netlify Deployment Guide

## Architecture

```
Browser → Netlify CDN (React frontend)
            → Netlify Functions (Node.js API, /api/v1/*)
                → Supabase PostgreSQL (data)
                → Supabase Storage (documents)
                → AI Provider (OpenAI API)
```

---

## Step 1 — Push to GitHub

```powershell
git init
git add .
git commit -m "Initial TRUST-MED AI implementation"
git remote add origin https://github.com/YOUR_USERNAME/trust-med-ai.git
git push -u origin main
```

---

## Step 2 — Connect to Netlify

1. Go to https://app.netlify.com
2. Click **Add new site → Import an existing project**
3. Connect your GitHub account
4. Select the `trust-med-ai` repository
5. Configure build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`

---

## Step 3 — Configure environment variables

In Netlify Dashboard → Site → Environment variables, add:

| Variable | Value | Visible in browser? |
|----------|-------|---------------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | ✅ Yes (safe) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | ✅ Yes (safe) |
| `SUPABASE_URL` | Your Supabase project URL | ❌ Server only |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | ❌ Server only |
| `AI_PROVIDER_API_KEY` | OpenAI API key | ❌ Server only |
| `AI_MODEL` | `gpt-4o` | ❌ Server only |
| `APP_ENV` | `production` | ❌ Server only |
| `ALLOWED_ORIGINS` | `https://your-site.netlify.app` | ❌ Server only |

**Critical:** Never put `SUPABASE_SERVICE_ROLE_KEY` or `AI_PROVIDER_API_KEY` in `VITE_`-prefixed variables.

---

## Step 4 — Deploy

Click **Deploy site** in Netlify Dashboard, or push to main branch.

Monitor build logs for errors. Build typically takes 2–3 minutes.

---

## Step 5 — Post-deployment verification

After deployment, verify:

- [ ] Landing page loads at your Netlify URL
- [ ] Registration creates a user (Supabase auth working)
- [ ] Login works
- [ ] Dashboard loads (Supabase connected)
- [ ] Document upload works (Supabase Storage bucket exists)
- [ ] API calls return data, not 404s
- [ ] Safety gate assessment runs correctly
- [ ] Demo patient data visible (if seed data applied)

---

## Supabase production setup

1. Enable **Row Level Security** on all tables (done in migration 002)
2. Configure **email templates** in Supabase Auth
3. Set **Authorized Redirect URLs** in Supabase Auth → URL Configuration:
   - `https://your-site.netlify.app`
   - `http://localhost:3000` (for local dev)

---

## Deployment checklist

- [ ] `netlify.toml` has correct build command and publish directory
- [ ] All environment variables set in Netlify dashboard
- [ ] Supabase migrations applied (001 and 002)
- [ ] `medical-documents` Storage bucket created as Private
- [ ] AI provider API key configured
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is NOT in any `VITE_` variable
- [ ] Production build succeeds (`npm run build`)
- [ ] Auth redirect URLs configured in Supabase
