/**
 * Event competition tracks API (Prompt 18 advancement apply).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getAuthedAdminClient,
  requireEventCapabilityResponse,
} from '@/lib/auth/request'
import {
  applyPendingDecision,
  createTrack,
  getDivisionCapacityInfo,
  listAdvancementDecisions,
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

const advancementSchema = z.object({
  action: z.literal('advancement_decision'),
  track_id: z.string().uuid(),
  rule_id: z.string().uuid().optional().nullable(),
  competitor_id: z.string().uuid(),
  from_division_id: z.string().uuid(),
  to_division_id: z.string().uuid(),
  decision: z.enum([
    'advanced',
    'not_advanced',
    'seeded',
    'wildcard',
    'override',
  ]),
  reason: z.string().max(2000).optional().nullable(),
  apply: z.boolean().optional(),
})

const applyDecisionSchema = z.object({
  action: z.literal('apply_decision'),
  decision_id: z.string().uuid(),
})

const previewSchema = z.object({
  action: z.literal('preview_capacity'),
  to_division_id: z.string().uuid(),
  additional_seats: z.number().int().min(0).max(500).optional(),
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
      .select(
        'id, name, track_id, stage_order, allow_direct_entry, sort_order, round_type, capacity'
      )
      .eq('event_id', eventId)
      .order('stage_order', { ascending: true })

    const trackIds = tracks.map((t) => t.id)
    const decisions = await listAdvancementDecisions(admin, trackIds, 40)

    // Enrich decisions with competitor names
    const competitorIds = [...new Set(decisions.map((d) => d.competitor_id))]
    const nameById = new Map<string, string>()
    if (competitorIds.length) {
      const { data: comps } = await admin
        .from('competitors')
        .select('id, full_name')
        .in('id', competitorIds)
      for (const c of comps ?? []) {
        nameById.set(c.id as string, c.full_name as string)
      }
    }

    const capacityByDivision: Record<string, Awaited<ReturnType<typeof getDivisionCapacityInfo>>> = {}
    for (const d of divisions ?? []) {
      capacityByDivision[d.id] = await getDivisionCapacityInfo(admin, d.id, 0)
    }

    return NextResponse.json({
      tracks,
      divisions: divisions ?? [],
      decisions: decisions.map((d) => ({
        ...d,
        competitor_name: nameById.get(d.competitor_id) ?? null,
      })),
      capacityByDivision,
    })
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

    if (body.action === 'preview_capacity') {
      const parsed = previewSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid data', details: parsed.error.flatten() },
          { status: 400 }
        )
      }
      const capacity = await getDivisionCapacityInfo(
        auth.supabaseAdmin,
        parsed.data.to_division_id,
        parsed.data.additional_seats ?? 0
      )
      return NextResponse.json({ capacity })
    }

    if (body.action === 'apply_decision') {
      const parsed = applyDecisionSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid data', details: parsed.error.flatten() },
          { status: 400 }
        )
      }
      const result = await applyPendingDecision(
        auth.supabaseAdmin,
        parsed.data.decision_id
      )
      return NextResponse.json(result)
    }

    if (body.action === 'advancement_decision') {
      const parsed = advancementSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid data', details: parsed.error.flatten() },
          { status: 400 }
        )
      }

      // Ensure track belongs to this event
      const { data: track } = await auth.supabaseAdmin
        .from('competition_tracks')
        .select('id')
        .eq('id', parsed.data.track_id)
        .eq('event_id', eventId)
        .maybeSingle()
      if (!track) {
        return NextResponse.json({ error: 'Track not found' }, { status: 404 })
      }

      try {
        const result = await recordAdvancementDecision(auth.supabaseAdmin, {
          trackId: parsed.data.track_id,
          ruleId: parsed.data.rule_id,
          competitorId: parsed.data.competitor_id,
          fromDivisionId: parsed.data.from_division_id,
          toDivisionId: parsed.data.to_division_id,
          decision: parsed.data.decision,
          reason: parsed.data.reason,
          actorAccountId: auth.user.id,
          apply: Boolean(parsed.data.apply),
        })
        return NextResponse.json(result)
      } catch (err) {
        const status = (err as Error & { status?: number }).status ?? 500
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Failed' },
          { status: status === 400 || status === 404 ? status : 500 }
        )
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Tracks patch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
