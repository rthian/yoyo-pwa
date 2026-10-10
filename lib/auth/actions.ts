/**
 * Auth Server Actions
 * Server-side authentication operations
 */
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

// GateGuard: callers server pages; Glob existing actions.ts;
// Sample: { id, email, full_name, public_id }. User: "next"
export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { getComposedMember } = await import('@/lib/identity/account-profile')
  return getComposedMember(createAdminClient(), user.id)
}

export async function getCurrentUserWithAuth() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { user: null, member: null }

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { getComposedMember } = await import('@/lib/identity/account-profile')
  const member = await getComposedMember(createAdminClient(), user.id)

  return { user, member }
}

export async function updatePassword(newPassword: string) {
  const supabase = await createClient()
  
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
