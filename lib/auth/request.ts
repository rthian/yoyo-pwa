/**
 * Shared request auth for API routes (service-role after session check).
 */
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import {
  EventPermissionError,
  hasEventCapability,
} from '@/lib/auth/event-permissions'
import type { EventCapability } from '@/lib/types/database'

type AdminClient = ReturnType<typeof createAdminClient>

export type AuthedAdmin =
  | { ok: true; user: User; supabaseAdmin: AdminClient }
  | { ok: false; error: NextResponse }

export async function getAuthedAdminClient(): Promise<AuthedAdmin> {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { ok: true, user, supabaseAdmin }
}

export async function requireEventCapabilityResponse(
  supabaseAdmin: AdminClient,
  accountId: string,
  eventId: string,
  capability: EventCapability
) {
  const ok = await hasEventCapability(supabaseAdmin, accountId, eventId, capability)
  if (!ok) {
    return NextResponse.json(
      { error: `Missing event capability: ${capability}` },
      { status: 403 }
    )
  }
  return null
}

export function permissionErrorResponse(error: unknown) {
  if (error instanceof EventPermissionError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return null
}
