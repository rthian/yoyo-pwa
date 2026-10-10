/**
 * Prompt 17: update / revoke a management link.
 * Callers: ManagedCompetitorsPanel PATCH/DELETE.
 * Glob: no prior links/[id]/route.ts
 * Sample: { id: "link_demo", can_register: true, can_manage_music: false }
 * User: "Start build"
 */
import { NextResponse } from 'next/server'
import { getAuthedAdminClient } from '@/lib/auth/request'
import {
  revokeManagedLink,
  updateLinkCapabilities,
} from '@/lib/identity/competitors'
import { updateManagedLinkSchema } from '@/lib/validations'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const { id: linkId } = await params
    const body = await request.json()
    const parsed = updateManagedLinkSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const link = await updateLinkCapabilities(
      auth.supabaseAdmin,
      auth.user.id,
      linkId,
      parsed.data
    )
    return NextResponse.json({ link })
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500
    console.error('[PATCH /api/member/competitors/links]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: status === 404 || status === 400 ? status : 500 }
    )
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const { id: linkId } = await params
    await revokeManagedLink(auth.supabaseAdmin, auth.user.id, linkId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500
    console.error('[DELETE /api/member/competitors/links]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: status === 404 || status === 400 ? status : 500 }
    )
  }
}
