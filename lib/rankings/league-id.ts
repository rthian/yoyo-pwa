/**
 * Opaque League ID — no brand/year/name.
 * Format: 8 Crockford chars (32^8 ≈ 1.1e12) — scales past 10k international players.
 * Optional display grouping: XXXX-XXXX
 * Callers: scripts/regenerate-league-ids.ts, signup
 * User: no brand; scale internationally 10000+ players
 */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const LENGTH = 8

export function generateLeagueId(randomBytes?: Uint8Array): string {
  const bytes = randomBytes ?? crypto.getRandomValues(new Uint8Array(LENGTH))
  let id = ''
  for (let i = 0; i < LENGTH; i++) {
    id += CROCKFORD[bytes[i]! % CROCKFORD.length]
  }
  return id
}

/** Display with mid hyphen for readability: ABCD-EFGH */
export function formatLeagueId(id: string): string {
  const n = normalizeLeagueId(id)
  if (n.length === LENGTH) return `${n.slice(0, 4)}-${n.slice(4)}`
  return n
}

export function isValidLeagueId(id: string): boolean {
  const n = normalizeLeagueId(id)
  return new RegExp(`^[0-9A-HJKMNP-TV-Z]{${LENGTH}}$`, 'i').test(n)
}

export function normalizeLeagueId(id: string): string {
  return id.trim().toUpperCase().replace(/[-\s]/g, '')
}
