/**
 * Music requirements + readiness for a division.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getAuthedAdminClient,
  requireEventCapabilityResponse,
} from '@/lib/auth/request'
import { resolveEventIdForDivision } from '@/lib/auth/event-permissions'

interface RouteParams {
  params: Promise<{ id: string }>
}

const requirementSchema = z.object({
  deadline_at: z.string().datetime({ offset: true }).nullable().optional(),
  max_duration_seconds: z.number().int().positive().optional(),
  max_bytes: z.number().int().positive().optional(),
  policy_text: z.string().nullable().optional(),
})

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: divisionId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const eventId = await resolveEventIdForDivision(auth.supabaseAdmin, divisionId)
    if (!eventId) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 })
    }

    const { data: requirement } = await auth.supabaseAdmin
      .from('music_requirements')
      .select('*')
      .eq('division_id', divisionId)
      .maybeSingle()

    const { data: submissions } = await auth.supabaseAdmin
      .from('music_submissions')
      .select(
        `
        *,
        competitor:competitors(id, full_name, public_id),
        active_version:music_submission_versions!music_submissions_active_version_fk(*)
      `
      )
      .eq('division_id', divisionId)

    return NextResponse.json({
      requirement,
      submissions: submissions ?? [],
    })
  } catch (error) {
    console.error('Music GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id: divisionId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const eventId = await resolveEventIdForDivision(auth.supabaseAdmin, divisionId)
    if (!eventId) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 })
    }

    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      eventId,
      'manage_music'
    )
    if (denied) return denied

    const body = await request.json()
    const parsed = requirementSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await auth.supabaseAdmin
      .from('music_requirements')
      .upsert(
        {
          division_id: divisionId,
          ...parsed.data,
        },
        { onConflict: 'division_id' }
      )
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ requirement: data })
  } catch (error) {
    console.error('Music PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id: divisionId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const eventId = await resolveEventIdForDivision(auth.supabaseAdmin, divisionId)
    if (!eventId) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 })
    }

    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      eventId,
      'manage_music'
    )
    if (denied) return denied

    const body = await request.json()
    const submissionId = body.submission_id as string
    const status = body.status as string
    if (!submissionId || !['approved', 'rejected', 'flagged', 'locked'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status action' }, { status: 400 })
    }

    const { data, error } = await auth.supabaseAdmin
      .from('music_submissions')
      .update({ status })
      .eq('id', submissionId)
      .eq('division_id', divisionId)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await auth.supabaseAdmin.from('music_audit_events').insert({
      submission_id: submissionId,
      actor_account_id: auth.user.id,
      action: `status_${status}`,
      detail: { reason: body.reason ?? null },
    })

    return NextResponse.json({ submission: data })
  } catch (error) {
    console.error('Music PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
