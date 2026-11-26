import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, Plus, Search, FileText, AlertTriangle, 
  User, Calendar, ChevronRight, FlaskConical,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { usePatients, useCreatePatient } from '@/hooks/usePatients'
import { formatDate, cn } from '@/lib/utils'
import { Patient } from '@/types'

function NewPatientForm({ onClose }: { onClose: () => void }) {
  const { mutate, isPending, error } = useCreatePatient()
  const [form, setForm] = useState({
    first_name: '', last_name: '', date_of_birth: '',
    gender: '', mrn: '', blood_type: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutate({ ...form, allergies: [] }, {
      onSuccess: () => onClose(),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>First Name *</Label>
          <Input
            value={form.first_name}
            onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Last Name *</Label>
          <Input
            value={form.last_name}
            onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Date of Birth</Label>
          <Input
            type="date"
            value={form.date_of_birth}
            onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Gender</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.gender}
            onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
          >
            <option value="">Select...</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
            <option>Not specified</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>MRN (optional)</Label>
          <Input
            value={form.mrn}
            onChange={e => setForm(f => ({ ...f, mrn: e.target.value }))}
            placeholder="Medical Record Number"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Blood Type</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.blood_type}
            onChange={e => setForm(f => ({ ...f, blood_type: e.target.value }))}
          >
            <option value="">Unknown</option>
            {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bt => (
              <option key={bt}>{bt}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error.message}</p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
        <Button type="submit" className="flex-1" loading={isPending}>Create Patient</Button>
      </div>
    </form>
  )
}

function PatientCard({ patient }: { patient: Patient }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-navy-100 flex items-center justify-center">
              <User className="w-5 h-5 text-navy-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-navy-900">
                  {patient.first_name} {patient.last_name}
                </span>
                {patient.is_demo && (
                  <Badge variant="info" className="text-xs">DEMO</Badge>
                )}
              </div>
              {patient.mrn && (
                <span className="text-xs text-gray-400">MRN: {patient.mrn}</span>
              )}
            </div>
          </div>
          <Link to={`/patients/${patient.id}`}>
            <Button variant="ghost" size="icon">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-1.5 text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            {patient.date_of_birth ? formatDate(patient.date_of_birth) : 'DOB unknown'}
          </div>
          <div className="flex items-center gap-1.5 text-gray-500">
            <FileText className="w-3.5 h-3.5" />
            {patient.document_count ?? 0} documents
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link to={`/patients/${patient.id}/reconstruction`}>
            <Button variant="outline" size="sm">
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Records
            </Button>
          </Link>
          <Link to={`/upload?patient=${patient.id}`}>
            <Button variant="outline" size="sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Upload
            </Button>
          </Link>
          <Link to={`/patients/${patient.id}/agents`}>
            <Button variant="outline" size="sm">
              <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
              Analyze
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export default function PatientsPage() {
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const { data, isLoading, error } = usePatients(1, 20, search)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Patients</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {data?.total ?? 0} patients in your workspace
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Patient
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          className="pl-9"
          placeholder="Search by name or MRN..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-navy-800 border-t-transparent rounded-full" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="w-6 h-6 text-red-600 mx-auto mb-2" />
          <p className="text-red-700">Failed to load patients</p>
        </div>
      )}

      {!isLoading && !error && data?.data?.length === 0 && (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No patients yet</h3>
          <p className="text-gray-400 text-sm mb-6">Create your first patient to start analyzing medical records.</p>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create First Patient
          </Button>
        </div>
      )}

      {!isLoading && data?.data && data.data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {data.data.map(patient => (
            <PatientCard key={patient.id} patient={patient} />
          ))}
        </div>
      )}

      {/* New Patient Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Patient</DialogTitle>
          </DialogHeader>
          <NewPatientForm onClose={() => setShowNew(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
