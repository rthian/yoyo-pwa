/**
 * Stage music ops — filenames, playlist, manifest (no emails / private profile).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type MusicOpsStatusFilter =
  | 'all'
  | 'missing'
  | 'uploaded'
  | 'processing'
  | 'flagged'
  | 'approved'
  | 'rejected'
  | 'locked'

/** Deterministic stage filename — public identity only (league id / name). */
export function buildMusicDisplayFilename(args: {
  playOrder: number | null
  competitorPublicId: string | null
  competitorName: string
  stageName: string
  versionNumber: number
  ext: string
}): string {
  const order = String(args.playOrder ?? 0).padStart(3, '0')
  const idPart = (args.competitorPublicId || 'noid')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 16)
  const namePart = args.competitorName
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)
  const stagePart = args.stageName
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 24)
  const ext = args.ext.replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'mp3'
  return `${order}_${idPart}_${namePart}_${stagePart}_v${args.versionNumber}.${ext}`
}

export type MusicOpsRow = {
  divisionId: string
  divisionName: string
  playOrder: number | null
  divisionMemberId: string | null
  competitorId: string
  competitorName: string
  publicId: string | null
  submissionId: string | null
  status: MusicOpsStatusFilter | string
  backupStatus: string
  backupCheckedAt: string | null
  versionId: string | null
  versionNumber: number | null
  checksum: string | null
  durationSeconds: number | null
  byteSize: number | null
  storagePath: string | null
  displayFilename: string | null
  validationPending: boolean | null
}

/**
 * Build running-order music rows for a division from division_members.play_order.
 * Includes registered competitors even if music is missing.
 */
export async function buildDivisionMusicPlaylist(
  supabase: SupabaseClient,
  divisionId: string
): Promise<{ division: { id: string; name: string; event_id: string }; rows: MusicOpsRow[] }> {
  const { data: division, error: dErr } = await supabase
    .from('divisions')
    .select('id, name, event_id')
    .eq('id', divisionId)
    .single()
  if (dErr || !division) throw new Error(dErr?.message || 'Division not found')

  const { data: participants } = await supabase
    .from('division_members')
    .select('id, play_order, competitor_id, status')
    .eq('division_id', divisionId)
    .order('play_order', { ascending: true, nullsFirst: false })

  const competitorIds = [
    ...new Set(
      (participants ?? [])
        .map((p) => p.competitor_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const { data: competitors } = competitorIds.length
    ? await supabase
        .from('competitors')
        .select('id, full_name, public_id, source_member_id')
        .in('id', competitorIds)
    : {
        data: [] as Array<{
          id: string
          full_name: string
          public_id: string | null
          source_member_id: string | null
        }>,
      }

  const competitorById = new Map((competitors ?? []).map((c) => [c.id, c]))
  const { data: submissions } = competitorIds.length
    ? await supabase
        .from('music_submissions')
        .select(
          `
          id, competitor_id, status, backup_status, backup_checked_at, active_version_id,
          active_version:music_submission_versions!music_submissions_active_version_fk(
            id, version_number, checksum_sha256, duration_seconds, byte_size,
            storage_path, display_filename, validation_pending, original_filename
          )
        `
        )
        .eq('division_id', divisionId)
        .in('competitor_id', competitorIds)
    : { data: [] }

  const subByCompetitor = new Map(
    (submissions ?? []).map((s) => [s.competitor_id as string, s])
  )

  const rows: MusicOpsRow[] = []
  for (const p of participants ?? []) {
    if (!p.competitor_id) continue
    const competitor = competitorById.get(p.competitor_id)
    if (!competitor) continue
    const sub = subByCompetitor.get(competitor.id)
    const version = sub?.active_version as
      | {
          id: string
          version_number: number
          checksum_sha256: string | null
          duration_seconds: number | null
          byte_size: number | null
          storage_path: string | null
          display_filename: string | null
          validation_pending: boolean | null
          original_filename: string | null
        }
      | null
      | undefined

    const ext =
      version?.original_filename?.split('.').pop() ||
      version?.storage_path?.split('.').pop() ||
      'mp3'

    const displayFilename =
      version?.display_filename ||
      (version
        ? buildMusicDisplayFilename({
            playOrder: p.play_order,
            competitorPublicId: competitor.public_id,
            competitorName: competitor.full_name,
            stageName: division.name,
            versionNumber: version.version_number,
            ext,
          })
        : null)

    rows.push({
      divisionId: division.id,
      divisionName: division.name,
      playOrder: p.play_order,
      divisionMemberId: p.id,
      competitorId: competitor.id,
      competitorName: competitor.full_name,
      publicId: competitor.public_id,
      submissionId: sub?.id ?? null,
      status: (sub?.status as string) || 'missing',
      backupStatus: (sub?.backup_status as string) || 'unknown',
      backupCheckedAt: (sub?.backup_checked_at as string) || null,
      versionId: version?.id ?? null,
      versionNumber: version?.version_number ?? null,
      checksum: version?.checksum_sha256 ?? null,
      durationSeconds: version?.duration_seconds ?? null,
      byteSize: version?.byte_size ?? null,
      storagePath: version?.storage_path ?? null,
      displayFilename,
      validationPending: version?.validation_pending ?? null,
    })
  }

  return { division, rows }
}

export function filterMusicOpsRows(
  rows: MusicOpsRow[],
  status: MusicOpsStatusFilter
): MusicOpsRow[] {
  if (status === 'all') return rows
  return rows.filter((r) => r.status === status)
}

export function musicOpsRowsToManifestCsv(rows: MusicOpsRow[]): string {
  const header = [
    'order',
    'stage',
    'competitor_name',
    'public_id',
    'status',
    'version',
    'checksum_sha256',
    'duration_seconds',
    'byte_size',
    'display_filename',
    'backup_status',
  ]
  const lines = [header.join(',')]
  for (const r of rows) {
    const cells = [
      r.playOrder ?? '',
      r.divisionName,
      r.competitorName,
      r.publicId ?? '',
      r.status,
      r.versionNumber ?? '',
      r.checksum ?? '',
      r.durationSeconds ?? '',
      r.byteSize ?? '',
      r.displayFilename ?? '',
      r.backupStatus,
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`)
    lines.push(cells.join(','))
  }
  return lines.join('\n')
}

export async function grantMusicDeadlineException(
  supabase: SupabaseClient,
  args: {
    submissionId: string
    until: string
    actorId: string
    reason: string
  }
) {
  const { data, error } = await supabase
    .from('music_submissions')
    .update({
      deadline_exception_until: args.until,
      status: 'uploaded', // unlock for replacement flow
    })
    .eq('id', args.submissionId)
    .select('*')
    .single()
  if (error) throw error

  await supabase.from('music_audit_events').insert({
    submission_id: args.submissionId,
    actor_account_id: args.actorId,
    action: 'emergency_exception',
    detail: { reason: args.reason, until: args.until },
  })

  return data
}

export async function updateMusicBackupStatus(
  supabase: SupabaseClient,
  args: {
    submissionId: string
    backupStatus: 'unknown' | 'pending' | 'cached' | 'failed' | 'stale'
    actorId?: string | null
  }
) {
  const { data, error } = await supabase
    .from('music_submissions')
    .update({
      backup_status: args.backupStatus,
      backup_checked_at: new Date().toISOString(),
    })
    .eq('id', args.submissionId)
    .select('*')
    .single()
  if (error) throw error

  await supabase.from('music_audit_events').insert({
    submission_id: args.submissionId,
    actor_account_id: args.actorId ?? null,
    action: 'backup_status',
    detail: { backup_status: args.backupStatus },
  })

  return data
}
