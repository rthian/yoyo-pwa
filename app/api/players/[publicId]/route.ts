/**
 * GET /api/players/[publicId]
 * Callers: app/players/[publicId]/page.tsx
 * Glob: no app/api/players yet
 * Reads profile via getPlayerProfile; response { profile }
 * User: "There should also have a member profile page (reference WCA persons)..."
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlayerProfile } from '@/lib/rankings/profile'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ publicId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { publicId } = await params
    const supabase = createAdminClient()
    const profile = await getPlayerProfile(supabase, publicId)
    if (!profile) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }
    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Player profile error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load profile. Apply migration 005.',
      },
      { status: 500 }
    )
  }
}
