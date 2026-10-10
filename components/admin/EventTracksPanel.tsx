/**
 * Competition tracks + explicit advancement apply (Prompt 18).
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { EventOpsPanelProps } from '@/components/admin/event-ops-props'

interface EventTracksPanelProps extends EventOpsPanelProps {
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
  capacity?: number | null
}

type DecisionRow = {
  id: string
  track_id: string
  competitor_id: string
  competitor_name: string | null
  from_division_id: string
  to_division_id: string
  decision: string
  applied: boolean
  created_at: string
  reason: string | null
}

type CapacityInfo = {
  divisionId: string
  capacity: number | null
  current: number
  remaining: number | null
  overCapacity: boolean
  wouldExceed: boolean
}

type Participant = {
  id: string
  competitor_id: string
  status: string
  competitor?: { full_name?: string; public_id?: string | null } | null
}

export default function EventTracksPanel({
  eventId,
  readOnly = false,
}: EventTracksPanelProps) {
  const [tracks, setTracks] = useState<Track[]>([])
  const [divisions, setDivisions] = useState<DivisionRow[]>([])
  const [decisions, setDecisions] = useState<DecisionRow[]>([])
  const [capacityByDivision, setCapacityByDivision] = useState<
    Record<string, CapacityInfo>
  >({})
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  // Advancement form
  const [trackId, setTrackId] = useState('')
  const [fromDivisionId, setFromDivisionId] = useState('')
  const [toDivisionId, setToDivisionId] = useState('')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [decisionType, setDecisionType] = useState<'advanced' | 'not_advanced'>(
    'advanced'
  )
  const [preview, setPreview] = useState<CapacityInfo | null>(null)
  const [acting, setActing] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/tracks`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load tracks')
      setTracks(data.tracks || [])
      setDivisions(data.divisions || [])
      setDecisions(data.decisions || [])
      setCapacityByDivision(data.capacityByDivision || {})
      if (!trackId && data.tracks?.[0]?.id) setTrackId(data.tracks[0].id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const stagesForTrack = useMemo(
    () =>
      divisions
        .filter((d) => d.track_id === trackId)
        .sort((a, b) => a.stage_order - b.stage_order),
    [divisions, trackId]
  )

  useEffect(() => {
    if (!fromDivisionId) {
      setParticipants([])
      setSelected(new Set())
      return
    }
    void (async () => {
      try {
        const res = await fetch(`/api/divisions/${fromDivisionId}/participants`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load participants')
        const rows = (data.participants || []) as Participant[]
        setParticipants(rows.filter((p) => p.status !== 'withdrawn'))
        setSelected(new Set())
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load participants')
      }
    })()
  }, [fromDivisionId])

  useEffect(() => {
    if (!toDivisionId || decisionType === 'not_advanced') {
      setPreview(null)
      return
    }
    void (async () => {
      const res = await fetch(`/api/events/${eventId}/tracks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview_capacity',
          to_division_id: toDivisionId,
          additional_seats: selected.size,
        }),
      })
      const data = await res.json()
      if (res.ok) setPreview(data.capacity)
    })()
  }, [eventId, toDivisionId, selected.size, decisionType])

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
    nextTrackId: string | null,
    stageOrder: number
  ) => {
    try {
      const res = await fetch(`/api/events/${eventId}/tracks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'attach_division',
          division_id: divisionId,
          track_id: nextTrackId,
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

  const toggle = (competitorId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(competitorId)) next.delete(competitorId)
      else next.add(competitorId)
      return next
    })
  }

  const advanceSelected = async (apply: boolean) => {
    if (!trackId || !fromDivisionId || !toDivisionId || !selected.size) {
      toast.error('Pick track, stages, and at least one competitor')
      return
    }
    if (fromDivisionId === toDivisionId) {
      toast.error('From and to stages must differ')
      return
    }
    if (
      apply &&
      decisionType !== 'not_advanced' &&
      preview?.wouldExceed
    ) {
      const ok = confirm(
        `Target stage would exceed capacity (${preview.current}+${selected.size} / ${preview.capacity}). Apply anyway?`
      )
      if (!ok) return
    }

    setActing(true)
    let okCount = 0
    try {
      for (const competitorId of selected) {
        const res = await fetch(`/api/events/${eventId}/tracks`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'advancement_decision',
            track_id: trackId,
            competitor_id: competitorId,
            from_division_id: fromDivisionId,
            to_division_id: toDivisionId,
            decision: decisionType,
            apply,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Decision failed')
        okCount += 1
      }
      toast.success(
        apply
          ? `Applied ${okCount} decision(s) — seats updated`
          : `Recorded ${okCount} decision(s) (not applied)`
      )
      setSelected(new Set())
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Advancement failed')
      await load()
    } finally {
      setActing(false)
    }
  }

  const applyOne = async (decisionId: string) => {
    setActing(true)
    try {
      const res = await fetch(`/api/events/${eventId}/tracks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply_decision', decision_id: decisionId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Apply failed')
      if (data.capacity?.wouldExceed) {
        toast.message('Applied — target stage is at/over capacity')
      } else {
        toast.success('Decision applied — seat created')
      }
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Apply failed')
    } finally {
      setActing(false)
    }
  }

  const divName = (id: string) =>
    divisions.find((d) => d.id === id)?.name ?? id.slice(0, 8)

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
        Group divisions under a track (Qualifier → Semi → Final). Advancement
        seats competitors in the next stage only when you explicitly apply.
      </p>

      {!readOnly && (
        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-2 flex-1 min-w-[200px]">
            <Label>New track name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="1A Open"
            />
          </div>
          <Button onClick={() => void create()} disabled={creating || !name.trim()}>
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
      )}

      <div className="space-y-4">
        {tracks.map((track) => {
          const stages = divisions
            .filter((d) => d.track_id === track.id)
            .sort((a, b) => a.stage_order - b.stage_order)
          return (
            <div key={track.id} className="rounded-lg border p-4 space-y-3">
              <h3 className="font-medium">{track.name}</h3>
              {stages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No stages attached yet.
                </p>
              ) : (
                <ul className="text-sm space-y-1">
                  {stages.map((s) => {
                    const cap = capacityByDivision[s.id]
                    return (
                      <li key={s.id} className="flex flex-wrap gap-2 items-center">
                        <span>
                          {s.stage_order}. {s.name}
                          {s.round_type ? ` (${s.round_type})` : ''}
                        </span>
                        {cap && (
                          <Badge variant="outline" className="text-xs">
                            {cap.current}
                            {cap.capacity != null ? ` / ${cap.capacity}` : ''}{' '}
                            seated
                          </Badge>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {!readOnly && (
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
                  void attach(d.id, v === 'none' ? null : v, d.stage_order)
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
                  void attach(d.id, d.track_id, Number(e.target.value) || 0)
                }
                title="Stage order"
              />
            </div>
          ))}
        </div>
      )}

      {!readOnly && tracks.length > 0 && (
        <div className="space-y-4 border rounded-lg p-4">
          <div>
            <h3 className="font-medium">Advance competitors</h3>
            <p className="text-sm text-muted-foreground">
              Record without seating, or apply to insert into the next stage&apos;s
              division_members.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Track</Label>
              <Select
                value={trackId}
                onValueChange={(v) => {
                  setTrackId(v)
                  setFromDivisionId('')
                  setToDivisionId('')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Track" />
                </SelectTrigger>
                <SelectContent>
                  {tracks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Decision</Label>
              <Select
                value={decisionType}
                onValueChange={(v) =>
                  setDecisionType(v as 'advanced' | 'not_advanced')
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="advanced">Advance (seat on apply)</SelectItem>
                  <SelectItem value="not_advanced">Not advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From stage</Label>
              <Select value={fromDivisionId} onValueChange={setFromDivisionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Qualifier…" />
                </SelectTrigger>
                <SelectContent>
                  {stagesForTrack.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.stage_order}. {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>To stage</Label>
              <Select value={toDivisionId} onValueChange={setToDivisionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Semi…" />
                </SelectTrigger>
                <SelectContent>
                  {stagesForTrack.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.stage_order}. {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {preview && decisionType === 'advanced' && (
            <p
              className={
                preview.wouldExceed
                  ? 'text-sm text-amber-700 dark:text-amber-400'
                  : 'text-sm text-muted-foreground'
              }
            >
              Target capacity: {preview.current}
              {preview.capacity != null ? ` / ${preview.capacity}` : ' (no limit)'}
              {selected.size > 0
                ? ` → ${preview.current + selected.size} after apply`
                : ''}
              {preview.wouldExceed ? ' — would exceed capacity' : ''}
            </p>
          )}

          {fromDivisionId && (
            <div className="space-y-2 max-h-56 overflow-y-auto border rounded-md p-2">
              {!participants.length ? (
                <p className="text-sm text-muted-foreground p-2">
                  No competitors in this stage.
                </p>
              ) : (
                participants.map((p) => {
                  const label =
                    p.competitor?.full_name ||
                    p.competitor_id.slice(0, 8)
                  return (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 text-sm px-2 py-1.5 hover:bg-muted/50 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(p.competitor_id)}
                        onChange={() => toggle(p.competitor_id)}
                      />
                      <span>{label}</span>
                      <Badge variant="outline" className="text-xs">
                        {p.status}
                      </Badge>
                    </label>
                  )
                })
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={acting || !selected.size}
              onClick={() => void advanceSelected(false)}
            >
              Record only
            </Button>
            <Button
              disabled={acting || !selected.size}
              onClick={() => void advanceSelected(true)}
            >
              {acting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Apply & seat'
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Advancement history</h3>
        {!decisions.length ? (
          <p className="text-sm text-muted-foreground">No decisions yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {decisions.map((d) => (
              <li
                key={d.id}
                className="border rounded-md p-3 flex flex-wrap gap-2 items-center justify-between"
              >
                <div>
                  <span className="font-medium">
                    {d.competitor_name || d.competitor_id.slice(0, 8)}
                  </span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {d.decision} · {divName(d.from_division_id)} →{' '}
                    {divName(d.to_division_id)}
                  </span>
                  <div className="text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={d.applied ? 'default' : 'secondary'}>
                    {d.applied ? 'applied' : 'pending'}
                  </Badge>
                  {!readOnly && !d.applied && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={acting}
                      onClick={() => void applyOne(d.id)}
                    >
                      Apply
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
