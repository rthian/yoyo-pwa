/**
 * Organizer music readiness for a division (approve / flag / reject).
 * Event-day playlist, preflight, and emergency replace live on the event Music ops tab.
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface MusicReadinessPanelProps {
  divisionId: string
  eventId?: string
  /** `/admin` (default) or `/organize` */
  basePath?: string
}

type Submission = {
  id: string
  status: string
  backup_status?: string | null
  competitor: { full_name: string; public_id: string | null } | null
}

export default function MusicReadinessPanel({
  divisionId,
  eventId,
  basePath = '/admin',
}: MusicReadinessPanelProps) {
  const [rows, setRows] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/divisions/${divisionId}/music`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setRows(data.submissions || [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divisionId])

  const counts = useMemo(() => {
    const c = { total: rows.length, approved: 0, flagged: 0, missing: 0, other: 0 }
    for (const r of rows) {
      if (r.status === 'approved' || r.status === 'locked') c.approved++
      else if (r.status === 'flagged') c.flagged++
      else if (r.status === 'missing') c.missing++
      else c.other++
    }
    return c
  }, [rows])

  const setStatus = async (submissionId: string, status: string) => {
    try {
      const res = await fetch(`/api/divisions/${divisionId}/music`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: submissionId, status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      toast.success(`Marked ${status}`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  if (loading) {
    return (
      <div className="flex gap-2 text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading music readiness…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">Music readiness</h3>
        {eventId && (
          <Button variant="link" size="sm" className="h-auto p-0" asChild>
            <a href={`${basePath}/events/${eventId}?tab=music`}>
              Event music ops →
            </a>
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>{counts.approved}/{counts.total} approved</span>
        <span>· {counts.flagged} flagged</span>
        <span>· {counts.missing} missing</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No submissions yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-2 border rounded-md p-2"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium">{r.competitor?.full_name}</span>
                {r.competitor?.public_id && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {r.competitor.public_id}
                  </span>
                )}
              </div>
              <Badge variant="outline">{r.status}</Badge>
              {r.backup_status && r.backup_status !== 'unknown' && (
                <Badge variant="secondary">{r.backup_status}</Badge>
              )}
              <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, 'approved')}>
                Approve
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, 'flagged')}>
                Flag
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, 'rejected')}>
                Reject
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
