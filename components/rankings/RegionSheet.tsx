/**
 * WCA-inspired region picker: World → Region → Country (then state).
 * Caller: components/rankings/RankingsClient.tsx
 * User: "For region it should also include country selection"
 */
'use client'

import { useMemo, useState } from 'react'
import { getCountryFlag } from '@/lib/utils/country-flags'
import type { GeoNode } from '@/lib/rankings/types'
import { ChevronRight, X } from 'lucide-react'

interface RegionSheetProps {
  open: boolean
  onClose: () => void
  geoNodes: GeoNode[]
  value: string
  onChange: (path: string) => void
}

export default function RegionSheet({
  open,
  onClose,
  geoNodes,
  value,
  onChange,
}: RegionSheetProps) {
  const [q, setQ] = useState('')
  // Browse scope: which region we're listing countries under (null = top-level)
  const [browseRegionPath, setBrowseRegionPath] = useState<string | null>(null)

  const world = geoNodes.find((g) => g.level === 'world')
  const regions = geoNodes.filter((g) => g.level === 'region')
  const countries = geoNodes.filter((g) => g.level === 'country')
  const states = geoNodes.filter((g) => g.level === 'state')

  const browseRegion = browseRegionPath
    ? regions.find((r) => r.path === browseRegionPath)
    : null

  const countriesInBrowse = useMemo(() => {
    if (!browseRegionPath) return []
    return countries
      .filter((c) => c.path.startsWith(browseRegionPath + '/'))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [countries, browseRegionPath])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return null
    return geoNodes
      .filter(
        (g) =>
          g.level !== 'world' &&
          (g.name.toLowerCase().includes(term) ||
            g.code.toLowerCase().includes(term) ||
            (g.iso_alpha2 ?? '').toLowerCase().includes(term))
      )
      .sort((a, b) => {
        const order = { region: 0, country: 1, state: 2 } as Record<string, number>
        return (order[a.level] ?? 9) - (order[b.level] ?? 9) || a.name.localeCompare(b.name)
      })
  }, [q, geoNodes])

  if (!open) return null

  const pick = (path: string) => {
    onChange(path)
    onClose()
    setQ('')
    setBrowseRegionPath(null)
  }

  const close = () => {
    onClose()
    setQ('')
    setBrowseRegionPath(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={close}>
      <div
        className="max-h-[85vh] overflow-hidden rounded-t-2xl bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">
            {browseRegion && !q ? browseRegion.name : 'Region'}
          </h2>
          <button type="button" onClick={close} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b px-4 py-2">
          <input
            autoFocus={!browseRegion}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search country or region…"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <div className="overflow-y-auto px-2 py-2" style={{ maxHeight: '60vh' }}>
          {filtered ? (
            filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No matches</p>
            ) : (
              filtered.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => pick(g.path)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted ${
                    value === g.path ? 'bg-muted font-medium' : ''
                  }`}
                >
                  <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {g.level}
                  </span>
                  <span>
                    {g.iso_alpha2 ? `${getCountryFlag(g.iso_alpha2)} ` : ''}
                    {g.name}
                  </span>
                </button>
              ))
            )
          ) : browseRegion ? (
            <>
              <button
                type="button"
                onClick={() => setBrowseRegionPath(null)}
                className="mb-1 flex w-full items-center gap-1 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ← All regions
              </button>
              <button
                type="button"
                onClick={() => pick(browseRegion.path)}
                className={`flex w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-muted ${
                  value === browseRegion.path ? 'bg-muted' : ''
                }`}
              >
                Entire {browseRegion.name}
              </button>
              <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Countries
              </p>
              {countriesInBrowse.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  No countries seeded under this region yet.
                </p>
              ) : (
                countriesInBrowse.map((c) => {
                  const st = states.filter((s) => s.path.startsWith(c.path + '/'))
                  return (
                    <div key={c.id}>
                      <button
                        type="button"
                        onClick={() => pick(c.path)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted ${
                          value === c.path ? 'bg-muted font-medium' : ''
                        }`}
                      >
                        <span>
                          {c.iso_alpha2 ? `${getCountryFlag(c.iso_alpha2)} ` : ''}
                          {c.name}
                        </span>
                      </button>
                      {st.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => pick(s.path)}
                          className={`flex w-full rounded-lg px-3 py-1.5 pl-8 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground ${
                            value === s.path ? 'bg-muted font-medium text-foreground' : ''
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )
                })
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => pick(world?.path || '/WORLD')}
                className={`flex w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted ${
                  value === '/WORLD' || value === world?.path ? 'bg-muted font-medium' : ''
                }`}
              >
                World
              </button>
              <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Regions
              </p>
              {regions.map((r) => {
                const kidCount = countries.filter((c) =>
                  c.path.startsWith(r.path + '/')
                ).length
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      if (kidCount > 0) setBrowseRegionPath(r.path)
                      else pick(r.path)
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted ${
                      value === r.path || value.startsWith(r.path + '/')
                        ? 'bg-muted font-medium'
                        : ''
                    }`}
                  >
                    <span>{r.name}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {kidCount > 0 ? `${kidCount}` : null}
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </button>
                )
              })}
              {countries.length > 0 && (
                <>
                  <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    All countries
                  </p>
                  {[...countries]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => pick(c.path)}
                        className={`flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted ${
                          value === c.path ? 'bg-muted font-medium' : ''
                        }`}
                      >
                        {c.iso_alpha2 ? `${getCountryFlag(c.iso_alpha2)} ` : ''}
                        {c.name}
                      </button>
                    ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
