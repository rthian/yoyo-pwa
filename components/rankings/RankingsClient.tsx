/**
 * Rankings board — WCA-inspired filters: season, category chips, Open|Women, region sheet, search.
 * Caller: app/rankings/page.tsx
 * User: filter better like WCA; gender; search
 */
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCountryFlag } from '@/lib/utils/country-flags'
import { Info, Loader2, Search, X } from 'lucide-react'
import type { CustomLeague, DivisionFilter, GeoNode, LeagueRankingEntry, PlayCategory, Season } from '@/lib/rankings/types'
import RegionSheet from './RegionSheet'
import SearchDialog from '@/components/shared/SearchDialog'
import { cn } from '@/lib/utils'

export default function RankingsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [seasons, setSeasons] = useState<Season[]>([])
  const [categories, setCategories] = useState<PlayCategory[]>([])
  const [geoNodes, setGeoNodes] = useState<GeoNode[]>([])
  const [entries, setEntries] = useState<LeagueRankingEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [regionOpen, setRegionOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [leagues, setLeagues] = useState<CustomLeague[]>([])

  const seasonSlug = searchParams.get('season') || ''
  const category = searchParams.get('category') || 'all'
  const geoPath = searchParams.get('geo') || '/WORLD'
  const division = (searchParams.get('division') || 'open') as DivisionFilter
  const q = searchParams.get('q') || ''
  const leagueSlug = searchParams.get('league') || ''
  const race = (searchParams.get('race') || 'world') as 'world' | 'national'
  /** Deep-link highlight from profile / dashboard (`member` = publicId or uuid). */
  const focusMember = searchParams.get('member') || ''
  const focusRowRef = useRef<HTMLLIElement | null>(null)

  const setFilter = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') next.delete(k)
      else next.set(k, v)
    }
    router.replace(`/rankings?${next.toString()}`, { scroll: false })
  }

  // Kick off season immediately so rankings do not wait on filters
  useEffect(() => {
    if (!searchParams.get('season')) {
      setFilter({ season: '2026' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    fetch('/api/rankings/filters', { signal: ac.signal })
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || data.hint || 'Failed to load filters')
        setSeasons(data.seasons ?? [])
        setCategories(data.categories ?? [])
        setGeoNodes(data.geoNodes ?? [])
        setLeagues(data.leagues ?? [])
        if (!searchParams.get('season')) {
          const active =
            (data.seasons as Season[])?.find((s) => s.is_active) || data.seasons?.[0]
          if (active && active.slug !== '2026') setFilter({ season: active.slug })
        }
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return
        setError(e.message)
      })
    return () => ac.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const effectiveSeason = seasonSlug || '2026'
    const ac = new AbortController()
    const hasRows = entries.length > 0
    if (hasRows) setIsRefreshing(true)
    else setLoading(true)

    const params = new URLSearchParams({
      category,
      division,
      season: effectiveSeason,
      geo: geoPath,
      // Fetch fuller page when focusing a specific member (deep ranks)
      limit: focusMember ? '200' : '50',
    })
    if (q) params.set('q', q)

    if (!leagueSlug) {
      params.set('race', race === 'national' ? 'national' : 'world')
    }

    const url = leagueSlug
      ? `/api/rankings/leagues/${encodeURIComponent(leagueSlug)}?${params}`
      : `/api/rankings?${params}`

    fetch(url, { signal: ac.signal })
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || 'Failed to load rankings')
        setEntries(data.entries ?? [])
        setTotal(data.total ?? 0)
        setError(null)
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return
        setError(e.message)
      })
      .finally(() => {
        setLoading(false)
        setIsRefreshing(false)
      })
    return () => ac.abort()
    // entries intentionally omitted — only used for soft-refresh UX
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonSlug, category, geoPath, division, q, leagueSlug, race, focusMember])

  useEffect(() => {
    if (!focusMember || loading || entries.length === 0) return
    const el = focusRowRef.current
    if (!el) return
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
    return () => window.clearTimeout(t)
  }, [focusMember, loading, entries])

  const selectedGeo = useMemo(
    () => geoNodes.find((g) => g.path === geoPath),
    [geoNodes, geoPath]
  )

  const regionLabel =
    !selectedGeo || selectedGeo.level === 'world'
      ? 'World'
      : `${selectedGeo.iso_alpha2 ? getCountryFlag(selectedGeo.iso_alpha2) + ' ' : ''}${selectedGeo.name}`

  const boardLabel = leagueSlug
    ? leagues.find((l) => l.slug === leagueSlug)?.name || 'Custom League'
    : race === 'national'
      ? 'National Race'
      : 'World Race'

  const boardHint =
    leagueSlug
      ? 'Admin-curated contests only'
      : race === 'national'
        ? 'Regional + National · championship fields only'
        : 'National + Continental + World tiers'

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-10 -mx-4 space-y-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <select
            className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
            value={seasonSlug}
            onChange={(e) => setFilter({ season: e.target.value, league: null, race: race || 'world' })}
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className="h-9 max-w-[12rem] rounded-md border bg-background px-2 text-sm"
            value={
              leagueSlug
                ? `league:${leagueSlug}`
                : race === 'national'
                  ? 'national'
                  : 'world'
            }
            onChange={(e) => {
              const v = e.target.value
              if (v === 'world') setFilter({ race: 'world', league: null })
              else if (v === 'national') setFilter({ race: 'national', league: null })
              else if (v.startsWith('league:')) {
                setFilter({ league: v.slice('league:'.length), race: null })
              }
            }}
            aria-label="Board"
          >
            <option value="world">World Race</option>
            <option value="national">National Race</option>
            {leagues
              .filter((l) => {
                const season = seasons.find((s) => s.slug === seasonSlug)
                return !season || l.season_id === season.id
              })
              .map((l) => (
                <option key={l.id} value={`league:${l.slug}`}>
                  {l.name}
                </option>
              ))}
          </select>

          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>
          <Link
            href="/rankings/how-it-works"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border"
            aria-label="How rankings work"
          >
            <Info className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-0.5">
          <Chip active={category === 'all'} onClick={() => setFilter({ category: 'all' })}>
            All
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.id}
              active={category === c.code}
              onClick={() => setFilter({ category: c.code })}
            >
              {c.code}
            </Chip>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5">
            <Seg
              active={division === 'open'}
              onClick={() => setFilter({ division: 'open' })}
            >
              Open
            </Seg>
            <Seg
              active={division === 'women'}
              onClick={() => setFilter({ division: 'women' })}
            >
              Women
            </Seg>
          </div>
          <button
            type="button"
            onClick={() => setRegionOpen(true)}
            className="inline-flex h-9 min-w-0 flex-1 items-center justify-between gap-2 rounded-md border px-3 text-sm"
          >
            <span className="truncate">{regionLabel}</span>
            {geoPath !== '/WORLD' && (
              <span
                role="button"
                tabIndex={0}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation()
                  setFilter({ geo: '/WORLD' })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation()
                    setFilter({ geo: '/WORLD' })
                  }
                }}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        </div>

        {q && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            Filter: “{q}”
            <button type="button" className="underline" onClick={() => setFilter({ q: null })}>
              Clear
            </button>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Season points — participants earn a floor; finalists and winners earn more.{' '}
        <Link href="/rankings/how-it-works" className="underline underline-offset-2">
          How it works
        </Link>
      </p>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{boardLabel}</span>
        {' · '}
        {boardHint}
        {geoPath !== '/WORLD' ? ` · ${regionLabel}` : ''}
        {isRefreshing ? ' · Updating…' : ''}
      </p>

      {loading && entries.length === 0 ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No ranking points for this filter yet.
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {entries.map((e) => {
            const href = `/players/${e.publicId || e.memberId}`
            const isFocus =
              Boolean(focusMember) &&
              (e.publicId === focusMember || e.memberId === focusMember)
            return (
              <li
                key={e.memberId}
                ref={isFocus ? focusRowRef : undefined}
                className={cn(isFocus && 'bg-primary/10 ring-2 ring-inset ring-primary/40')}
              >
                <Link
                  href={href}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
                >
                  <span className="w-8 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">
                    {e.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {e.isoAlpha2 ? `${getCountryFlag(e.isoAlpha2)} ` : ''}
                      {e.nickname || e.memberName}
                      {isFocus && (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          You
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.geoName || e.country || '—'} · {e.eventsPlayed} event
                      {e.eventsPlayed === 1 ? '' : 's'}
                      {e.overallRank != null ? ` · #${e.overallRank} open` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-base font-semibold tabular-nums">
                    {e.totalPoints.toLocaleString()}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {!loading && total > entries.length && (
        <p className="text-center text-xs text-muted-foreground">
          Showing {entries.length} of {total}
        </p>
      )}

      <RegionSheet
        open={regionOpen}
        onClose={() => setRegionOpen(false)}
        geoNodes={geoNodes}
        value={geoPath}
        onChange={(path) => setFilter({ geo: path })}
      />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-foreground text-background'
          : 'bg-muted text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

function Seg({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-3 py-1.5 text-sm font-medium ${
        active ? 'bg-foreground text-background' : 'text-muted-foreground'
      }`}
    >
      {children}
    </button>
  )
}
