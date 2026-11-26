import { Handler } from '@netlify/functions'
import { z } from 'zod'
import { supabaseAdmin } from '../lib/supabase-admin'
import {
  successResponse, errorResponse, optionsResponse, logAudit,
} from '../lib/middleware'

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1),
  organization_name: z.string().optional(),
})

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse()
  if (event.httpMethod !== 'POST') return errorResponse('Method not allowed', 405)

  let body
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return errorResponse('Invalid request body', 400)
  }

  const parsed = RegisterSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0].message, 400)
  }

  const { email, password, full_name, organization_name } = parsed.data

  try {
    // Create Supabase auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        return errorResponse('An account with this email already exists', 409)
      }
      return errorResponse(authError.message, 400)
    }

    const authUser = authData.user
    if (!authUser) return errorResponse('Failed to create authentication account', 500)

    // Create or find organization
    let organizationId: string
    if (organization_name) {
      const slug = organization_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
      const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .insert({ name: organization_name, slug: `${slug}-${Date.now()}` })
        .select('id')
        .single()

      if (orgError || !org) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.id)
        return errorResponse('Failed to create organization', 500)
      }
      organizationId = org.id
    } else {
      // Create a personal organization
      const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: `${full_name}'s Workspace`,
          slug: `personal-${authUser.id.slice(0, 8)}`,
        })
        .select('id')
        .single()

      if (orgError || !org) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.id)
        return errorResponse('Failed to create workspace', 500)
      }
      organizationId = org.id
    }

    // Create user profile
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        auth_id: authUser.id,
        organization_id: organizationId,
        email,
        full_name,
        role: 'clinician',
      })
      .select('id, email, full_name, role, organization_id, created_at')
      .single()

    if (profileError || !userProfile) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.id)
      return errorResponse('Failed to create user profile', 500)
    }

    await logAudit({
      userId: userProfile.id,
      organizationId,
      action: 'user_registered',
      resourceType: 'user',
      resourceId: userProfile.id,
    })

    return successResponse({ data: userProfile, message: 'Registration successful' }, 201)
  } catch (err) {
    console.error('Registration error:', err)
    return errorResponse('Registration failed', 500)
  }
}
