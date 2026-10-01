/**
 * Organizer music readiness for a division.
 */
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface MusicReadinessPanelProps {
  divisionId: string
}

type Submission = {
  id: string
  status: string
  competitor: { full_name: string; public_id: string | null } | null
}

export default function MusicReadinessPanel({ divisionId }: MusicReadinessPanelProps) {
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
      <h3 className="font-medium">Music readiness</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No submissions yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-2 border rounded-md p-2"
            >
              <span className="font-medium">{r.competitor?.full_name}</span>
              <Badge variant="outline">{r.status}</Badge>
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
