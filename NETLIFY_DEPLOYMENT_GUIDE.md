# TRUST-MED AI — Netlify Deployment Guide

## This app requires NO external services
No Supabase. No database. No API keys needed for deployment.
Data is stored in the user's browser (localStorage).

---

## Step 1 — Install dependencies locally

```powershell
cd "c:\Users\DELL\OneDrive\Desktop\medus"
npm install
```

## Step 2 — Run locally

```powershell
npm run dev
```
Open: http://localhost:3001

## Step 3 — Push to GitHub

```powershell
git init
git add .
git commit -m "TRUST-MED AI production build"
git remote add origin https://github.com/YOUR_USERNAME/trust-med-ai.git
git push -u origin main
```

## Step 4 — Deploy to Netlify

1. Go to https://app.netlify.com
2. Click **Add new site → Import from Git**
3. Select your GitHub repo
4. Build settings (auto-detected from netlify.toml):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Click **Deploy site**

## Step 5 — Verify deployment

After ~2 minutes, your site is live at a URL like:
`https://trust-med-ai-xxxxx.netlify.app`

Check:
- [ ] Landing page loads
- [ ] Dashboard opens with demo patient
- [ ] All pages navigate correctly
- [ ] Demo patient data visible
- [ ] Analysis runs correctly
- [ ] Reports generate and download

## Optional: AI Provider (for real document analysis)

The agent analysis currently runs as a client-side simulation.
To enable real AI document analysis, add to Netlify environment variables:

```
AI_PROVIDER_API_KEY=your-openai-api-key
AI_MODEL=gpt-4o
```

The app works fully without this — agents show demo results.

## .env.example

```env
# Optional — only needed for AI analysis via Netlify Functions
AI_PROVIDER_API_KEY=your-openai-api-key-here
AI_MODEL=gpt-4o
APP_ENV=production
```

No VITE_ variables needed. No Supabase variables needed.
