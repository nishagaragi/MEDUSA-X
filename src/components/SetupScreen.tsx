import { Heart, ExternalLink, Copy, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={handleCopy}
      className="ml-2 p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700"
      title="Copy"
    >
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

export function SetupScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-navy-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8 text-teal-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">TRUST-MED AI</h1>
          <p className="text-gray-500 mt-1">Setup Required</p>
        </div>

        {/* Alert */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
          <h2 className="font-semibold text-amber-900 mb-1">⚠ Supabase credentials not configured</h2>
          <p className="text-sm text-amber-800">
            The <code className="bg-amber-100 px-1 rounded">.env</code> file still contains placeholder values.
            Follow the steps below to connect your Supabase database and get the app running.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-4">

          {/* Step 1 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-navy-800 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">1</div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Create a free Supabase project</h3>
                <p className="text-sm text-gray-500 mb-3">Sign up at Supabase (free tier is enough) and create a new project.</p>
                <a
                  href="https://supabase.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-700 hover:text-navy-900"
                >
                  Open Supabase <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-navy-800 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">2</div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Get your credentials</h3>
                <p className="text-sm text-gray-500 mb-2">In your Supabase dashboard: <strong>Settings → API</strong></p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Copy your <strong>Project URL</strong></li>
                  <li>• Copy your <strong>anon / public key</strong></li>
                  <li>• Copy your <strong>service_role key</strong> (keep secret)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-navy-800 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">3</div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2">Edit your <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">.env</code> file</h3>
                <p className="text-sm text-gray-500 mb-3">Run this in PowerShell, then fill in your values and save:</p>
                <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-green-400 relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-500">PowerShell</span>
                    <CopyButton text={`notepad "c:\\Users\\DELL\\OneDrive\\Desktop\\medus\\.env"`} />
                  </div>
                  <code>notepad "c:\Users\DELL\OneDrive\Desktop\medus\.env"</code>
                </div>
                <div className="mt-3 bg-gray-50 rounded-lg p-3 font-mono text-xs space-y-1">
                  <div className="text-gray-600">Replace these lines:</div>
                  <div className="text-blue-700">VITE_SUPABASE_URL=<span className="text-red-500">https://your-project-id.supabase.co</span></div>
                  <div className="text-blue-700">VITE_SUPABASE_ANON_KEY=<span className="text-red-500">your-supabase-anon-key-here</span></div>
                  <div className="text-blue-700">SUPABASE_URL=<span className="text-red-500">https://your-project-id.supabase.co</span></div>
                  <div className="text-blue-700">SUPABASE_SERVICE_ROLE_KEY=<span className="text-red-500">your-supabase-service-role-key-here</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-navy-800 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">4</div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Apply database migrations</h3>
                <p className="text-sm text-gray-500 mb-2">In Supabase Dashboard → SQL Editor, run these files in order:</p>
                <ul className="text-sm text-gray-600 space-y-1 font-mono">
                  <li className="flex items-center gap-1">
                    <span className="text-gray-400">1.</span>
                    <code>supabase/migrations/001_initial_schema.sql</code>
                  </li>
                  <li className="flex items-center gap-1">
                    <span className="text-gray-400">2.</span>
                    <code>supabase/migrations/002_row_level_security.sql</code>
                  </li>
                  <li className="flex items-center gap-1">
                    <span className="text-gray-400">3.</span>
                    <code>supabase/seed/demo-data.sql</code>
                    <span className="text-gray-400 text-xs not-italic">(optional demo patient)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-navy-800 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">5</div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Restart the app</h3>
                <p className="text-sm text-gray-500 mb-2">Press <kbd className="bg-gray-200 px-1.5 py-0.5 rounded text-xs">Ctrl+C</kbd> in PowerShell to stop, then:</p>
                <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-green-400 relative">
                  <CopyButton text="npm run dev" />
                  <code>npm run dev</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          TRUST-MED AI · Clinical information reconciliation prototype · Not for direct patient care
        </p>
      </div>
    </div>
  )
}
