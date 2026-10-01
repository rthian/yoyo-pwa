/**
 * Member registration — uses Prompt 5 aggregate (confirmed → division_members).
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import {
  cancelRegistration,
  registerSelfForDivision,
} from '@/lib/registration/service'
import { getCompetitorIdForMember } from '@/lib/identity/competitors'

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

    const body = await request.json()
    const { division_id, action } = body

    if (!division_id || !['register', 'unregister'].includes(action)) {
      return NextResponse.json(
        {
          error:
            'Invalid request. Provide division_id and action (register/unregister).',
        },
        { status: 400 }
      )
    }

    if (action === 'register') {
      try {
        const result = await registerSelfForDivision(supabaseAdmin, {
          accountId: user.id,
          divisionId: division_id,
        })
        return NextResponse.json({
          message:
            result.entry.status === 'waitlisted'
              ? 'Waitlisted for this division'
              : 'Successfully registered',
          registered: result.entry.status === 'confirmed' || result.entry.status === 'checked_in',
          waitlisted: result.entry.status === 'waitlisted',
          registration: result.registration,
          entry: result.entry,
        })
      } catch (err) {
        const status = (err as Error & { status?: number }).status ?? 500
        return NextResponse.json(
          {
            error: err instanceof Error ? err.message : 'Registration failed',
            reason: (err as Error & { reason?: string }).reason,
          },
          { status: status === 403 ? 403 : status === 400 ? 400 : 500 }
        )
      }
    }

    // unregister: cancel entry for this division if present; else legacy delete
    const { data: division } = await supabaseAdmin
      .from('divisions')
      .select('id, event_id')
      .eq('id', division_id)
      .single()

    if (!division) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 })
    }

    const competitorId = await getCompetitorIdForMember(supabaseAdmin, user.id)
    if (competitorId) {
      const { data: reg } = await supabaseAdmin
        .from('registrations')
        .select('id')
        .eq('event_id', division.event_id)
        .eq('competitor_id', competitorId)
        .maybeSingle()

      if (reg) {
        const { data: entry } = await supabaseAdmin
          .from('registration_entries')
          .select('*')
          .eq('registration_id', reg.id)
          .eq('division_id', division_id)
          .maybeSingle()

        if (entry?.division_member_id) {
          await supabaseAdmin
            .from('division_members')
            .delete()
            .eq('id', entry.division_member_id)
        }

        if (entry) {
          await supabaseAdmin
            .from('registration_entries')
            .update({
              status: 'cancelled',
              waitlist_position: null,
              division_member_id: null,
            })
            .eq('id', entry.id)
        }

        const { count } = await supabaseAdmin
          .from('registration_entries')
          .select('*', { count: 'exact', head: true })
          .eq('registration_id', reg.id)
          .in('status', ['confirmed', 'pending', 'waitlisted', 'draft', 'checked_in'])

        if ((count ?? 0) === 0) {
          await cancelRegistration(supabaseAdmin, {
            registrationId: reg.id,
            accountId: user.id,
            reason: 'Unregistered from all divisions',
          })
        }

        return NextResponse.json({
          message: 'Successfully unregistered',
          registered: false,
        })
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from('division_members')
      .delete()
      .eq('division_id', division_id)
      .eq('member_id', user.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Successfully unregistered', registered: false })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
