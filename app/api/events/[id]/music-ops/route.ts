/**
 * Event-day music operations API.
 * GET playlist/readiness; PATCH emergency exception / backup status; ?format=manifest|playlist
 */
import { NextResponse } from 'next/server'
import {
  getAuthedAdminClient,
  requireEventCapabilityResponse,
} from '@/lib/auth/request'
import {
  buildDivisionMusicPlaylist,
  filterMusicOpsRows,
  grantMusicDeadlineException,
  musicOpsRowsToManifestCsv,
  updateMusicBackupStatus,
  type MusicOpsStatusFilter,
} from '@/lib/music/stage-ops'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      eventId,
      'manage_music'
    )
    if (denied) {
      // stage managers get read via view_ops
      const viewDenied = await requireEventCapabilityResponse(
        auth.supabaseAdmin,
        auth.user.id,
        eventId,
        'view_ops'
      )
      if (viewDenied) return denied
    }

    const { searchParams } = new URL(request.url)
    const divisionId = searchParams.get('divisionId')
    const status = (searchParams.get('status') || 'all') as MusicOpsStatusFilter
    const format = searchParams.get('format')

    const { data: divisions } = await auth.supabaseAdmin
      .from('divisions')
      .select('id, name, sort_order, track_id, stage_order')
      .eq('event_id', eventId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    const targetDivisions = divisionId
      ? (divisions ?? []).filter((d) => d.id === divisionId)
      : divisions ?? []

    const stages = []
    for (const d of targetDivisions) {
      const { division, rows } = await buildDivisionMusicPlaylist(
        auth.supabaseAdmin,
        d.id
      )
      const filtered = filterMusicOpsRows(rows, status)
      stages.push({
        divisionId: division.id,
        divisionName: division.name,
        trackId: d.track_id,
        stageOrder: d.stage_order,
        counts: {
          total: rows.length,
          missing: rows.filter((r) => r.status === 'missing').length,
          processing: rows.filter((r) =>
            ['uploaded', 'processing'].includes(r.status)
          ).length,
          flagged: rows.filter((r) => r.status === 'flagged').length,
          approved: rows.filter((r) => r.status === 'approved').length,
          locked: rows.filter((r) => r.status === 'locked').length,
          cached: rows.filter((r) => r.backupStatus === 'cached').length,
        },
        rows: filtered,
        playlist: rows, // full running order for ops
      })
    }

    if (format === 'manifest') {
      const allRows = stages.flatMap((s) => s.playlist)
      const csv = musicOpsRowsToManifestCsv(allRows)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="music-manifest-${eventId}.csv"`,
        },
      })
    }

    if (format === 'playlist') {
      const playlist = stages.flatMap((s) =>
        s.playlist.map((r, idx) => ({
          index: idx + 1,
          order: r.playOrder,
          stage: r.divisionName,
          displayFilename: r.displayFilename,
          competitorName: r.competitorName,
          publicId: r.publicId,
          status: r.status,
          versionId: r.versionId,
          checksum: r.checksum,
          durationSeconds: r.durationSeconds,
          backupStatus: r.backupStatus,
        }))
      )
      return NextResponse.json({ playlist })
    }

    // Ensure display_filename persisted for approved active versions
    for (const stage of stages) {
      for (const row of stage.playlist) {
        if (row.versionId && row.displayFilename) {
          await auth.supabaseAdmin
            .from('music_submission_versions')
            .update({ display_filename: row.displayFilename })
            .eq('id', row.versionId)
            .is('display_filename', null)
        }
      }
    }

    return NextResponse.json({
      eventId,
      statusFilter: status,
      stages,
    })
  } catch (error) {
    console.error('Music ops GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      eventId,
      'manage_music'
    )
    if (denied) return denied

    const body = await request.json()
    const action = body.action as string

    if (action === 'emergency_exception') {
      const submissionId = body.submission_id as string
      const reason = (body.reason as string | undefined)?.trim()
      const hours = Number(body.hours ?? 2)
      if (!submissionId || !reason) {
        return NextResponse.json(
          { error: 'submission_id and reason required' },
          { status: 400 }
        )
      }

      const { data: sub } = await auth.supabaseAdmin
        .from('music_submissions')
        .select('id, division_id, division:divisions(event_id)')
        .eq('id', submissionId)
        .single()

      const event_id = (sub?.division as { event_id?: string } | null)?.event_id
      if (!sub || event_id !== eventId) {
        return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
      }

      const until = new Date(Date.now() + Math.max(1, hours) * 3600 * 1000).toISOString()
      const updated = await grantMusicDeadlineException(auth.supabaseAdmin, {
        submissionId,
        until,
        actorId: auth.user.id,
        reason,
      })
      return NextResponse.json({ submission: updated, exceptionUntil: until })
    }

    if (action === 'backup_status') {
      const submissionId = body.submission_id as string
      const backupStatus = body.backup_status as
        | 'unknown'
        | 'pending'
        | 'cached'
        | 'failed'
        | 'stale'
      if (!submissionId || !backupStatus) {
        return NextResponse.json(
          { error: 'submission_id and backup_status required' },
          { status: 400 }
        )
      }
      const updated = await updateMusicBackupStatus(auth.supabaseAdmin, {
        submissionId,
        backupStatus,
        actorId: auth.user.id,
      })
      return NextResponse.json({ submission: updated })
    }

    if (action === 'signed_batch') {
      // Short-lived signed URLs for approved playlist items (stage playback / preflight)
      const versionIds = body.version_ids as string[] | undefined
      if (!Array.isArray(versionIds) || !versionIds.length) {
        return NextResponse.json({ error: 'version_ids required' }, { status: 400 })
      }

      const urls: Array<{ versionId: string; url: string; path: string }> = []
      for (const versionId of versionIds.slice(0, 100)) {
        const { data: version } = await auth.supabaseAdmin
          .from('music_submission_versions')
          .select(
            'id, storage_path, submission:music_submissions(division_id, division:divisions(event_id), status)'
          )
          .eq('id', versionId)
          .single()

        const sub = version?.submission as {
          status?: string
          division?: { event_id?: string }
        } | null
        if (!version || sub?.division?.event_id !== eventId) continue
        if (sub.status !== 'approved' && sub.status !== 'locked') continue

        const { data: signed } = await auth.supabaseAdmin.storage
          .from('competition-music')
          .createSignedUrl(version.storage_path, 600)

        if (signed?.signedUrl) {
          urls.push({
            versionId,
            url: signed.signedUrl,
            path: version.storage_path,
          })
        }
      }

      return NextResponse.json({ urls, expiresInSeconds: 600 })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Music ops PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
