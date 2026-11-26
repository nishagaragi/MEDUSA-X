/**
 * TRUST-MED AI — Auth Hook (No Supabase)
 * Authentication removed — app opens directly without login.
 * User is always "authenticated" as the demo clinician.
 */

import { User } from '@/types'

const DEMO_USER: User = {
  id: 'local-user-001',
  auth_id: 'local-user-001',
  organization_id: 'local',
  email: 'clinician@trustmed.ai',
  full_name: 'Clinical User',
  role: 'clinician',
  is_active: true,
  created_at: new Date().toISOString(),
}

export function useAuth() {
  return {
    user: DEMO_USER,
    session: { user: DEMO_USER } as never,
    supabaseUser: null,
    loading: false,
    error: null,
    isAuthenticated: true,
    isConfigured: true,
    signIn: async () => {},
    signUp: async () => {},
    signOut: async () => {},
  }
}
