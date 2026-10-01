/**
 * Admin UI for competition tracks / stage grouping.
 * Advancement is recorded only — never auto-applied without explicit apply.
 */
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'

interface EventTracksPanelProps {
  eventId: string
}

type Track = {
  id: string
  name: string
  description: string | null
  sort_order: number
}

type DivisionRow = {
  id: string
  name: string
  track_id: string | null
  stage_order: number
  allow_direct_entry: boolean
  round_type: string | null
}

export default function EventTracksPanel({ eventId }: EventTracksPanelProps) {
  const [tracks, setTracks] = useState<Track[]>([])
  const [divisions, setDivisions] = useState<DivisionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/tracks`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load tracks')
      setTracks(data.tracks || [])
      setDivisions(data.divisions || [])
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

  const create = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await fetch(`/api/events/${eventId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Create failed')
      setName('')
      toast.success('Track created')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  const attach = async (
    divisionId: string,
    trackId: string | null,
    stageOrder: number
  ) => {
    try {
      const res = await fetch(`/api/events/${eventId}/tracks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'attach_division',
          division_id: divisionId,
          track_id: trackId,
          stage_order: stageOrder,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      toast.success('Stage updated')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading tracks…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Divisions are scoring stages. Group them under a track (e.g. 1A Open → Qualifier /
        Semi / Final). Advancement decisions are recorded only — not auto-applied.
      </p>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="space-y-2 flex-1 min-w-[200px]">
          <Label>New track name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="1A Open"
          />
        </div>
        <Button onClick={create} disabled={creating || !name.trim()}>
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Add track
            </>
          )}
        </Button>
      </div>

      <div className="space-y-4">
        {tracks.map((track) => {
          const stages = divisions
            .filter((d) => d.track_id === track.id)
            .sort((a, b) => a.stage_order - b.stage_order)
          return (
            <div key={track.id} className="rounded-lg border p-4 space-y-3">
              <h3 className="font-medium">{track.name}</h3>
              {stages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No stages attached yet.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {stages.map((s) => (
                    <li key={s.id}>
                      {s.stage_order}. {s.name}
                      {s.round_type ? ` (${s.round_type})` : ''}
                      {s.allow_direct_entry ? ' · direct entry' : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Assign divisions to tracks</h3>
        {divisions.map((d) => (
          <div
            key={d.id}
            className="flex flex-wrap items-center gap-2 border rounded-md p-3"
          >
            <span className="font-medium min-w-[140px]">{d.name}</span>
            <Select
              value={d.track_id || 'none'}
              onValueChange={(v) =>
                attach(d.id, v === 'none' ? null : v, d.stage_order)
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Track" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {tracks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              className="w-24"
              value={d.stage_order}
              onChange={(e) =>
                attach(d.id, d.track_id, Number(e.target.value) || 0)
              }
              title="Stage order"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
