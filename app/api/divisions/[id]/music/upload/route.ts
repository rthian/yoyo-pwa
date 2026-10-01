/**
 * Signed music upload + confirm + preview URL.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthedAdminClient } from '@/lib/auth/request'
import {
  assertMusicUploadAllowed,
  buildMusicStoragePath,
  ensureMusicSubmission,
  pendingMusicInspector,
  writeMusicAudit,
} from '@/lib/music/service'

interface RouteParams {
  params: Promise<{ id: string }>
}

const uploadRequestSchema = z.object({
  competitor_id: z.string().uuid(),
  filename: z.string().min(1),
  mime_type: z.string().min(3),
  byte_size: z.number().int().positive(),
  copyright_declared: z.boolean(),
  explicit_content_declared: z.boolean(),
  usage_declared: z.boolean(),
})

const confirmSchema = z.object({
  competitor_id: z.string().uuid(),
  version_id: z.string().uuid(),
  checksum_sha256: z.string().min(32).max(128),
})

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: divisionId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const body = await request.json()
    const action = body.action as string

    if (action === 'sign-upload') {
      const parsed = uploadRequestSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid data', details: parsed.error.flatten() },
          { status: 400 }
        )
      }

      if (
        !parsed.data.copyright_declared ||
        !parsed.data.usage_declared
      ) {
        return NextResponse.json(
          { error: 'Copyright and usage declarations required' },
          { status: 400 }
        )
      }

      const { requirement, division } = await assertMusicUploadAllowed(
        auth.supabaseAdmin,
        {
          accountId: auth.user.id,
          divisionId,
          competitorId: parsed.data.competitor_id,
        }
      )

      const maxBytes = requirement?.max_bytes ?? 20 * 1024 * 1024
      if (parsed.data.byte_size > maxBytes) {
        return NextResponse.json({ error: 'File too large' }, { status: 400 })
      }

      const allowed: string[] =
        requirement?.allowed_mime_types ?? [
          'audio/mpeg',
          'audio/wav',
          'audio/x-wav',
          'audio/mp4',
        ]
      // Do not trust browser MIME alone — still store claimed type; inspector pending
      if (!allowed.includes(parsed.data.mime_type)) {
        return NextResponse.json(
          { error: 'MIME type not in allowed list (pending server inspection)' },
          { status: 400 }
        )
      }

      const submission = await ensureMusicSubmission(
        auth.supabaseAdmin,
        divisionId,
        parsed.data.competitor_id
      )

      const { count } = await auth.supabaseAdmin
        .from('music_submission_versions')
        .select('*', { count: 'exact', head: true })
        .eq('submission_id', submission.id)

      const versionNumber = (count ?? 0) + 1
      const versionId = crypto.randomUUID()
      const ext = parsed.data.filename.split('.').pop() || 'mp3'
      const storagePath = buildMusicStoragePath({
        eventId: division.event_id as string,
        divisionId,
        competitorId: parsed.data.competitor_id,
        versionId,
        ext,
      })

      const { data: version, error: vErr } = await auth.supabaseAdmin
        .from('music_submission_versions')
        .insert({
          id: versionId,
          submission_id: submission.id,
          version_number: versionNumber,
          storage_path: storagePath,
          original_filename: parsed.data.filename,
          mime_type: parsed.data.mime_type,
          byte_size: parsed.data.byte_size,
          validation_pending: true,
          is_active: false,
          copyright_declared: parsed.data.copyright_declared,
          explicit_content_declared: parsed.data.explicit_content_declared,
          usage_declared: parsed.data.usage_declared,
          uploaded_by_account_id: auth.user.id,
        })
        .select('*')
        .single()

      if (vErr) {
        return NextResponse.json({ error: vErr.message }, { status: 500 })
      }

      const { data: signed, error: signErr } = await auth.supabaseAdmin.storage
        .from('competition-music')
        .createSignedUploadUrl(storagePath)

      if (signErr || !signed) {
        return NextResponse.json(
          {
            error:
              signErr?.message ||
              'Could not create signed upload URL. Ensure private bucket competition-music exists.',
          },
          { status: 500 }
        )
      }

      await writeMusicAudit(auth.supabaseAdmin, {
        submissionId: submission.id,
        versionId,
        actorId: auth.user.id,
        action: 'sign_upload',
        detail: { storagePath },
      })

      return NextResponse.json({
        version,
        signedUrl: signed.signedUrl,
        token: signed.token,
        path: storagePath,
        expiresInSeconds: 300,
      })
    }

    if (action === 'confirm') {
      const parsed = confirmSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid data', details: parsed.error.flatten() },
          { status: 400 }
        )
      }

      await assertMusicUploadAllowed(auth.supabaseAdmin, {
        accountId: auth.user.id,
        divisionId,
        competitorId: parsed.data.competitor_id,
      })

      const { data: version } = await auth.supabaseAdmin
        .from('music_submission_versions')
        .select('*, submission:music_submissions(*)')
        .eq('id', parsed.data.version_id)
        .single()

      if (!version || version.submission?.division_id !== divisionId) {
        return NextResponse.json({ error: 'Version not found' }, { status: 404 })
      }

      await auth.supabaseAdmin
        .from('music_submission_versions')
        .update({ is_active: false })
        .eq('submission_id', version.submission_id)

      await auth.supabaseAdmin
        .from('music_submission_versions')
        .update({
          checksum_sha256: parsed.data.checksum_sha256,
          is_active: true,
          validation_pending: true,
        })
        .eq('id', version.id)

      await auth.supabaseAdmin
        .from('music_submissions')
        .update({
          status: 'processing',
          active_version_id: version.id,
        })
        .eq('id', version.submission_id)

      // Async inspector interface — MVP leaves validation_pending
      await pendingMusicInspector.inspect(version.id)

      await auth.supabaseAdmin
        .from('music_submissions')
        .update({ status: 'uploaded' })
        .eq('id', version.submission_id)

      await writeMusicAudit(auth.supabaseAdmin, {
        submissionId: version.submission_id,
        versionId: version.id,
        actorId: auth.user.id,
        action: 'confirm_upload',
        detail: { checksum: parsed.data.checksum_sha256 },
      })

      return NextResponse.json({ ok: true, status: 'uploaded', validationPending: true })
    }

    if (action === 'preview') {
      const competitorId = body.competitor_id as string
      if (!competitorId) {
        return NextResponse.json({ error: 'competitor_id required' }, { status: 400 })
      }

      await assertMusicUploadAllowed(auth.supabaseAdmin, {
        accountId: auth.user.id,
        divisionId,
        competitorId,
      }).catch(async (err) => {
        // Organizers with manage_music may preview without owning competitor
        if ((err as { status?: number }).status === 403) {
          const eventId = (
            await auth.supabaseAdmin
              .from('divisions')
              .select('event_id')
              .eq('id', divisionId)
              .single()
          ).data?.event_id
          if (!eventId) throw err
          const { hasEventCapability } = await import('@/lib/auth/event-permissions')
          const ok = await hasEventCapability(
            auth.supabaseAdmin,
            auth.user.id,
            eventId,
            'manage_music'
          )
          if (!ok) throw err
          return
        }
        throw err
      })

      const { data: submission } = await auth.supabaseAdmin
        .from('music_submissions')
        .select('active_version_id')
        .eq('division_id', divisionId)
        .eq('competitor_id', competitorId)
        .maybeSingle()

      if (!submission?.active_version_id) {
        return NextResponse.json({ error: 'No active music' }, { status: 404 })
      }

      const { data: version } = await auth.supabaseAdmin
        .from('music_submission_versions')
        .select('storage_path')
        .eq('id', submission.active_version_id)
        .single()

      if (!version) {
        return NextResponse.json({ error: 'Version missing' }, { status: 404 })
      }

      const { data: signed, error } = await auth.supabaseAdmin.storage
        .from('competition-music')
        .createSignedUrl(version.storage_path, 120)

      if (error || !signed) {
        return NextResponse.json(
          { error: error?.message || 'Could not sign preview URL' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        url: signed.signedUrl,
        expiresInSeconds: 120,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500
    console.error('Music upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status }
    )
  }
}
