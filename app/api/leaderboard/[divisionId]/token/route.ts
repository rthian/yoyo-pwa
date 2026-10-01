/**
 * Leaderboard Token API — shareable public leaderboard links.
 * Create: manage_leaderboard_tokens. List: view_ops.
 */
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import {
  getAuthedAdminClient,
  requireEventCapabilityResponse,
} from '@/lib/auth/request'
import { resolveEventIdForDivision } from '@/lib/auth/event-permissions'

interface RouteParams {
  params: Promise<{ divisionId: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { divisionId } = await params
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
      'manage_leaderboard_tokens'
    )
    if (denied) return denied

    const token = randomBytes(32).toString('hex')
    const body = await request.json().catch(() => ({}))
    const expiresIn = body.expiresIn
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 60 * 60 * 1000).toISOString()
      : null

    const { data: tokenData, error } = await auth.supabaseAdmin
      .from('leaderboard_tokens')
      .insert({
        division_id: divisionId,
        token,
        is_active: true,
        expires_at: expiresAt,
        created_by: auth.user.id,
      })
      .select()
      .single()

    if (error) throw error

    const origin = request.headers.get('origin') || ''
    const shareUrl = `${origin}/leaderboard/${divisionId}?token=${token}`

    return NextResponse.json({ token: tokenData, shareUrl }, { status: 201 })
  } catch (error) {
    console.error('Token API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { divisionId } = await params
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
      'view_ops'
    )
    if (denied) return denied

    const { data: tokens, error } = await auth.supabaseAdmin
      .from('leaderboard_tokens')
      .select('*')
      .eq('division_id', divisionId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    const origin = request.headers.get('origin') || ''
    const tokensWithUrls = (tokens ?? []).map((t) => ({
      ...t,
      shareUrl: `${origin}/leaderboard/${divisionId}?token=${t.token}`,
    }))

    return NextResponse.json({ tokens: tokensWithUrls })
  } catch (error) {
    console.error('Token API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
