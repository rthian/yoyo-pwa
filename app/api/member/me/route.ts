/**
 * Member Me API Route
 * Slice E: account + self-competitor profile (composed).
 * Callers: lib/auth/context.tsx. Glob: existing route.
 * Sample: { member: { id, email, full_name, public_id } }. User: "next"
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getComposedMember } from '@/lib/identity/account-profile'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const member = await getComposedMember(createAdminClient(), user.id)

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    return NextResponse.json({ member })
  } catch (error) {
    console.error('[API /member/me] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
