/**
 * Prompt 16: list events where the caller is staff (or all events for global admin).
 * Callers: components/dashboard/* Organizer entry, future client refresh
 * Glob: no prior app/api/organize/*
 * Sample response: { events: [{ id: "evt_demo", name: "Demo Open", roles: ["organizer"] }], isAdmin: false }
 * User: "ok continue next"
 */
import { NextResponse } from 'next/server'
import { getAuthedAdminClient } from '@/lib/auth/request'
import {
  isGlobalAdminAccount,
  listStaffEventsForAccount,
} from '@/lib/organize/access'

export async function GET() {
  const auth = await getAuthedAdminClient()
  if (!auth.ok) return auth.error

  const isAdmin = await isGlobalAdminAccount(auth.supabaseAdmin, auth.user.id)
  const events = await listStaffEventsForAccount(
    auth.supabaseAdmin,
    auth.user.id,
    { isAdmin }
  )

  return NextResponse.json({ events, isAdmin })
}
