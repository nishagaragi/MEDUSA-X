import { useQuery } from '@tanstack/react-query'
import { getDashboardStats } from '@/lib/store'
import { DashboardStats } from '@/types'

export function useDashboard() {
  return useQuery<{ data: DashboardStats }>({
    queryKey: ['dashboard'],
    queryFn: () => ({ data: getDashboardStats() }),
    staleTime: 5000,
  })
}
