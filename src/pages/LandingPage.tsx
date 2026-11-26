import { Link } from 'react-router-dom'
import {
  Heart, Shield, Search, Clock, Pill, AlertTriangle, Ghost,
  Network, Radar, Bot, FileText, ArrowRight, CheckCircle2,
  XCircle, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const modules = [
  {
    num: '01',
    title: 'Clinical Truth Engine',
    icon: Search,
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Assigns evidence status to every clinical statement—Verified, Supported, Uncertain, Conflicting, Missing, or Superseded.',
  },
  {
    num: '02',
    title: 'Medical Time Machine',
    icon: Clock,
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    description: 'Reconstructs the patient\'s clinical chronology, detects gaps, backdated entries, and separates event time from documentation time.',
  },
  {
    num: '03',
    title: 'Medication Detective',
    icon: Pill,
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'Tracks the full lifecycle of every medication, identifies conflicts, undocumented changes, and duplicate prescriptions.',
  },
  {
    num: '04',
    title: 'Ghost Record Detector',
    icon: Ghost,
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    description: 'Finds referenced investigations without results, surgeries without operation reports, and undocumented treatment changes.',
  },
  {
    num: '05',
    title: 'Clinical Detective Swarm',
    icon: Bot,
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    description: 'Seven specialized AI agents—from document classification to safety escalation—operating under verified structured JSON.',
  },
  {
    num: '06',
    title: 'Clinical Butterfly Effect',
    icon: Network,
    color: 'bg-pink-50 text-pink-700 border-pink-200',
    description: 'Builds an interactive patient knowledge graph, tracing how uncertain information propagates to downstream conclusions.',
  },
  {
    num: '07',
    title: 'Uncertainty Radar',
    icon: Radar,
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Three-state safety gate: GREEN to proceed, YELLOW to qualify, RED to block and escalate. Never silently resolves contradictions.',
  },
  {
    num: '08',
    title: 'Patient Handover Guardian',
    icon: FileText,
    color: 'bg-green-50 text-green-700 border-green-200',
    description: 'Generates evidence-linked clinical summaries, Unresolved Issues Passports, and downloadable PDF handover reports.',
  },
]

const safetyExamples = [
  { status: 'GREEN', label: 'PROCEED', desc: 'All sources consistent — qualified summary generated', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-400' },
  { status: 'YELLOW', label: 'QUALIFY', desc: 'Missing lab results — facts shown with open issues', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-400' },
  { status: 'RED', label: 'ESCALATE', desc: 'Conflicting medication dosages — conclusion blocked', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-400' },
]

const techStack = [
  'React 18 + TypeScript', 'Vite + Tailwind CSS', 'Node.js Serverless',
  'Netlify Functions', 'localStorage Data Store', 'Client-side Processing',
  'AI Agent Orchestration', 'Zod Validation', 'React Flow Graphs',
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-navy-800 rounded-lg flex items-center justify-center">
              <Heart className="w-5 h-5 text-clinical-teal" />
            </div>
            <span className="font-bold text-navy-900 text-lg">TRUST-MED AI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button size="sm">Enter App</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-b from-navy-950 to-navy-800 text-white py-24">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-navy-800 border border-navy-700 rounded-full px-4 py-1.5 text-sm text-navy-300 mb-6">
            <Shield className="w-4 h-4 text-clinical-teal" />
            Self-Verifying Agentic Clinical Intelligence Platform
          </div>
          <h1 className="text-5xl font-bold leading-tight mb-6 text-white">
            Medical Records Are Not<br />Always the Truth.<br />
            <span className="text-clinical-teal">Your AI Should Know the Difference.</span>
          </h1>
          <p className="text-xl text-navy-300 max-w-3xl mx-auto mb-10 leading-relaxed">
            TRUST-MED AI investigates evidence, reconstructs patient histories, detects contradictions, 
            and knows when to stop. The defining feature is not what it summarizes—it is what it refuses to invent.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/dashboard">
              <Button size="xl" variant="clinical">
                Launch Clinical Workspace
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link to="/patients">
              <Button size="xl" variant="outline" className="border-navy-600 text-white hover:bg-navy-800">
                View Demo Patient
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Safety Philosophy */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-navy-900 mb-4">The Safety Gate</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Every analysis produces a transparent safety assessment. The system cannot silently 
              resolve a contradiction or convert uncertain information into a verified conclusion.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {safetyExamples.map(({ status, label, desc, color, bg, border }) => (
              <div key={status} className={`rounded-xl border-2 ${border} ${bg} p-6`}>
                <div className={`text-2xl font-black ${color} mb-2`}>{status}</div>
                <div className={`text-sm font-bold ${color} mb-3`}>{label}</div>
                <p className={`text-sm ${color}`}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8 Modules */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-navy-900 mb-4">Eight Integrated Innovations</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              A unified platform where every module contributes to a single verifiable patient picture.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {modules.map(({ num, title, icon: Icon, color, description }) => (
              <div key={num} className="rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-2xl font-black text-gray-200">{num}</span>
                </div>
                <h3 className="font-semibold text-navy-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-navy-950 text-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-navy-300">From raw medical documents to a verified, evidence-traced clinical summary.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { step: '1', label: 'Upload Documents', desc: 'PDF, DOCX, images' },
              { step: '2', label: 'Extract & Classify', desc: 'Text, OCR, metadata' },
              { step: '3', label: 'Agent Analysis', desc: '7 specialized agents' },
              { step: '4', label: 'Safety Assessment', desc: 'GREEN / YELLOW / RED' },
              { step: '5', label: 'Verified Report', desc: 'Evidence-linked PDF' },
            ].map(({ step, label, desc }, idx, arr) => (
              <div key={step} className="flex items-center gap-2">
                <div className="flex-1 text-center">
                  <div className="w-10 h-10 rounded-full bg-clinical-teal text-white font-bold text-sm flex items-center justify-center mx-auto mb-2">
                    {step}
                  </div>
                  <div className="text-sm font-medium text-white">{label}</div>
                  <div className="text-xs text-navy-400">{desc}</div>
                </div>
                {idx < arr.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-navy-600 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key principles */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-navy-900 mb-1">Evidence First</h3>
                <p className="text-sm text-gray-500">Every statement traces back to its source document, page, and text.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-navy-900 mb-1">Never Fabricates</h3>
                <p className="text-sm text-gray-500">The system refuses to invent information or silently choose between conflicting records.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-navy-900 mb-1">Human Review Required</h3>
                <p className="text-sm text-gray-500">Critical contradictions escalate to qualified reviewers. The AI never decides alone.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <h3 className="text-center text-sm font-semibold uppercase tracking-wider text-gray-400 mb-6">Technology Stack</h3>
          <div className="flex flex-wrap justify-center gap-3">
            {techStack.map(tech => (
              <span key={tech} className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-600 font-medium">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-navy-800 text-white text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-4">Ready to Investigate Your Medical Records?</h2>
          <p className="text-navy-300 mb-8">
            Upload your synthetic test records and see the Clinical Detective Swarm in action.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/dashboard">
              <Button size="xl" variant="clinical">
                Launch Clinical Workspace
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
          <p className="text-xs text-navy-500 mt-6">
            Use only synthetic test records for demonstrations. This is a research prototype, not a clinically certified system.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-950 text-navy-500 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-clinical-teal" />
            <span className="text-sm font-semibold text-white">TRUST-MED AI</span>
          </div>
          <p className="text-xs text-navy-500">
            Clinical information reconciliation and decision-support prototype. Not a diagnostic or treatment system.
            Requires qualified human review before any clinical use.
          </p>
          <div className="flex justify-center gap-6 mt-4 text-xs">
            <Link to="/dashboard" className="hover:text-white">Dashboard</Link>
            <Link to="/patients" className="hover:text-white">Patients</Link>
            <Link to="/agents" className="hover:text-white">Agents</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
