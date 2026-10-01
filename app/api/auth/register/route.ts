/**
 * POST /api/auth/register — public competitor signup (role forced to member).
 * Slice A: also creates competitors row + self account_competitor_links.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureSelfCompetitorForMember } from '@/lib/identity/competitors'
import { generateLeagueId } from '@/lib/rankings/league-id'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(2),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { email, password, full_name } = parsed.data
    const admin = createAdminClient()

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role: 'member' },
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Could not create account' },
        { status: 400 }
      )
    }

    const publicId = generateLeagueId()

    const { error: memberError } = await admin.from('members').insert({
      id: authData.user.id,
      email,
      full_name,
      role: 'member',
      is_active: true,
      public_id: publicId,
    })

    if (memberError) {
      await admin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    try {
      await ensureSelfCompetitorForMember(
        admin,
        {
          id: authData.user.id,
          full_name,
          public_id: publicId,
          is_active: true,
        },
        { publicId, grantedBy: authData.user.id }
      )
    } catch (identityError) {
      console.error('Register identity error:', identityError)
      await admin.from('members').delete().eq('id', authData.user.id)
      await admin.auth.admin.deleteUser(authData.user.id)
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

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
