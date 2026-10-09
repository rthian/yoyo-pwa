/**
 * Prompt 12: public official results (frozen division_results).
 * GET — public when results_published_at set; staff preview with ?preview=1
 * Callers: EventHubClient Results tab; PublishResultsPanel link
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getAuthedAdminClient,
  requireEventCapabilityResponse,
} from '@/lib/auth/request'
import { getPublishedEventResults } from '@/lib/results/publish'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const { searchParams } = new URL(request.url)
    const preview = searchParams.get('preview') === '1'
    const admin = createAdminClient()

    if (preview) {
      const auth = await getAuthedAdminClient()
      if (!auth.ok) return auth.error
      const denied = await requireEventCapabilityResponse(
        auth.supabaseAdmin,
        auth.user.id,
        eventId,
        'view_ops'
      )
      if (denied) return denied

      const data = await getPublishedEventResults(auth.supabaseAdmin, eventId, {
        requirePublished: false,
      })
      if (!data) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
      return NextResponse.json({ ...data, preview: true })
    }

    const data = await getPublishedEventResults(admin, eventId, {
      requirePublished: true,
    })
    if (!data) {
      return NextResponse.json(
        { error: 'Results not published', published: false },
        { status: 404 }
      )
    }
    return NextResponse.json({ ...data, published: true })
  } catch (error) {
    console.error('Results GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
