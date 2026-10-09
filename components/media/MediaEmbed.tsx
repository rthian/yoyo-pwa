/**
 * Prompt 15: click-to-load embed player for curated external media.
 * Callers: components/events/EventHubClient.tsx Media tab
 * Props: { id, title, url, kind, provider, description? }
 * User: "ok continue next"
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  kindLabel,
  providerLabel,
  type ExternalMediaKind,
  type ExternalMediaProvider,
} from '@/lib/media/external'
import { resolveEmbed } from '@/lib/media/embed'

export type MediaEmbedItem = {
  id: string
  title: string
  url: string
  kind: string
  provider: string
  description?: string | null
}

export default function MediaEmbed({ item }: { item: MediaEmbedItem }) {
  const [active, setActive] = useState(false)
  const [parentHost, setParentHost] = useState<string | null>(null)

  useEffect(() => {
    setParentHost(window.location.hostname)
  }, [])

  const resolved = useMemo(
    () => resolveEmbed(item.url, { parentHost }),
    [item.url, parentHost]
  )

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-3">
        <div className="min-w-0">
          <p className="font-medium truncate">{item.title}</p>
          {item.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {item.description}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline">{kindLabel(item.kind as ExternalMediaKind)}</Badge>
            <Badge variant="secondary">
              {providerLabel(item.provider as ExternalMediaProvider)}
            </Badge>
          </div>
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary underline shrink-0"
        >
          Open
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="p-4 pt-3">
        {resolved.embeddable ? (
          active ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
              <iframe
                src={resolved.embedUrl}
                title={item.title}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setActive(true)}
              className="relative flex aspect-video w-full items-center justify-center rounded-lg border bg-muted/40 transition-colors hover:bg-muted"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 text-sm font-medium shadow-sm">
                <Play className="h-4 w-4 fill-current" />
                Load {providerLabel(resolved.provider)} player
              </span>
            </button>
          )
        ) : (
          <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            <p className="mb-3">
              {resolved.reason === 'needs_parent_host'
                ? 'Twitch player needs the page host — open the link instead.'
                : 'Inline play isn’t available for this link.'}
            </p>
            <Button asChild size="sm" variant="outline">
              <a href={item.url} target="_blank" rel="noreferrer">
                Open on {providerLabel(resolved.provider)}
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
