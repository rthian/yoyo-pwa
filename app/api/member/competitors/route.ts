/**
 * Prompt 17: list / create managed competitors for the signed-in account.
 */
import { NextResponse } from 'next/server'
import { getAuthedAdminClient } from '@/lib/auth/request'
import {
  createManagedCompetitor,
  getManagedCompetitors,
} from '@/lib/identity/competitors'
import { createManagedCompetitorSchema } from '@/lib/validations'

export async function GET() {
  try {
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const competitors = await getManagedCompetitors(
      auth.supabaseAdmin,
      auth.user.id
    )
    return NextResponse.json({ competitors })
  } catch (error) {
    console.error('[GET /api/member/competitors]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const body = await request.json()
    const parsed = createManagedCompetitorSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const result = await createManagedCompetitor(auth.supabaseAdmin, {
      accountId: auth.user.id,
      ...parsed.data,
    })

    return NextResponse.json(
      {
        competitor: { ...result.competitor, link: result.link },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/member/competitors]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
