/**
 * GET /api/member/boards — divisions the signed-in member is registered in.
 * Caller: app/leaderboards/page.tsx
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ boards: [] })
    }

    const { data, error } = await admin
      .from('division_members')
      .select(
        'division:divisions(id, name, scoring_locked, event:events(id, name, event_date))'
      )
      .eq('member_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const boards = (data ?? [])
      .map((row) => {
        const div = Array.isArray(row.division) ? row.division[0] : row.division
        if (!div) return null
        const event = Array.isArray(div.event) ? div.event[0] : div.event
        return {
          divisionId: div.id as string,
          divisionName: div.name as string,
          scoringLocked: Boolean(div.scoring_locked),
          eventId: (event?.id as string) || null,
          eventName: (event?.name as string) || 'Event',
          eventDate: (event?.event_date as string) || null,
        }
      })
      .filter(Boolean)

    return NextResponse.json({ boards })
  } catch (error) {
    console.error('Member boards error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
