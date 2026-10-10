/**
 * Member Profile API Route
 * Slice E: competition profile on competitors; full_name also on members.
 * Callers: member profile page. Glob: existing. Sample patch: { full_name, country }.
 * User: "next"
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getComposedMember,
  updateAccountAndSelfProfile,
} from '@/lib/identity/account-profile'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const profileUpdateSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  nickname: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  gender: z.enum(['female', 'male', 'other', 'undisclosed']).optional().nullable(),
  home_geo_id: z.string().uuid().optional().nullable(),
})

export async function GET() {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const member = await getComposedMember(supabaseAdmin, user.id)
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    return NextResponse.json({ member })
  } catch (error) {
    console.error('Profile fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validationResult = profileUpdateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const member = await updateAccountAndSelfProfile(
      supabaseAdmin,
      user.id,
      validationResult.data
    )

    return NextResponse.json({ member })
  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
