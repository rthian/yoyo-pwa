/**
 * Event timing helpers — registration/music windows use server time.
 * Callers: event APIs, EventForm, public hub, future registration aggregate.
 */
import type { Event, EventStatus } from '@/lib/types/database'

export const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Seoul',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Manila',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const

export type RegistrationAvailabilityReason =
  | 'open'
  | 'not_open_status'
  | 'not_yet'
  | 'closed'
  | 'no_window'

export type TimingEventFields = Pick<
  Event,
  | 'status'
  | 'starts_at'
  | 'ends_at'
  | 'timezone'
  | 'registration_opens_at'
  | 'registration_closes_at'
  | 'music_deadline_at'
  | 'check_in_opens_at'
  | 'check_in_closes_at'
  | 'event_date'
>

export function isValidIanaTimeZone(tz: string | null | undefined): boolean {
  if (!tz) return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Compare optional ISO timestamps; returns error message or null. */
export function validateEventTimingOrder(input: {
  starts_at?: string | null
  ends_at?: string | null
  registration_opens_at?: string | null
  registration_closes_at?: string | null
  check_in_opens_at?: string | null
  check_in_closes_at?: string | null
  timezone?: string | null
  status?: EventStatus
}): string | null {
  const tz = input.timezone || 'UTC'
  if (input.timezone && !isValidIanaTimeZone(tz)) {
    return `Invalid timezone: ${input.timezone}`
  }

  const start = input.starts_at ? Date.parse(input.starts_at) : NaN
  const end = input.ends_at ? Date.parse(input.ends_at) : NaN
  if (input.starts_at && Number.isNaN(start)) return 'Invalid starts_at'
  if (input.ends_at && Number.isNaN(end)) return 'Invalid ends_at'
  if (!Number.isNaN(start) && !Number.isNaN(end) && !(start < end)) {
    return 'starts_at must be before ends_at'
  }

  const regOpen = input.registration_opens_at
    ? Date.parse(input.registration_opens_at)
    : NaN
  const regClose = input.registration_closes_at
    ? Date.parse(input.registration_closes_at)
    : NaN
  if (input.registration_opens_at && Number.isNaN(regOpen)) {
    return 'Invalid registration_opens_at'
  }
  if (input.registration_closes_at && Number.isNaN(regClose)) {
    return 'Invalid registration_closes_at'
  }
  if (!Number.isNaN(regOpen) && !Number.isNaN(regClose) && !(regOpen < regClose)) {
    return 'registration_opens_at must be before registration_closes_at'
  }

  const cinOpen = input.check_in_opens_at ? Date.parse(input.check_in_opens_at) : NaN
  const cinClose = input.check_in_closes_at
    ? Date.parse(input.check_in_closes_at)
    : NaN
  if (input.check_in_opens_at && Number.isNaN(cinOpen)) {
    return 'Invalid check_in_opens_at'
  }
  if (input.check_in_closes_at && Number.isNaN(cinClose)) {
    return 'Invalid check_in_closes_at'
  }
  if (!Number.isNaN(cinOpen) && !Number.isNaN(cinClose) && !(cinOpen < cinClose)) {
    return 'check_in_opens_at must be before check_in_closes_at'
  }

  const publishing =
    input.status === 'published' ||
    input.status === 'active' ||
    input.status === 'completed'
  if (publishing) {
    if (input.starts_at && input.ends_at && !(start < end)) {
      return 'Cannot publish with invalid start/end times'
    }
    if (
      input.registration_opens_at &&
      input.registration_closes_at &&
      !(regOpen < regClose)
    ) {
      return 'Cannot publish with invalid registration window'
    }
  }

  return null
}

export function getRegistrationAvailability(
  event: TimingEventFields,
  now: Date = new Date()
): { open: boolean; reason: RegistrationAvailabilityReason } {
  if (event.status !== 'published' && event.status !== 'active') {
    return { open: false, reason: 'not_open_status' }
  }

  const opens = event.registration_opens_at
    ? Date.parse(event.registration_opens_at)
    : null
  const closes = event.registration_closes_at
    ? Date.parse(event.registration_closes_at)
    : null

  if (opens === null && closes === null) {
    return { open: true, reason: 'no_window' }
  }

  const t = now.getTime()
  if (opens !== null && !Number.isNaN(opens) && t < opens) {
    return { open: false, reason: 'not_yet' }
  }
  if (closes !== null && !Number.isNaN(closes) && t > closes) {
    return { open: false, reason: 'closed' }
  }
  return { open: true, reason: 'open' }
}

export function isMusicSubmissionOpen(
  event: Pick<TimingEventFields, 'music_deadline_at' | 'status'>,
  now: Date = new Date()
): boolean {
  if (event.status === 'cancelled' || event.status === 'completed') return false
  if (!event.music_deadline_at) return true
  const deadline = Date.parse(event.music_deadline_at)
  if (Number.isNaN(deadline)) return false
  return now.getTime() <= deadline
}

export function formatInTimeZone(
  iso: string | null | undefined,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const tz = isValidIanaTimeZone(timeZone) ? timeZone : 'UTC'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: tz,
    ...options,
  }).format(date)
}

/** Value for <input type="datetime-local"> in the event timezone. */
export function toDatetimeLocalValue(
  iso: string | null | undefined,
  timeZone: string
): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const tz = isValidIanaTimeZone(timeZone) ? timeZone : 'UTC'
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

/**
 * Interpret a datetime-local wall clock in an IANA zone as UTC ISO.
 * Falls back to treating the string as local browser time if zone invalid.
 */
export function fromDatetimeLocalValue(
  localValue: string | null | undefined,
  timeZone: string
): string | null {
  if (!localValue) return null
  const m = localValue.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  )
  if (!m) {
    const parsed = Date.parse(localValue)
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString()
  }

  const [, y, mo, d, h, mi, s] = m
  const tz = isValidIanaTimeZone(timeZone) ? timeZone : 'UTC'

  // Binary search UTC instant whose wall time in tz matches.
  const target = {
    y: Number(y),
    mo: Number(mo),
    d: Number(d),
    h: Number(h),
    mi: Number(mi),
    s: Number(s || '0'),
  }

  let lo = Date.UTC(target.y, target.mo - 1, target.d, target.h, target.mi, target.s) - 36e5 * 14
  let hi = lo + 36e5 * 28

  const wallParts = (ms: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(ms))
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
    return {
      y: get('year'),
      mo: get('month'),
      d: get('day'),
      h: get('hour'),
      mi: get('minute'),
      s: get('second'),
    }
  }

  const cmp = (a: typeof target, b: typeof target) => {
    return (
      a.y - b.y ||
      a.mo - b.mo ||
      a.d - b.d ||
      a.h - b.h ||
      a.mi - b.mi ||
      a.s - b.s
    )
  }

  for (let i = 0; i < 40; i++) {
    const mid = Math.floor((lo + hi) / 2)
    const w = wallParts(mid)
    const c = cmp(w, target)
    if (c === 0) return new Date(mid).toISOString()
    if (c < 0) lo = mid + 1
    else hi = mid - 1
  }

  // Fallback: treat as UTC wall clock
  return new Date(
    Date.UTC(target.y, target.mo - 1, target.d, target.h, target.mi, target.s)
  ).toISOString()
}

/** Prefer starts_at date; fall back to legacy event_date. */
export function eventDisplayInstant(event: TimingEventFields): string | null {
  return event.starts_at || (event.event_date ? `${event.event_date}T12:00:00.000Z` : null)
}

export function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value === '') return null
  return value
}
