/**
 * Admin Custom League manager — create leagues and assign contest include lists.
 * Caller: app/(admin)/admin/leagues/page.tsx
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CustomLeague } from '@/lib/rankings/types'

type SeasonOpt = { id: string; name: string; slug: string }
type EventOpt = { id: string; name: string; event_date: string | null; season_id: string | null }

export default function CustomLeaguesPanel({
  initialEvents = [],
}: {
  initialEvents?: EventOpt[]
}) {
  const [seasons, setSeasons] = useState<SeasonOpt[]>([])
  const [leagues, setLeagues] = useState<CustomLeague[]>([])
  const [events] = useState<EventOpt[]>(initialEvents)
  const [seasonId, setSeasonId] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [eventIds, setEventIds] = useState<string[]>([])
  const [name, setName] = useState('')
  const [counting, setCounting] = useState('8')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadFilters = useCallback(async () => {
    const res = await fetch('/api/rankings/filters')
    const data = await res.json()
    const s = (data.seasons ?? []) as SeasonOpt[]
    setSeasons(s)
    const active = s.find((x) => (x as { is_active?: boolean }).is_active) || s[0]
    if (active) setSeasonId(active.id)
  }, [])

  const loadLeagues = useCallback(async (sid: string) => {
    if (!sid) return
    const res = await fetch(`/api/admin/custom-leagues?seasonId=${sid}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load leagues')
    setLeagues(data.leagues ?? [])
  }, [])

  useEffect(() => {
    loadFilters().catch((e) => setStatus(String(e.message || e)))
  }, [loadFilters])

  useEffect(() => {
    if (!seasonId) return
    loadLeagues(seasonId).catch((e) => setStatus(String(e.message || e)))
  }, [seasonId, loadLeagues])

  async function selectLeague(id: string) {
    setSelectedId(id)
    setStatus(null)
    const res = await fetch(`/api/admin/custom-leagues/${id}`)
    const data = await res.json()
    if (!res.ok) {
      setStatus(data.error || 'Failed to load')
      return
    }
    setEventIds(data.eventIds ?? [])
    setName(data.league?.name ?? '')
    setCounting(String(data.league?.counting_results ?? ''))
  }

  async function createLeague() {
    if (!name.trim() || !seasonId) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch('/api/admin/custom-leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          season_id: seasonId,
          counting_results: counting ? Number(counting) : null,
          eligibility_mode: 'open',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Create failed')
      await loadLeagues(seasonId)
      setSelectedId(data.league.id)
      setEventIds([])
      setStatus('Created')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  async function saveEvents() {
    if (!selectedId) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/admin/custom-leagues/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          counting_results: counting === '' ? null : Number(counting),
          event_ids: eventIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setEventIds(data.eventIds ?? [])
      await loadLeagues(seasonId)
      setStatus('Saved contest list')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  function toggleEvent(id: string) {
    setEventIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label>Season</Label>
          <select
            className="mt-1 flex h-10 w-56 rounded-md border border-input bg-background px-3 text-sm"
            value={seasonId}
            onChange={(e) => {
              setSeasonId(e.target.value)
              setSelectedId(null)
              setEventIds([])
            }}
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>League name</Label>
          <Input
            className="mt-1 w-64"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. SEA Circuit 2026"
          />
        </div>
        <div>
          <Label>Best-N</Label>
          <Input
            className="mt-1 w-24"
            value={counting}
            onChange={(e) => setCounting(e.target.value)}
            placeholder="8"
          />
        </div>
        <Button type="button" disabled={busy} onClick={createLeague}>
          Create league
        </Button>
        {selectedId && (
          <Button type="button" variant="secondary" disabled={busy} onClick={saveEvents}>
            Save contests
          </Button>
        )}
      </div>

      {status && <p className="text-sm text-muted-foreground">{status}</p>}

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Custom Leagues
          </h2>
          <ul className="divide-y rounded-md border">
            {leagues.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground">None yet</li>
            )}
            {leagues.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-accent ${
                    selectedId === l.id ? 'bg-accent' : ''
                  }`}
                  onClick={() => selectLeague(l.id)}
                >
                  <span className="font-medium">{l.name}</span>
                  <span className="ml-2 text-muted-foreground">/{l.slug}</span>
                  {!l.is_active && (
                    <span className="ml-2 text-xs text-amber-600">inactive</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {selectedId && (
            <p className="mt-2 text-xs text-muted-foreground">
              Public board:{' '}
              <code className="rounded bg-muted px-1">/api/rankings/leagues/{'{slug}'}</code>
            </p>
          )}
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Contests in league ({eventIds.length})
          </h2>
          {!selectedId ? (
            <p className="text-sm text-muted-foreground">Select or create a league first.</p>
          ) : (
            <ul className="max-h-[28rem] space-y-1 overflow-y-auto rounded-md border p-2">
              {events.length === 0 && (
                <li className="p-2 text-sm text-muted-foreground">No events loaded</li>
              )}
              {events
                .filter((e) => !seasonId || e.season_id === seasonId)
                .map((e) => {
                const on = eventIds.includes(e.id)
                return (
                  <li key={e.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={on}
                        onChange={() => toggleEvent(e.id)}
                      />
                      <span>
                        <span className="font-medium">{e.name}</span>
                        {e.event_date && (
                          <span className="ml-2 text-muted-foreground">{e.event_date}</span>
                        )}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
