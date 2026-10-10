/**
 * Prompt 22: organizer blast + recent sends.
 */
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type Segment =
  | 'all_registered'
  | 'unpaid'
  | 'waitlisted'
  | 'confirmed'
  | 'by_division'

type LogRow = {
  id: string
  segment: string
  subject: string
  recipient_count: number
  created_at: string
  body_preview: string | null
}

export default function EventCommsPanel({
  eventId,
  readOnly = false,
}: {
  eventId: string
  readOnly?: boolean
}) {
  const [segment, setSegment] = useState<Segment>('all_registered')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState<LogRow[]>([])

  const loadLog = async () => {
    const res = await fetch(`/api/events/${eventId}/comms`)
    if (!res.ok) return
    const data = await res.json()
    setLog(data.log ?? [])
  }

  useEffect(() => {
    void loadLog()
  }, [eventId])

  const preview = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/comms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', segment }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Preview failed')
      setPreviewCount(data.count)
      toast.message(`Would reach ${data.count} recipient(s)`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setLoading(false)
    }
  }

  const send = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Subject and body required')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/comms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          segment,
          subject: subject.trim(),
          body: body.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      toast.success(`Queued ${data.recipientCount} email(s)`)
      setSubject('')
      setBody('')
      setPreviewCount(null)
      await loadLog()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {!readOnly && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Segment</Label>
            <Select
              value={segment}
              onValueChange={(v) => {
                setSegment(v as Segment)
                setPreviewCount(null)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_registered">All registered</SelectItem>
                <SelectItem value="unpaid">Unpaid / pending payment</SelectItem>
                <SelectItem value="waitlisted">Waitlisted</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="blast_subject">Subject</Label>
            <Input
              id="blast_subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="blast_body">Message</Label>
            <Textarea
              id="blast_body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={4000}
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => void preview()}
            >
              Preview count
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={() => void send()}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Send blast'
              )}
            </Button>
            {previewCount != null && (
              <Badge variant="secondary">{previewCount} recipients</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Recipients who opted out of organizer blasts are skipped. Rate
            limit: 5 blasts per event per hour.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="font-medium text-sm">Recent sends</h4>
        {!log.length ? (
          <p className="text-sm text-muted-foreground">No blasts yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {log.map((row) => (
              <li
                key={row.id}
                className="border rounded-md p-3 flex flex-col gap-1"
              >
                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <span className="font-medium">{row.subject}</span>
                  <Badge variant="outline">
                    {row.recipient_count} sent
                  </Badge>
                </div>
                <div className="text-muted-foreground text-xs">
                  {row.segment} ·{' '}
                  {new Date(row.created_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
