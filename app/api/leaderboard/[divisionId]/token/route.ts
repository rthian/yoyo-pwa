/**
 * Leaderboard Token API
 * Creates shareable links for public leaderboards
 * Uses admin client to bypass RLS for all DB queries
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

interface RouteParams {
  params: Promise<{ divisionId: string }>
}

// Create a new public token
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { divisionId } = await params
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()
    
    // Check authentication and admin role
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: member } = await supabaseAdmin
      .from('members')
      .select('role')
      .eq('id', user.id)
      .single()

    if (member?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can create share links' },
        { status: 403 }
      )
    }

    // Generate unique token
    const token = randomBytes(32).toString('hex')

    // Parse expiry from request
    const body = await request.json().catch(() => ({}))
    const expiresIn = body.expiresIn // hours
    const expiresAt = expiresIn 
      ? new Date(Date.now() + expiresIn * 60 * 60 * 1000).toISOString()
      : null

    // Create token record
    const { data: tokenData, error } = await supabaseAdmin
      .from('leaderboard_tokens')
      .insert({
        division_id: divisionId,
        token,
        is_active: true,
        expires_at: expiresAt,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    // Build the share URL
    const origin = request.headers.get('origin') || ''
    const shareUrl = `${origin}/leaderboard/${divisionId}?token=${token}`

    return NextResponse.json({
      token: tokenData,
      shareUrl,
    }, { status: 201 })
  } catch (error) {
    console.error('Token API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get existing tokens for a division
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { divisionId } = await params
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: tokens, error } = await supabaseAdmin
      .from('leaderboard_tokens')
      .select('*')
      .eq('division_id', divisionId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    const origin = request.headers.get('origin') || ''
    const tokensWithUrls = tokens.map(t => ({
      ...t,
      shareUrl: `${origin}/leaderboard/${divisionId}?token=${t.token}`,
    }))

    return NextResponse.json({ tokens: tokensWithUrls })
  } catch (error) {
    console.error('Token API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
