/**
 * Event competition tracks API.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getAuthedAdminClient,
  requireEventCapabilityResponse,
} from '@/lib/auth/request'
import {
  createTrack,
  listTracksForEvent,
  recordAdvancementDecision,
} from '@/lib/competition/tracks'
interface RouteParams {
  params: Promise<{ id: string }>
}

const trackSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  sort_order: z.number().int().optional(),
})

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      eventId,
      'manage_divisions'
    )
    if (denied) {
      const viewDenied = await requireEventCapabilityResponse(
        auth.supabaseAdmin,
        auth.user.id,
        eventId,
        'view_ops'
      )
      if (viewDenied) return denied
    }

    const admin = auth.supabaseAdmin
    const tracks = await listTracksForEvent(admin, eventId)
    const { data: divisions } = await admin
      .from('divisions')
      .select('id, name, track_id, stage_order, allow_direct_entry, sort_order, round_type')
      .eq('event_id', eventId)
      .order('stage_order', { ascending: true })

    return NextResponse.json({ tracks, divisions: divisions ?? [] })
  } catch (error) {
    console.error('Tracks list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      eventId,
      'manage_divisions'
    )
    if (denied) return denied

    const body = await request.json()
    const parsed = trackSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const track = await createTrack(auth.supabaseAdmin, {
      event_id: eventId,
      ...parsed.data,
    })
    return NextResponse.json({ track }, { status: 201 })
  } catch (error) {
    console.error('Track create error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      eventId,
      'manage_divisions'
    )
    if (denied) return denied

    const body = await request.json()

    // Attach division to track / set stage
    if (body.action === 'attach_division') {
      const { data, error } = await auth.supabaseAdmin
        .from('divisions')
        .update({
          track_id: body.track_id,
          stage_order: body.stage_order ?? 0,
          allow_direct_entry: Boolean(body.allow_direct_entry),
        })
        .eq('id', body.division_id)
        .eq('event_id', eventId)
        .select('*')
        .single()
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ division: data })
    }

    // Record advancement decision (does not auto-apply seats unless apply=true)
    if (body.action === 'advancement_decision') {
      const decision = await recordAdvancementDecision(auth.supabaseAdmin, {
        trackId: body.track_id,
        ruleId: body.rule_id,
        competitorId: body.competitor_id,
        fromDivisionId: body.from_division_id,
        toDivisionId: body.to_division_id,
        decision: body.decision,
        reason: body.reason,
        actorAccountId: auth.user.id,
        apply: Boolean(body.apply),
      })
      return NextResponse.json({ decision })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Tracks patch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
