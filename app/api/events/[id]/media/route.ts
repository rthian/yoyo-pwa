/**
 * Prompt 13: event external media CRUD (links only).
 * Callers: components/admin/EventMediaPanel.tsx; EventHubClient Media tab.
 * GET public list; ?all=1 for staff; POST/PATCH/DELETE require manage_event.
 * Body: { title, url, kind, is_public } — User: "prompt 13"
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getAuthedAdminClient,
  requireEventCapabilityResponse,
} from '@/lib/auth/request'
import {
  detectMediaProvider,
  EXTERNAL_MEDIA_KINDS,
  normalizeExternalMediaUrl,
  type ExternalMediaKind,
} from '@/lib/media/external'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function assertDivisionOnEvent(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  divisionId: string | null | undefined
) {
  if (!divisionId) return null
  const { data } = await admin
    .from('divisions')
    .select('id')
    .eq('id', divisionId)
    .eq('event_id', eventId)
    .maybeSingle()
  if (!data) {
    return NextResponse.json(
      { error: 'division_id not on this event' },
      { status: 400 }
    )
  }
  return null
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === '1'
    const admin = createAdminClient()

    const { data: event } = await admin
      .from('events')
      .select('id, status')
      .eq('id', eventId)
      .single()
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (all) {
      const auth = await getAuthedAdminClient()
      if (!auth.ok) return auth.error
      const denied = await requireEventCapabilityResponse(
        auth.supabaseAdmin,
        auth.user.id,
        eventId,
        'view_ops'
      )
      if (denied) return denied

      const { data, error } = await auth.supabaseAdmin
        .from('event_external_media')
        .select('*')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ media: data ?? [] })
    }

    if (!['published', 'active', 'completed'].includes(event.status)) {
      return NextResponse.json({ error: 'Event not available' }, { status: 404 })
    }

    const { data, error } = await admin
      .from('event_external_media')
      .select(
        'id, event_id, division_id, kind, provider, url, title, description, thumbnail_url, sort_order'
      )
      .eq('event_id', eventId)
      .eq('is_public', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ media: data ?? [] })
  } catch (error) {
    console.error('Event media GET error:', error)
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
      'manage_event'
    )
    if (denied) return denied

    const body = await request.json()
    const url = normalizeExternalMediaUrl(String(body.url ?? ''))
    const title = String(body.title ?? '').trim()
    const kind = (body.kind ?? 'other') as ExternalMediaKind

    if (!url || !title) {
      return NextResponse.json(
        { error: 'title and valid https url required' },
        { status: 400 }
      )
    }
    if (!EXTERNAL_MEDIA_KINDS.includes(kind)) {
      return NextResponse.json({ error: 'invalid kind' }, { status: 400 })
    }

    const divisionId = (body.division_id as string | null | undefined) ?? null
    const divErr = await assertDivisionOnEvent(auth.supabaseAdmin, eventId, divisionId)
    if (divErr) return divErr

    const { data, error } = await auth.supabaseAdmin
      .from('event_external_media')
      .insert({
        event_id: eventId,
        division_id: divisionId,
        kind,
        provider: detectMediaProvider(url),
        url,
        title,
        description: body.description ? String(body.description).trim() : null,
        thumbnail_url: body.thumbnail_url
          ? normalizeExternalMediaUrl(String(body.thumbnail_url))
          : null,
        sort_order: Number.isFinite(Number(body.sort_order))
          ? Number(body.sort_order)
          : 0,
        is_public: body.is_public !== false,
        created_by: auth.user.id,
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ media: data }, { status: 201 })
  } catch (error) {
    console.error('Event media POST error:', error)
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
      'manage_event'
    )
    if (denied) return denied

    const body = await request.json()
    const mediaId = body.id as string | undefined
    if (!mediaId) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const patch: Record<string, unknown> = {}
    if (body.title != null) {
      const title = String(body.title).trim()
      if (!title) {
        return NextResponse.json({ error: 'title required' }, { status: 400 })
      }
      patch.title = title
    }
    if (body.url != null) {
      const url = normalizeExternalMediaUrl(String(body.url))
      if (!url) {
        return NextResponse.json({ error: 'invalid url' }, { status: 400 })
      }
      patch.url = url
      patch.provider = detectMediaProvider(url)
    }
    if (body.kind != null) {
      if (!EXTERNAL_MEDIA_KINDS.includes(body.kind)) {
        return NextResponse.json({ error: 'invalid kind' }, { status: 400 })
      }
      patch.kind = body.kind
    }
    if (body.description !== undefined) {
      patch.description = body.description
        ? String(body.description).trim()
        : null
    }
    if (body.thumbnail_url !== undefined) {
      patch.thumbnail_url = body.thumbnail_url
        ? normalizeExternalMediaUrl(String(body.thumbnail_url))
        : null
    }
    if (body.sort_order != null) {
      patch.sort_order = Number(body.sort_order) || 0
    }
    if (typeof body.is_public === 'boolean') {
      patch.is_public = body.is_public
    }
    if (body.division_id !== undefined) {
      const divisionId = body.division_id || null
      const divErr = await assertDivisionOnEvent(
        auth.supabaseAdmin,
        eventId,
        divisionId
      )
      if (divErr) return divErr
      patch.division_id = divisionId
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'no changes' }, { status: 400 })
    }

    const { data, error } = await auth.supabaseAdmin
      .from('event_external_media')
      .update(patch)
      .eq('id', mediaId)
      .eq('event_id', eventId)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ media: data })
  } catch (error) {
    console.error('Event media PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      eventId,
      'manage_event'
    )
    if (denied) return denied

    const { searchParams } = new URL(request.url)
    const mediaId = searchParams.get('id')
    if (!mediaId) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const { error } = await auth.supabaseAdmin
      .from('event_external_media')
      .delete()
      .eq('id', mediaId)
      .eq('event_id', eventId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Event media DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
