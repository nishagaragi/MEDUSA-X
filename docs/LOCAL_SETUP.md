# TRUST-MED AI — Local Development Setup

## Prerequisites

Install these before starting:

| Tool | Version | Download |
|------|---------|----------|
| Node.js | 18.x LTS or later | https://nodejs.org |
| npm | 9.x or later | (included with Node.js) |
| Netlify CLI | latest | `npm install -g netlify-cli` |
| Git | any | https://git-scm.com |

---

## Step 1 — Install dependencies

```powershell
cd c:\Users\DELL\OneDrive\Desktop\medus
npm install
```

---

## Step 2 — Set up Supabase

1. Go to https://supabase.com and create a free project
2. Note your **Project URL** and **anon key** from Settings → API
3. Note your **service role key** (keep this secret — never commit)

### Apply database migrations

In the Supabase Dashboard → SQL Editor, run these files in order:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_row_level_security.sql`

### Create Storage bucket

In Supabase Dashboard → Storage:
- Create a bucket named `medical-documents`
- Set it to **Private** (not public)

### Load demo data (optional)

In SQL Editor, run: `supabase/seed/demo-data.sql`

---

## Step 3 — Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```powershell
Copy-Item .env.example .env
```

Edit `.env`:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

AI_PROVIDER_API_KEY=your-openai-or-compatible-api-key
AI_MODEL=gpt-4o

APP_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
```

**Important:**
- `SUPABASE_SERVICE_ROLE_KEY` must NEVER be in a `VITE_` variable
- `AI_PROVIDER_API_KEY` must NEVER be in a `VITE_` variable
- Never commit `.env` to git

---

## Step 4 — Run locally

### Option A — Vite dev server only (frontend)

```powershell
npm run dev
```
Opens at http://localhost:3000

API calls will fail without Netlify CLI (backend not running).

### Option B — Full stack with Netlify Dev (recommended)

```powershell
# Install Netlify CLI first
npm install -g netlify-cli

# Log in to Netlify
netlify login

# Start full stack
netlify dev
```
Opens at http://localhost:8888 with API functions running.

---

## Step 5 — Run tests

```powershell
# Run all tests once
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## AI Provider Configuration

TRUST-MED AI uses an OpenAI-compatible API. Supported providers:
- **OpenAI** (default): Set `AI_MODEL=gpt-4o`
- **Azure OpenAI**: Set `AI_API_BASE` to your Azure endpoint
- **Anthropic Claude**: Not directly compatible — requires adapter

If `AI_PROVIDER_API_KEY` is not set, the system will show a "Service requires configuration" error rather than fabricating results.

---

## Common Issues

| Problem | Solution |
|---------|----------|
| `Missing VITE_SUPABASE_URL` | Copy .env.example to .env and fill in values |
| Auth not working | Check Supabase Auth settings — disable email confirmation for dev |
| File upload fails | Create `medical-documents` bucket in Supabase Storage |
| AI features not working | Set `AI_PROVIDER_API_KEY` in .env |
| Dashboard shows 0 for all stats | Run analysis on a patient first |
