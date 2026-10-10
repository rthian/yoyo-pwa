/**
 * Member API Routes
 * Handles update and delete for members (bypasses RLS)
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { memberSchema } from '@/lib/validations'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const supabaseAdmin = createAdminClient()
  const { data: member } = await supabaseAdmin
    .from('members')
    .select('role')
    .eq('id', user.id)
    .single()

  return member?.role === 'admin' ? user : null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const supabaseAdmin = createAdminClient()

    // Validate the data
    const validationResult = memberSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    // GateGuard: callers MemberForm; Glob existing route;
    // Sample update: { email, full_name, role, nickname }. User: "next"
    const {
      email,
      full_name,
      role,
      is_active,
      nickname,
      country,
      home_geo_id,
    } = validationResult.data

    const { data: account, error } = await supabaseAdmin
      .from('members')
      .update({ email, full_name, role, is_active })
      .eq('id', id)
      .select('id, email, full_name, role, is_active, created_at, updated_at')
      .single()

    if (error || !account) {
      return NextResponse.json(
        { error: error?.message || 'Update failed' },
        { status: 500 }
      )
    }

    const { getCompetitorIdForMember, ensureSelfCompetitorForMember } =
      await import('@/lib/identity/competitors')
    let competitorId = await getCompetitorIdForMember(supabaseAdmin, id)
    if (!competitorId) {
      const ensured = await ensureSelfCompetitorForMember(supabaseAdmin, {
        id,
        full_name,
        nickname: nickname ?? null,
        country: country ?? null,
        home_geo_id: home_geo_id ?? null,
        is_active,
      })
      competitorId = ensured.competitor.id
    } else {
      await supabaseAdmin
        .from('competitors')
        .update({
          full_name,
          nickname: nickname ?? null,
          country: country ?? null,
          home_geo_id: home_geo_id ?? null,
          is_active,
        })
        .eq('id', competitorId)
    }

    const { getComposedMember } = await import('@/lib/identity/account-profile')
    const member = await getComposedMember(supabaseAdmin, id)

    return NextResponse.json({ member })
  } catch (error) {
    console.error('Error updating member:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabaseAdmin = createAdminClient()

    const { error } = await supabaseAdmin
      .from('members')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deactivating member:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
