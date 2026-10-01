/**
 * Music upload MVP helpers — signed URLs, deadlines, versioning.
 * Inspector interface is async-ready; MVP marks validation_pending.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { isMusicSubmissionOpen } from '@/lib/events/timing'
import { assertManagesCompetitor } from '@/lib/identity/competitors'

export interface MusicInspector {
  inspect(versionId: string): Promise<{ ok: boolean; durationSeconds?: number; error?: string }>
}

/** MVP inspector — does not claim audio analysis is complete. */
export const pendingMusicInspector: MusicInspector = {
  async inspect() {
    return { ok: true }
  },
}

export async function ensureMusicSubmission(
  supabase: SupabaseClient,
  divisionId: string,
  competitorId: string
) {
  const { data: existing } = await supabase
    .from('music_submissions')
    .select('*')
    .eq('division_id', divisionId)
    .eq('competitor_id', competitorId)
    .maybeSingle()
  if (existing) return existing

  const { data, error } = await supabase
    .from('music_submissions')
    .insert({
      division_id: divisionId,
      competitor_id: competitorId,
      status: 'missing',
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function assertMusicUploadAllowed(
  supabase: SupabaseClient,
  params: {
    accountId: string
    divisionId: string
    competitorId: string
    isAdmin?: boolean
  }
) {
  await assertManagesCompetitor(
    supabase,
    params.accountId,
    params.competitorId,
    'music',
    { isAdmin: params.isAdmin }
  )

  const { data: division } = await supabase
    .from('divisions')
    .select('id, event_id, event:events(status, music_deadline_at)')
    .eq('id', params.divisionId)
    .single()
  if (!division) throw Object.assign(new Error('Division not found'), { status: 404 })

  const event = division.event as unknown as {
    status: string
    music_deadline_at: string | null
  }

  const { data: requirement } = await supabase
    .from('music_requirements')
    .select('*')
    .eq('division_id', params.divisionId)
    .maybeSingle()

  const { data: submission } = await supabase
    .from('music_submissions')
    .select('*')
    .eq('division_id', params.divisionId)
    .eq('competitor_id', params.competitorId)
    .maybeSingle()

  const now = new Date()
  const exceptionUntil = submission?.deadline_exception_until
    ? new Date(submission.deadline_exception_until)
    : null
  if (exceptionUntil && exceptionUntil > now) return { requirement, division, event }

  const deadline =
    requirement?.deadline_at ||
    (event?.music_deadline_at as string | null) ||
    null

  if (
    !isMusicSubmissionOpen(
      {
        status: event.status as 'draft' | 'published' | 'active' | 'completed' | 'cancelled',
        music_deadline_at: deadline,
      },
      now
    )
  ) {
    throw Object.assign(new Error('Music deadline has passed'), { status: 403 })
  }

  return { requirement, division, event }
}

export function buildMusicStoragePath(args: {
  eventId: string
  divisionId: string
  competitorId: string
  versionId: string
  ext: string
}) {
  const safeExt = args.ext.replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'bin'
  return `events/${args.eventId}/divisions/${args.divisionId}/competitors/${args.competitorId}/${args.versionId}.${safeExt}`
}

export async function writeMusicAudit(
  supabase: SupabaseClient,
  args: {
    submissionId: string
    versionId?: string | null
    actorId?: string | null
    action: string
    detail?: Record<string, unknown>
  }
) {
  await supabase.from('music_audit_events').insert({
    submission_id: args.submissionId,
    version_id: args.versionId ?? null,
    actor_account_id: args.actorId ?? null,
    action: args.action,
    detail: args.detail ?? {},
  })
}
