import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from './components/layout/AppLayout'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import PatientsPage from './pages/PatientsPage'
import DocumentUploadPage from './pages/DocumentUploadPage'
import PatientReconstructionPage from './pages/PatientReconstructionPage'
import ContradictionCenterPage from './pages/ContradictionCenterPage'
import UncertaintyRadarPage from './pages/UncertaintyRadarPage'
import AgentControlPage from './pages/AgentControlPage'
import HandoverReportPage from './pages/HandoverReportPage'
import KnowledgeGraphPage from './pages/KnowledgeGraphPage'
import GhostRecordPage from './pages/GhostRecordPage'
import AuditPage from './pages/AuditPage'
import MedicationReconciliationPage from './pages/MedicationReconciliationPage'
import TimelinePage from './pages/TimelinePage'
import PatientDetailPage from './pages/PatientDetailPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Landing page */}
          <Route path="/" element={<LandingPage />} />

          {/* App — no login required */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/patients" element={<PatientsPage />} />
            <Route path="/patients/:id" element={<PatientDetailPage />} />
            <Route path="/patients/:id/reconstruction" element={<PatientReconstructionPage />} />
            <Route path="/patients/:id/agents" element={<AgentControlPage />} />
            <Route path="/upload" element={<DocumentUploadPage />} />
            <Route path="/reconstruction" element={<PatientReconstructionPage />} />
            <Route path="/timeline" element={<TimelinePage />} />
            <Route path="/contradictions" element={<ContradictionCenterPage />} />
            <Route path="/medications" element={<MedicationReconciliationPage />} />
            <Route path="/ghost-records" element={<GhostRecordPage />} />
            <Route path="/knowledge-graph" element={<KnowledgeGraphPage />} />
            <Route path="/uncertainty" element={<UncertaintyRadarPage />} />
            <Route path="/agents" element={<AgentControlPage />} />
            <Route path="/handover" element={<HandoverReportPage />} />
            <Route path="/audit" element={<AuditPage />} />
          </Route>

          {/* Redirect everything else to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
