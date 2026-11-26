import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { patientStore } from '@/lib/store'
import { Patient, PaginatedResponse } from '@/types'

export function usePatients(page = 1, limit = 20, search?: string) {
  return useQuery<PaginatedResponse<Patient>>({
    queryKey: ['patients', page, limit, search],
    queryFn: () => {
      const all = search
        ? patientStore.search(search)
        : patientStore.getAll()
      const start = (page - 1) * limit
      return {
        data: all.slice(start, start + limit),
        total: all.length,
        page,
        limit,
        has_more: start + limit < all.length,
      }
    },
  })
}

export function usePatient(id: string | undefined) {
  return useQuery<{ data: Patient }>({
    queryKey: ['patient', id],
    queryFn: () => {
      const p = patientStore.getById(id!)
      if (!p) throw new Error('Patient not found')
      return { data: p }
    },
    enabled: !!id,
  })
}

export function useCreatePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Patient>) => {
      const p = patientStore.create(data)
      return Promise.resolve({ data: p })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patients'] }) },
  })
}

export function useUpdatePatient(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Patient>) => {
      const p = patientStore.update(id, data)
      if (!p) throw new Error('Patient not found')
      return Promise.resolve({ data: p })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] })
      qc.invalidateQueries({ queryKey: ['patient', id] })
    },
  })
}

export function useDeletePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      patientStore.delete(id)
      return Promise.resolve({ success: true })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patients'] }) },
  })
}
