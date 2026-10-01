/**
 * Event-day music operations dashboard.
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Download, HardDrive, Loader2, RefreshCw, Siren } from 'lucide-react'
import { toast } from 'sonner'
import { preflightCacheApproved } from '@/lib/music/offline-cache'

interface EventMusicOpsPanelProps {
  eventId: string
}

type OpsRow = {
  playOrder: number | null
  competitorName: string
  publicId: string | null
  status: string
  backupStatus: string
  versionId: string | null
  versionNumber: number | null
  checksum: string | null
  durationSeconds: number | null
  displayFilename: string | null
  submissionId: string | null
  divisionName: string
}

type StageBlock = {
  divisionId: string
  divisionName: string
  counts: Record<string, number>
  playlist: OpsRow[]
  rows: OpsRow[]
}

const STATUS_FILTERS = [
  'all',
  'missing',
  'processing',
  'uploaded',
  'flagged',
  'approved',
  'rejected',
  'locked',
] as const

export default function EventMusicOpsPanel({ eventId }: EventMusicOpsPanelProps) {
  const [stages, setStages] = useState<StageBlock[]>([])
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('all')
  const [divisionId, setDivisionId] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [preflighting, setPreflighting] = useState(false)
  const [emergencyId, setEmergencyId] = useState<string | null>(null)
  const [emergencyReason, setEmergencyReason] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ status })
      if (divisionId !== 'all') qs.set('divisionId', divisionId)
      const res = await fetch(`/api/events/${eventId}/music-ops?${qs}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load music ops')
      setStages(data.stages || [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, status, divisionId])

  const allDivisions = useMemo(() => {
    return stages.map((s) => ({ id: s.divisionId, name: s.divisionName }))
  }, [stages])

  const visibleRows = useMemo(
    () => stages.flatMap((s) => s.rows.map((r) => ({ ...r, divisionId: s.divisionId }))),
    [stages]
  )

  const runPreflight = async () => {
    setPreflighting(true)
    try {
      const approved = stages
        .flatMap((s) => s.playlist)
        .filter((r) => r.status === 'approved' || r.status === 'locked')
        .filter((r) => r.versionId)

      if (!approved.length) {
        toast.message('No approved tracks to cache')
        return
      }

      const versionIds = approved.map((r) => r.versionId!)
      const signRes = await fetch(`/api/events/${eventId}/music-ops`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signed_batch', version_ids: versionIds }),
      })
      const signData = await signRes.json()
      if (!signRes.ok) throw new Error(signData.error || 'Could not sign batch')

      const urlByVersion = new Map<string, string>(
        ((signData.urls || []) as Array<{ versionId: string; url: string }>).map(
          (u) => [u.versionId, u.url]
        )
      )

      const result = await preflightCacheApproved(
        approved
          .map((r) => ({
            versionId: r.versionId!,
            url: urlByVersion.get(r.versionId!) ?? '',
            checksum: r.checksum,
            displayFilename: r.displayFilename,
          }))
          .filter((i): i is typeof i & { url: string } => Boolean(i.url))
      )

      for (const versionId of result.cached) {
        const row = approved.find((r) => r.versionId === versionId)
        if (!row?.submissionId) continue
        await fetch(`/api/events/${eventId}/music-ops`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'backup_status',
            submission_id: row.submissionId,
            backup_status: 'cached',
          }),
        })
      }
      for (const fail of result.failed) {
        const row = approved.find((r) => r.versionId === fail.versionId)
        if (!row?.submissionId) continue
        await fetch(`/api/events/${eventId}/music-ops`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'backup_status',
            submission_id: row.submissionId,
            backup_status: 'failed',
          }),
        })
      }

      toast.success(
        `Preflight: ${result.cached.length} cached, ${result.failed.length} failed`
      )
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preflight failed')
    } finally {
      setPreflighting(false)
    }
  }

  const emergency = async (submissionId: string) => {
    if (!emergencyReason.trim()) {
      toast.error('Reason required for emergency replacement')
      return
    }
    try {
      const res = await fetch(`/api/events/${eventId}/music-ops`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'emergency_exception',
          submission_id: submissionId,
          reason: emergencyReason.trim(),
          hours: 2,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Exception failed')
      toast.success('Emergency window opened (2h) — competitor can re-upload')
      setEmergencyId(null)
      setEmergencyReason('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Exception failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={divisionId} onValueChange={setDivisionId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {allDivisions.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/events/${eventId}/music-ops?format=manifest`}>
              <Download className="h-4 w-4 mr-2" />
              Manifest CSV
            </a>
          </Button>
          <Button size="sm" onClick={runPreflight} disabled={preflighting}>
            {preflighting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <HardDrive className="h-4 w-4 mr-2" />
            )}
            Offline preflight
          </Button>
        </div>
      </div>

      {stages.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {stages.map((s) => (
            <Badge key={s.divisionId} variant="secondary">
              {s.divisionName}: {s.counts.approved}/{s.counts.total} approved ·{' '}
              {s.counts.missing} missing · {s.counts.cached} cached
            </Badge>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading music ops…
        </div>
      ) : visibleRows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No rows for this filter.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Competitor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Backup</TableHead>
              <TableHead>File</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((r) => (
              <TableRow key={`${r.divisionName}-${r.submissionId || r.publicId}-${r.playOrder}`}>
                <TableCell>{r.playOrder ?? '—'}</TableCell>
                <TableCell>{r.divisionName}</TableCell>
                <TableCell>
                  <div className="font-medium">{r.competitorName}</div>
                  <div className="text-xs text-muted-foreground">{r.publicId}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{r.status}</Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={r.backupStatus === 'cached' ? 'default' : 'secondary'}
                  >
                    {r.backupStatus}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs max-w-[220px] truncate">
                  {r.displayFilename || '—'}
                  {r.durationSeconds != null && (
                    <span className="text-muted-foreground"> · {r.durationSeconds}s</span>
                  )}
                </TableCell>
                <TableCell>
                  {r.submissionId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEmergencyId(r.submissionId)}
                    >
                      <Siren className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {emergencyId && (
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="font-medium">Emergency replacement</h3>
          <p className="text-sm text-muted-foreground">
            Opens a 2-hour deadline exception. Reason is required and audited.
          </p>
          <Input
            placeholder="Reason for emergency replacement"
            value={emergencyReason}
            onChange={(e) => setEmergencyReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={() => emergency(emergencyId)}>Approve exception</Button>
            <Button variant="outline" onClick={() => setEmergencyId(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
