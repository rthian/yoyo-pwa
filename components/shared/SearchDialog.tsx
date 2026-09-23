/**
 * Full-screen search for players / events.
 * Caller: components/rankings/RankingsClient.tsx
 * Glob: no SearchDialog.tsx yet
 * Fetches /api/search; no local data files
 * User: "Lastly it should have a search for ease of discovery."
 */
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search, X } from 'lucide-react'
import type { SearchHit } from '@/lib/search/query'

interface SearchDialogProps {
  open: boolean
  onClose: () => void
}

export default function SearchDialog({ open, onClose }: SearchDialogProps) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    if (q.trim().length < 2) {
      setHits([])
      return
    }
    const t = setTimeout(() => {
      setLoading(true)
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((data) => setHits(data.hits ?? []))
        .catch(() => setHits([]))
        .finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(t)
  }, [q, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 border-b px-4 py-3">
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search players or events…"
          className="h-10 flex-1 bg-transparent text-base outline-none"
        />
        <button type="button" onClick={onClose} aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-2 py-2">
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && q.trim().length >= 2 && hits.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No results</p>
        )}
        {hits.map((h) => (
          <button
            key={`${h.type}-${h.id}`}
            type="button"
            className="flex w-full flex-col rounded-lg px-3 py-3 text-left hover:bg-muted"
            onClick={() => {
              onClose()
              router.push(h.href)
            }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {h.type}
            </span>
            <span className="font-medium">{h.title}</span>
            {h.subtitle && (
              <span className="text-xs text-muted-foreground">{h.subtitle}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
