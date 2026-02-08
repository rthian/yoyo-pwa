/**
 * Member Me API Route
 * Returns the authenticated user's member record
 * Uses admin client to bypass RLS policies (avoids infinite recursion)
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    // Get the authenticated user from the session cookie
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Use admin client to bypass RLS and fetch member record
    const adminClient = createAdminClient()
    const { data: member, error: memberError } = await adminClient
      .from('members')
      .select('*')
      .eq('id', user.id)
      .single()

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'Member not found', details: memberError?.message },
        { status: 404 }
      )
    }

    return NextResponse.json({ member })
  } catch (error) {
    console.error('[API /member/me] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
