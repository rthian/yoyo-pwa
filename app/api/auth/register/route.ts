/**
 * POST /api/auth/register — public competitor signup (role forced to member).
 */
import { createAdminClient } from '@/lib/supabase/admin'
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

    const { error: memberError } = await admin.from('members').insert({
      id: authData.user.id,
      email,
      full_name,
      role: 'member',
      is_active: true,
    })

    if (memberError) {
      await admin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
