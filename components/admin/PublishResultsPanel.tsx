/**
 * Prompt 12: admin panel to publish official event results.
 * Caller: app/(admin)/admin/events/[id]/page.tsx
 */
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Loader2, Megaphone, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface PublishResultsPanelProps {
  eventId: string
}

type Blocker = { code: string; message: string; divisionId?: string }

export default function PublishResultsPanel({ eventId }: PublishResultsPanelProps) {
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [published, setPublished] = useState(false)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [canPublish, setCanPublish] = useState(false)
  const [blockers, setBlockers] = useState<Blocker[]>([])
  const [divisions, setDivisions] = useState<
    Array<{
      id: string
      name: string
      scoringLocked: boolean
      resultCount: number
      participantCount: number
    }>
  >([])

  const refresh = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/results/publish`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load publish status')
      setPublished(Boolean(data.published))
      setPublishedAt(data.publishedAt ?? null)
      setCanPublish(Boolean(data.canPublish))
      setBlockers(data.blockers ?? [])
      setDivisions(data.divisions ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const publish = async () => {
    if (
      !confirm(
        published
          ? 'Re-publish official results from current locked snapshots?'
          : 'Publish official results for this event? Public hub will show the frozen standings.'
      )
    ) {
      return
    }
    setActing(true)
    try {
      const res = await fetch(`/api/events/${eventId}/results/publish`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Publish failed')
        if (data.blockers) setBlockers(data.blockers)
        return
      }
      toast.success(
        `Results published (${data.divisionsRefreshed ?? 0} divisions refreshed)`
      )
      await refresh()
    } finally {
      setActing(false)
    }
  }

  const unpublish = async () => {
    if (!confirm('Unpublish official results? Live boards are unaffected.')) return
    setActing(true)
    try {
      const res = await fetch(`/api/events/${eventId}/results/publish`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Unpublish failed')
        return
      }
      toast.success('Results unpublished')
      await refresh()
    } finally {
      setActing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Official results
        </CardTitle>
        <CardDescription>
          Publish frozen standings to the public event hub. Separate from live boards and
          season finalize.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {published ? (
                <Badge className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Published
                </Badge>
              ) : (
                <Badge variant="secondary">Not published</Badge>
              )}
              {publishedAt && (
                <span className="text-xs text-muted-foreground">
                  {new Date(publishedAt).toLocaleString()}
                </span>
              )}
              {published && (
                <Button variant="link" size="sm" className="h-auto p-0" asChild>
                  <Link href={`/events/${eventId}?tab=results`} target="_blank">
                    View public results →
                  </Link>
                </Button>
              )}
            </div>

            <ul className="text-sm space-y-1">
              {divisions.map((d) => (
                <li key={d.id} className="flex flex-wrap gap-2 items-center">
                  <span className="font-medium">{d.name}</span>
                  <Badge variant={d.scoringLocked ? 'default' : 'outline'}>
                    {d.scoringLocked ? 'locked' : 'unlocked'}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {d.resultCount}/{d.participantCount} frozen rows
                  </span>
                </li>
              ))}
            </ul>

            {blockers.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Before publish
                </div>
                {blockers.map((b, i) => (
                  <p key={i} className="text-muted-foreground">
                    {b.message}
                  </p>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={publish} disabled={acting || !canPublish}>
                {acting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Megaphone className="h-4 w-4 mr-2" />
                )}
                {published ? 'Re-publish' : 'Publish results'}
              </Button>
              {published && (
                <Button variant="outline" onClick={unpublish} disabled={acting}>
                  Unpublish
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
