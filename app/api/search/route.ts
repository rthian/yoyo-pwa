/**
 * GET /api/search?q=
 * Callers: components/shared/SearchDialog.tsx fetch('/api/search')
 * Glob: no app/api/search yet
 * Reads members + events via searchPublic; response { hits:[{type,title,href}] }
 * User: "Lastly it should have a search for ease of discovery."
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { searchPublic } from '@/lib/search/query'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get('q') || ''
    const supabase = createAdminClient()
    const hits = await searchPublic(supabase, q)
    return NextResponse.json({ hits, q })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
