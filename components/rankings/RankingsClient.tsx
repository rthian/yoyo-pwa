/**
 * Rankings board — WCA-inspired filters + My standing for logged-in users.
 * Caller: app/rankings/page.tsx (Suspense)
 * Auto-focuses signed-in member (public_id/uuid); highlights row and scrolls to it.
 * User: "When i view rankings as a user, it doesnt show where i m if i m logged in..."
 */
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCountryFlag } from '@/lib/utils/country-flags'
import { Info, Loader2, LocateFixed, Search, X } from 'lucide-react'
import type { CustomLeague, DivisionFilter, GeoNode, LeagueRankingEntry, PlayCategory, Season } from '@/lib/rankings/types'
import RegionSheet from './RegionSheet'
import SearchDialog from '@/components/shared/SearchDialog'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth/context'

export default function RankingsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { member, user, loading: authLoading } = useAuth()

  const [seasons, setSeasons] = useState<Season[]>([])
  const [categories, setCategories] = useState<PlayCategory[]>([])
  const [geoNodes, setGeoNodes] = useState<GeoNode[]>([])
  const [entries, setEntries] = useState<LeagueRankingEntry[]>([])
  const [focusEntry, setFocusEntry] = useState<LeagueRankingEntry | null>(null)
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
  /** Explicit deep-link (`member` = publicId or uuid). */
  const urlFocusMember = searchParams.get('member') || ''
  const selfFocusKey = member?.public_id || member?.id || ''
  /** URL wins when set; otherwise auto-focus the signed-in member. */
  const focusMember = urlFocusMember || selfFocusKey
  const isSelfFocus =
    Boolean(selfFocusKey) &&
    Boolean(focusMember) &&
    (focusMember === selfFocusKey ||
      focusMember === member?.id ||
      focusMember === member?.public_id)
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
    // Wait for auth so logged-in users get focusMember on the first rankings fetch
    if (authLoading) return

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
      limit: '50',
    })
    if (q) params.set('q', q)
    if (focusMember) params.set('member', focusMember)

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
        setFocusEntry(data.focusEntry ?? null)
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
  }, [seasonSlug, category, geoPath, division, q, leagueSlug, race, focusMember, authLoading])

  const scrollToFocus = () => {
    const el = focusRowRef.current
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  useEffect(() => {
    if (!focusMember || loading || authLoading) return
    const t = window.setTimeout(scrollToFocus, 100)
    return () => window.clearTimeout(t)
  }, [focusMember, loading, authLoading, entries, focusEntry])

  const focusInBoard = useMemo(() => {
    if (!focusMember || !focusEntry) return false
    return entries.some(
      (e) => e.memberId === focusEntry.memberId || e.publicId === focusEntry.publicId
    )
  }, [focusMember, focusEntry, entries])

  const displayEntries = useMemo(() => {
    if (!focusEntry || focusInBoard) return entries
    return [...entries, focusEntry]
  }, [entries, focusEntry, focusInBoard])

  const selfStanding = isSelfFocus ? focusEntry : null
  const viewingOther =
    Boolean(user) && Boolean(urlFocusMember) && !isSelfFocus

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

      {!authLoading && !user && (
        <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Link
            href={`/login?redirect=${encodeURIComponent(`/rankings?${searchParams.toString()}`)}`}
            className="font-medium text-foreground underline underline-offset-2"
          >
            Sign in
          </Link>{' '}
          to see your standing on this board.
        </div>
      )}

      {user && (
        <div
          id="my-standing"
          className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                My standing
              </p>
              {viewingOther ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Viewing another player’s highlight on this board.
                </p>
              ) : loading && !selfStanding ? (
                <p className="mt-1 text-sm text-muted-foreground">Looking up your rank…</p>
              ) : selfStanding ? (
                <>
                  <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
                    #{selfStanding.rank}
                    <span className="ml-2 text-base font-medium text-muted-foreground">
                      {selfStanding.totalPoints.toLocaleString()} pts
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selfStanding.nickname || selfStanding.memberName}
                    {selfStanding.eventsPlayed
                      ? ` · ${selfStanding.eventsPlayed} event${
                          selfStanding.eventsPlayed === 1 ? '' : 's'
                        }`
                      : ''}
                    {focusInBoard ? '' : ' · outside top of list (pinned below)'}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  No points on this board for the current filters.
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {viewingOther && selfFocusKey && (
                <button
                  type="button"
                  onClick={() => setFilter({ member: null })}
                  className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
                >
                  Show mine
                </button>
              )}
              {selfStanding && <ButtonJump onClick={scrollToFocus} />}
            </div>
          </div>
        </div>
      )}

      {loading && entries.length === 0 ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : entries.length === 0 && !focusEntry ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No ranking points for this filter yet.
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {displayEntries.map((e, idx) => {
            const href = `/players/${e.publicId || e.memberId}`
            const isFocus =
              Boolean(focusMember) &&
              (e.publicId === focusMember ||
                e.memberId === focusMember ||
                (Boolean(selfFocusKey) &&
                  (e.publicId === selfFocusKey || e.memberId === selfFocusKey)))
            const isDeepPinned =
              Boolean(focusEntry) &&
              !focusInBoard &&
              e.memberId === focusEntry!.memberId &&
              idx === displayEntries.length - 1
            return (
              <li
                key={isDeepPinned ? `focus-${e.memberId}` : e.memberId}
                id={isFocus && isSelfFocus ? 'ranking-you' : undefined}
                ref={isFocus ? focusRowRef : undefined}
                className={cn(
                  isFocus && 'bg-primary/10 ring-2 ring-inset ring-primary/40',
                  isDeepPinned && 'border-t-4 border-t-muted'
                )}
              >
                {isDeepPinned && (
                  <p className="px-4 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {isSelfFocus ? 'Your standing' : 'Focused standing'} · rank #{e.rank}
                  </p>
                )}
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
                      {isFocus && isSelfFocus && (
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
          Showing top {entries.length} of {total}
          {focusEntry && !focusInBoard ? ` · your #${focusEntry.rank} pinned below` : ''}
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

function ButtonJump({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-primary/30 bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
    >
      <LocateFixed className="h-4 w-4 text-primary" />
      Jump to me
    </button>
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
