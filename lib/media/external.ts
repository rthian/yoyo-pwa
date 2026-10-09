/**
 * Prompt 13: external media URL helpers.
 * Embeds: lib/media/embed.ts + components/media/MediaEmbed.tsx (Prompt 14–15).
 * Callers: media API, EventMediaPanel, MediaEmbed.
 */

export type ExternalMediaKind =
  | 'livestream'
  | 'highlight'
  | 'routine'
  | 'photo_album'
  | 'other'

export type ExternalMediaProvider =
  | 'youtube'
  | 'vimeo'
  | 'twitch'
  | 'instagram'
  | 'other'

export const EXTERNAL_MEDIA_KINDS: ExternalMediaKind[] = [
  'livestream',
  'highlight',
  'routine',
  'photo_album',
  'other',
]

export function detectMediaProvider(url: string): ExternalMediaProvider {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtu.be' ||
      host === 'youtube-nocookie.com'
    ) {
      return 'youtube'
    }
    if (host === 'vimeo.com' || host.endsWith('.vimeo.com')) return 'vimeo'
    if (host === 'twitch.tv' || host.endsWith('.twitch.tv')) return 'twitch'
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
      return 'instagram'
    }
    return 'other'
  } catch {
    return 'other'
  }
}

export function normalizeExternalMediaUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const u = new URL(trimmed)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

export function providerLabel(provider: ExternalMediaProvider): string {
  switch (provider) {
    case 'youtube':
      return 'YouTube'
    case 'vimeo':
      return 'Vimeo'
    case 'twitch':
      return 'Twitch'
    case 'instagram':
      return 'Instagram'
    default:
      return 'Link'
  }
}

export function kindLabel(kind: ExternalMediaKind): string {
  switch (kind) {
    case 'livestream':
      return 'Livestream'
    case 'highlight':
      return 'Highlight'
    case 'routine':
      return 'Routine'
    case 'photo_album':
      return 'Photos'
    default:
      return 'Media'
  }
}
