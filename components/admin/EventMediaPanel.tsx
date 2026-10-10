/**
 * Prompt 13: admin curated external media links.
 * Caller: app/(admin)/admin/events/[id]/page.tsx
 * API: /api/events/[id]/media — User: "prompt 13"
 */
'use client'

import type { EventOpsPanelProps } from '@/components/admin/event-ops-props'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import MediaEmbed from '@/components/media/MediaEmbed'
import {
  EXTERNAL_MEDIA_KINDS,
  kindLabel,
  providerLabel,
  type ExternalMediaKind,
  type ExternalMediaProvider,
} from '@/lib/media/external'

interface EventMediaPanelProps extends EventOpsPanelProps {
  eventId: string
}

type MediaRow = {
  id: string
  title: string
  url: string
  kind: ExternalMediaKind
  provider: ExternalMediaProvider
  description: string | null
  is_public: boolean
  sort_order: number
}

export default function EventMediaPanel({ eventId, readOnly = false }: EventMediaPanelProps) {
  const [rows, setRows] = useState<MediaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [kind, setKind] = useState<ExternalMediaKind>('highlight')
  const [isPublic, setIsPublic] = useState(true)
  const [previewId, setPreviewId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/media?all=1`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load media')
      setRows(data.media || [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const add = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/events/${eventId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          url,
          kind,
          is_public: isPublic,
          sort_order: rows.length,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Add failed')
      toast.success('Media link added')
      setTitle('')
      setUrl('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Add failed')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Remove this media link?')) return
    try {
      const res = await fetch(
        `/api/events/${eventId}/media?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      toast.success('Removed')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const togglePublic = async (row: MediaRow) => {
    try {
      const res = await fetch(`/api/events/${eventId}/media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, is_public: !row.is_public }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  return (
    <div className="space-y-6">
      {!readOnly && (
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium text-sm">Add external link</h3>
        <p className="text-xs text-muted-foreground">
          YouTube, Vimeo, and Twitch play inline on the public hub (click to load).
          Instagram and other URLs open externally.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="media-title">Title</Label>
            <Input
              id="media-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Finals highlight"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="media-url">URL</Label>
            <Input
              id="media-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtu.be/…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Kind</Label>
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as ExternalMediaKind)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXTERNAL_MEDIA_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {kindLabel(k)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant={isPublic ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsPublic((v) => !v)}
            >
              {isPublic ? 'Public' : 'Hidden'}
            </Button>
            <Button onClick={add} disabled={saving || !title.trim() || !url.trim()}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add
            </Button>
          </div>
        </div>
      </div>
      )}

      {loading ? (
        <div className="flex gap-2 text-muted-foreground text-sm py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading media…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No external media links yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="border rounded-md p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{r.title}</div>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline truncate inline-flex items-center gap-1"
                  >
                    {r.url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Badge variant="outline">{kindLabel(r.kind)}</Badge>
                <Badge variant="secondary">{providerLabel(r.provider)}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setPreviewId((id) => (id === r.id ? null : r.id))
                  }
                >
                  {previewId === r.id ? 'Hide preview' : 'Preview'}
                </Button>
                {!readOnly && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => togglePublic(r)}>
                      {r.is_public ? 'Public' : 'Hidden'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              {previewId === r.id && <MediaEmbed item={r} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
