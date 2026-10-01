/**
 * Division Lock API — toggle scoring_locked (event head_judge / division head / admin / owner).
 */
import { NextResponse } from 'next/server'
import { getAuthedAdminClient } from '@/lib/auth/request'
import {
  canLockDivisionScores,
  resolveEventIdForDivision,
} from '@/lib/auth/event-permissions'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id: divisionId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const body = await request.json()
    const scoringLocked = body.scoring_locked

    if (typeof scoringLocked !== 'boolean') {
      return NextResponse.json(
        { error: 'scoring_locked must be a boolean' },
        { status: 400 }
      )
    }

    const eventId = await resolveEventIdForDivision(auth.supabaseAdmin, divisionId)
    if (!eventId) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 })
    }

    const allowed = await canLockDivisionScores(
      auth.supabaseAdmin,
      auth.user.id,
      eventId,
      divisionId
    )
    if (!allowed) {
      return NextResponse.json(
        { error: 'Only head judges, event staff with lock rights, or admins can lock/unlock' },
        { status: 403 }
      )
    }

    if (scoringLocked) {
      const { getPanelLockBlockers } = await import('@/lib/rankings/standings')
      const blockers = await getPanelLockBlockers(auth.supabaseAdmin, divisionId)
      if (blockers.missing > 0) {
        return NextResponse.json(
          { error: blockers.message, missing: blockers.missing },
          { status: 409 }
        )
      }
    }

    const { data: division, error } = await auth.supabaseAdmin
      .from('divisions')
      .update({ scoring_locked: scoringLocked })
      .eq('id', divisionId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    try {
      const { snapshotDivisionResults, clearAutoDivisionResults } = await import(
        '@/lib/rankings/standings'
      )
      if (scoringLocked) {
        await snapshotDivisionResults(auth.supabaseAdmin, divisionId)
      } else {
        await clearAutoDivisionResults(auth.supabaseAdmin, divisionId)
      }
    } catch (snapErr) {
      console.error('Division results snapshot failed:', snapErr)
      return NextResponse.json(
        {
          error:
            snapErr instanceof Error
              ? `Locked, but failed to freeze standings: ${snapErr.message}`
              : 'Locked, but failed to freeze standings for league points',
          division,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ division })
  } catch (error) {
    console.error('Division lock error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
