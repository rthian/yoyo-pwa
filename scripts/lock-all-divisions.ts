/**
 * Lock all active divisions for an event (admin/service role).
 * Snapshots division_results like the lock API.
 *
 * Callers: run manually via CLI (not imported by the app).
 * Usage:
 *   npx tsx --env-file=.env.local scripts/lock-all-divisions.ts --list
 *   npx tsx --env-file=.env.local scripts/lock-all-divisions.ts --event <eventId>
 *   npx tsx --env-file=.env.local scripts/lock-all-divisions.ts --event <eventId> --force
 *
 * User: "can you do it for me"
 */
import { createAdminClient } from '../lib/supabase/admin'
import {
  getPanelLockBlockers,
  snapshotDivisionResults,
} from '../lib/rankings/standings'

async function listEvents() {
  const sb = createAdminClient()
  const { data: events, error } = await sb
    .from('events')
    .select('id, name, status, event_date')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error

  for (const e of events ?? []) {
    const { data: divs } = await sb
      .from('divisions')
      .select('id, name, scoring_locked')
      .eq('event_id', e.id)
      .eq('is_active', true)
    const unlocked = (divs ?? []).filter((d) => !d.scoring_locked)
    console.log(
      `${e.id}  ${e.status.padEnd(10)}  locked ${(divs ?? []).length - unlocked.length}/${(divs ?? []).length}  ${e.name}`
    )
    for (const d of unlocked) {
      console.log(`    unlocked: ${d.name} (${d.id})`)
    }
  }
}

async function lockEvent(eventId: string, force: boolean) {
  const sb = createAdminClient()
  const { data: event, error: eErr } = await sb
    .from('events')
    .select('id, name')
    .eq('id', eventId)
    .single()
  if (eErr || !event) throw new Error(eErr?.message || 'Event not found')

  const { data: divisions, error: dErr } = await sb
    .from('divisions')
    .select('id, name, scoring_locked')
    .eq('event_id', eventId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (dErr) throw dErr

  console.log(`Event: ${event.name} (${event.id})`)
  console.log(`Divisions: ${(divisions ?? []).length}`)

  let locked = 0
  let skipped = 0
  let failed = 0

  for (const d of divisions ?? []) {
    if (d.scoring_locked) {
      console.log(`ok  already locked  ${d.name}`)
      skipped += 1
      continue
    }

    if (!force) {
      const blockers = await getPanelLockBlockers(sb, d.id)
      if (blockers.missing > 0) {
        console.log(`FAIL  ${d.name}: ${blockers.message}`)
        failed += 1
        continue
      }
    }

    const { error: uErr } = await sb
      .from('divisions')
      .update({ scoring_locked: true })
      .eq('id', d.id)
    if (uErr) {
      console.log(`FAIL  ${d.name}: ${uErr.message}`)
      failed += 1
      continue
    }

    try {
      const n = await snapshotDivisionResults(sb, d.id)
      console.log(`ok  locked + snapshot (${n} rows)  ${d.name}`)
      locked += 1
    } catch (snapErr) {
      console.log(
        `FAIL  locked but snapshot failed  ${d.name}: ${
          snapErr instanceof Error ? snapErr.message : snapErr
        }`
      )
      failed += 1
    }
  }

  console.log(`\nDone: locked ${locked}, already ${skipped}, failed ${failed}`)
  if (failed > 0) process.exit(1)
}

async function main() {
  const args = process.argv.slice(2)
  const list = args.includes('--list')
  const force = args.includes('--force')
  const eventIdx = args.indexOf('--event')
  const eventId = eventIdx >= 0 ? args[eventIdx + 1] : undefined

  if (list || !eventId) {
    await listEvents()
    if (!eventId) {
      console.log(
        '\nPass --event <uuid> to lock. Add --force to skip incomplete-panel checks.'
      )
    }
    return
  }

  await lockEvent(eventId, force)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
