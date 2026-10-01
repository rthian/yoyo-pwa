/**
 * Signup API Route
 * Creates new users (admin-only operation).
 * Slice A: also creates competitors + self link for the new account.
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureSelfCompetitorForMember } from '@/lib/identity/competitors'
import { generateLeagueId } from '@/lib/rankings/league-id'
import { NextResponse } from 'next/server'
import { memberSchema } from '@/lib/validations'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: currentMember } = await supabaseAdmin
      .from('members')
      .select('role')
      .eq('id', user.id)
      .single()

    if (currentMember?.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can create users' }, { status: 403 })
    }

    const body = await request.json()
    const { password, ...memberData } = body

    const validationResult = memberSchema.safeParse(memberData)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const email = memberData.email
    const publicId = generateLeagueId()

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: memberData.full_name,
        role: memberData.role,
      },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }

    const { data: member, error: memberError } = await supabaseAdmin
      .from('members')
      .insert({
        id: authData.user.id,
        ...validationResult.data,
        public_id: publicId,
      })
      .select()
      .single()

    if (memberError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    try {
      await ensureSelfCompetitorForMember(supabaseAdmin, member, {
        publicId,
        grantedBy: user.id,
      })
    } catch (identityError) {
      console.error('Signup identity error:', identityError)
      await supabaseAdmin.from('members').delete().eq('id', authData.user.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        {
          error:
            identityError instanceof Error
              ? identityError.message
              : 'Failed to create competitor identity',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ member }, { status: 201 })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
