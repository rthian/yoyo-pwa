/**
 * Prompt 12: publish / unpublish official results.
 * GET readiness · POST publish · DELETE unpublish
 * Capability: publish_results
 * Caller: components/admin/PublishResultsPanel.tsx
 */
import { NextResponse } from 'next/server'
import {
  getAuthedAdminClient,
  requireEventCapabilityResponse,
} from '@/lib/auth/request'
import {
  getPublishReadiness,
  publishEventResults,
  unpublishEventResults,
  type PublishBlocker,
} from '@/lib/results/publish'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      eventId,
      'publish_results'
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

    const readiness = await getPublishReadiness(auth.supabaseAdmin, eventId)
    return NextResponse.json(readiness)
  } catch (error) {
    console.error('Results publish GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      eventId,
      'publish_results'
    )
    if (denied) return denied

    try {
      const result = await publishEventResults(auth.supabaseAdmin, {
        eventId,
        actorId: auth.user.id,
      })
      return NextResponse.json({ ok: true, ...result })
    } catch (e) {
      const blockers = (e as Error & { blockers?: PublishBlocker[] }).blockers
      if (blockers) {
        return NextResponse.json(
          { error: (e as Error).message, blockers },
          { status: 400 }
        )
      }
      throw e
    }
  } catch (error) {
    console.error('Results publish POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      eventId,
      'publish_results'
    )
    if (denied) return denied

    await unpublishEventResults(auth.supabaseAdmin, {
      eventId,
      actorId: auth.user.id,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Results publish DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
