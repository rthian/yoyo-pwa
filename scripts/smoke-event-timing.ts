/**
 * Smoke-check Prompt 4 event timing helpers + columns.
 * Requires migration 013 applied.
 * Run: npx tsx --env-file=.env.local scripts/smoke-event-timing.ts
 */
import { createAdminClient } from '../lib/supabase/admin'
import {
  fromDatetimeLocalValue,
  getRegistrationAvailability,
  isMusicSubmissionOpen,
  toDatetimeLocalValue,
  validateEventTimingOrder,
} from '../lib/events/timing'

async function main() {
  const sb = createAdminClient()
  const checks: { name: string; ok: boolean; detail?: unknown }[] = []

  const { data: sample, error } = await sb
    .from('events')
    .select('id, status, event_date, starts_at, ends_at, timezone, registration_opens_at, registration_closes_at, music_deadline_at')
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error(
      'events timing columns missing. Apply supabase/migrations/013_event_timing.sql first.\n',
      error.message
    )
    process.exit(1)
  }

  checks.push({ name: 'timing_columns_readable', ok: true, detail: sample?.id })

  if (sample?.event_date && !sample.starts_at) {
    checks.push({
      name: 'starts_at_backfill',
      ok: false,
      detail: 'event_date set but starts_at null — re-run 013',
    })
  } else {
    checks.push({ name: 'starts_at_backfill', ok: true })
  }

  const bad = validateEventTimingOrder({
    starts_at: '2026-10-02T12:00:00.000Z',
    ends_at: '2026-10-01T12:00:00.000Z',
  })
  checks.push({
    name: 'rejects_inverted_start_end',
    ok: bad !== null,
    detail: bad,
  })

  const good = validateEventTimingOrder({
    starts_at: '2026-10-01T12:00:00.000Z',
    ends_at: '2026-10-02T12:00:00.000Z',
    registration_opens_at: '2026-09-01T00:00:00.000Z',
    registration_closes_at: '2026-09-30T00:00:00.000Z',
    timezone: 'Asia/Singapore',
  })
  checks.push({ name: 'accepts_valid_windows', ok: good === null, detail: good })

  const roundTrip = fromDatetimeLocalValue('2026-06-15T09:30', 'Asia/Singapore')
  const back = toDatetimeLocalValue(roundTrip, 'Asia/Singapore')
  checks.push({
    name: 'singapore_datetime_local_roundtrip',
    ok: back === '2026-06-15T09:30',
    detail: { roundTrip, back },
  })

  const closed = getRegistrationAvailability(
    {
      status: 'published',
      starts_at: null,
      ends_at: null,
      timezone: 'UTC',
      registration_opens_at: '2020-01-01T00:00:00.000Z',
      registration_closes_at: '2020-01-02T00:00:00.000Z',
      music_deadline_at: null,
      check_in_opens_at: null,
      check_in_closes_at: null,
      event_date: null,
    },
    new Date('2026-01-01T00:00:00.000Z')
  )
  checks.push({
    name: 'registration_closed_by_window',
    ok: closed.open === false && closed.reason === 'closed',
    detail: closed,
  })

  const musicOpen = isMusicSubmissionOpen(
    {
      status: 'published',
      music_deadline_at: '2099-01-01T00:00:00.000Z',
    },
    new Date('2026-01-01T00:00:00.000Z')
  )
  const musicClosed = isMusicSubmissionOpen(
    {
      status: 'published',
      music_deadline_at: '2020-01-01T00:00:00.000Z',
    },
    new Date('2026-01-01T00:00:00.000Z')
  )
  checks.push({ name: 'music_deadline_open', ok: musicOpen === true })
  checks.push({ name: 'music_deadline_closed', ok: musicClosed === false })

  const failed = checks.filter((c) => !c.ok)
  for (const c of checks) {
    console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.name}`, c.detail ?? '')
  }
  if (failed.length) {
    console.error(`\n${failed.length} check(s) failed`)
    process.exit(1)
  }
  console.log(`\nAll ${checks.length} checks passed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
