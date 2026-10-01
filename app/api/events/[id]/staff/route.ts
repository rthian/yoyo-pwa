/**
 * Event staff roles API — list / grant / revoke.
 * Auth: manage_staff (owner) or global admin; owner grants require admin.
 */
import { NextResponse } from 'next/server'
import {
  getAuthedAdminClient,
  permissionErrorResponse,
  requireEventCapabilityResponse,
} from '@/lib/auth/request'
import {
  grantEventRole,
  listEventStaff,
  revokeEventRole,
} from '@/lib/auth/event-permissions'
import { eventStaffGrantSchema } from '@/lib/validations'
import type { EventStaffRole } from '@/lib/types/database'

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
      'view_ops'
    )
    if (denied) return denied

    const staff = await listEventStaff(auth.supabaseAdmin, eventId)
    return NextResponse.json({ staff })
  } catch (error) {
    console.error('Event staff list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const body = await request.json()
    const parsed = eventStaffGrantSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const row = await grantEventRole(auth.supabaseAdmin, {
      eventId,
      accountId: parsed.data.account_id,
      role: parsed.data.role,
      actorId: auth.user.id,
      note: parsed.data.note,
    })

    return NextResponse.json({ staff: row }, { status: 201 })
  } catch (error) {
    const perm = permissionErrorResponse(error)
    if (perm) return perm
    console.error('Event staff grant error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const body = await request.json()
    const accountId = body.account_id as string | undefined
    const role = body.role as EventStaffRole | undefined
    if (!accountId || !role) {
      return NextResponse.json(
        { error: 'account_id and role are required' },
        { status: 400 }
      )
    }

    const row = await revokeEventRole(auth.supabaseAdmin, {
      eventId,
      accountId,
      role,
      actorId: auth.user.id,
      note: typeof body.note === 'string' ? body.note : null,
    })

    return NextResponse.json({ staff: row, revoked: Boolean(row) })
  } catch (error) {
    const perm = permissionErrorResponse(error)
    if (perm) return perm
    console.error('Event staff revoke error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
