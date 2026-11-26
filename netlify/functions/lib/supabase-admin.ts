import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL environment variable')
if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')

// Server-side admin client — bypasses RLS
// NEVER expose this in frontend code
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// User client — respects RLS using the user's JWT
export function createUserClient(accessToken: string) {
  return createClient(supabaseUrl!, process.env.VITE_SUPABASE_ANON_KEY ?? '', {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
