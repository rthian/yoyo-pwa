/**
 * Member registration — Prompt 5 aggregate + Prompt 17 competitor_id.
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  cancelRegistration,
  registerCompetitorForDivision,
} from '@/lib/registration/service'
import {
  assertManagesCompetitor,
  getCompetitorIdForMember,
} from '@/lib/identity/competitors'

const bodySchema = z.object({
  division_id: z.string().uuid(),
  action: z.enum(['register', 'unregister']),
  competitor_id: z.string().uuid().optional().nullable(),
})

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

    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            'Invalid request. Provide division_id (uuid) and action (register/unregister).',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const { division_id, action, competitor_id } = parsed.data

    if (action === 'register') {
      try {
        const result = await registerCompetitorForDivision(supabaseAdmin, {
          accountId: user.id,
          divisionId: division_id,
          competitorId: competitor_id || null,
        })
        return NextResponse.json({
          message:
            result.entry.status === 'waitlisted'
              ? 'Waitlisted for this division'
              : 'Successfully registered',
          registered:
            result.entry.status === 'confirmed' ||
            result.entry.status === 'checked_in',
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

    // unregister — scoped to one competitor only
    try {
      const { data: division } = await supabaseAdmin
        .from('divisions')
        .select('id, event_id')
        .eq('id', division_id)
        .single()

      if (!division) {
        return NextResponse.json({ error: 'Division not found' }, { status: 404 })
      }

      let competitorId: string | null = competitor_id || null
      if (competitorId) {
        await assertManagesCompetitor(
          supabaseAdmin,
          user.id,
          competitorId,
          'register'
        )
      } else {
        competitorId = await getCompetitorIdForMember(supabaseAdmin, user.id)
      }

      if (!competitorId) {
        return NextResponse.json({
          message: 'Successfully unregistered',
          registered: false,
        })
      }

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

        // Also clear any legacy seat for this competitor+division
        await supabaseAdmin
          .from('division_members')
          .delete()
          .eq('division_id', division_id)
          .eq('competitor_id', competitorId)

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
          .in('status', [
            'confirmed',
            'pending',
            'waitlisted',
            'draft',
            'checked_in',
          ])

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

      // Legacy: division_members only for this competitor
      const { error: deleteError } = await supabaseAdmin
        .from('division_members')
        .delete()
        .eq('division_id', division_id)
        .eq('competitor_id', competitorId)

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
      }

      return NextResponse.json({
        message: 'Successfully unregistered',
        registered: false,
      })
    } catch (err) {
      const status = (err as Error & { status?: number }).status ?? 500
      console.error('Unregister error:', err)
      return NextResponse.json(
        {
          error: err instanceof Error ? err.message : 'Unregister failed',
        },
        { status: status === 403 ? 403 : status === 400 ? 400 : 500 }
      )
    }
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
