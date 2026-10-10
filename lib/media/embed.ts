/**
 * Prompt 14–15: resolve safe embed iframes from external media URLs.
 * Callers: components/media/MediaEmbed.tsx, EventHubClient Media tab
 * Glob: no prior lib/media/embed.ts
 * Sample: resolveEmbed('https://youtu.be/dQw4w9WgXcQ') → youtube-nocookie embed URL
 * User: "ok continue next"
 */
import {
  detectMediaProvider,
  type ExternalMediaProvider,
} from '@/lib/media/external'

export type EmbedResolution =
  | {
      embeddable: true
      provider: ExternalMediaProvider
      embedUrl: string
      providerId: string
    }
  | {
      embeddable: false
      provider: ExternalMediaProvider
      reason: 'unsupported_provider' | 'unparseable_url' | 'needs_parent_host'
    }

/** Extract YouTube video id from watch / youtu.be / embed / shorts URLs. */
export function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      return id && /^[\w-]{6,}$/.test(id) ? id : null
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const v = u.searchParams.get('v')
      if (v && /^[\w-]{6,}$/.test(v)) return v
      const parts = u.pathname.split('/').filter(Boolean)
      const marker = parts.findIndex((p) =>
        ['embed', 'shorts', 'live', 'v'].includes(p)
      )
      if (
        marker >= 0 &&
        parts[marker + 1] &&
        /^[\w-]{6,}$/.test(parts[marker + 1])
      ) {
        return parts[marker + 1]
      }
    }
    return null
  } catch {
    return null
  }
}

export function extractVimeoId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    if (!host.endsWith('vimeo.com')) return null
    const parts = u.pathname.split('/').filter(Boolean)
    const id = parts[0] === 'video' ? parts[1] : parts[0]
    return id && /^\d+$/.test(id) ? id : null
  } catch {
    return null
  }
}

export function extractTwitchTarget(
  url: string
): { type: 'channel' | 'video'; id: string } | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    if (!host.endsWith('twitch.tv')) return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts[0] === 'videos' && parts[1] && /^\d+$/.test(parts[1])) {
      return { type: 'video', id: parts[1] }
    }
    if (parts[0] === 'video' && parts[1] && /^\d+$/.test(parts[1])) {
      return { type: 'video', id: parts[1] }
    }
    if (parts[0] && !['directory', 'downloads'].includes(parts[0])) {
      return { type: 'channel', id: parts[0] }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Build an allowlisted embed URL. Twitch requires parent hostname (no protocol).
 */
export function resolveEmbed(
  url: string,
  options?: { parentHost?: string | null }
): EmbedResolution {
  const provider = detectMediaProvider(url)

  if (provider === 'youtube') {
    const id = extractYoutubeId(url)
    if (!id) {
      return { embeddable: false, provider, reason: 'unparseable_url' }
    }
    return {
      embeddable: true,
      provider,
      providerId: id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`,
    }
  }

  if (provider === 'vimeo') {
    const id = extractVimeoId(url)
    if (!id) {
      return { embeddable: false, provider, reason: 'unparseable_url' }
    }
    return {
      embeddable: true,
      provider,
      providerId: id,
      embedUrl: `https://player.vimeo.com/video/${encodeURIComponent(id)}`,
    }
  }

  if (provider === 'twitch') {
    const parent = (options?.parentHost || '').replace(/:\d+$/, '')
    if (!parent) {
      return { embeddable: false, provider, reason: 'needs_parent_host' }
    }
    const target = extractTwitchTarget(url)
    if (!target) {
      return { embeddable: false, provider, reason: 'unparseable_url' }
    }
    const params = new URLSearchParams({ parent, autoplay: 'false' })
    if (target.type === 'video') params.set('video', `v${target.id}`)
    else params.set('channel', target.id)
    return {
      embeddable: true,
      provider,
      providerId: target.id,
      embedUrl: `https://player.twitch.tv/?${params.toString()}`,
    }
  }

  return { embeddable: false, provider, reason: 'unsupported_provider' }
}
