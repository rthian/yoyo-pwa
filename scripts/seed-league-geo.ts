/**
 * Seed geo country nodes + backfill members.home_geo_id.
 * Invoked manually: npx tsx scripts/seed-league-geo.ts (not imported by app).
 * Only scripts/create-admin.js exists under scripts/ (Glob).
 * Writes geo_nodes { level, code, name, iso_alpha2, path }; dates via created_at default.
 * User: create a branch… plan & build a ranking with point system league leaderboards…
 */
import { createClient } from '@supabase/supabase-js'

const COUNTRIES: { name: string; iso: string; region: string }[] = [
  { name: 'Malaysia', iso: 'MY', region: 'SEA' },
  { name: 'Singapore', iso: 'SG', region: 'SEA' },
  { name: 'Indonesia', iso: 'ID', region: 'SEA' },
  { name: 'Thailand', iso: 'TH', region: 'SEA' },
  { name: 'Philippines', iso: 'PH', region: 'SEA' },
  { name: 'Vietnam', iso: 'VN', region: 'SEA' },
  { name: 'Japan', iso: 'JP', region: 'ASIA' },
  { name: 'South Korea', iso: 'KR', region: 'ASIA' },
  { name: 'China', iso: 'CN', region: 'ASIA' },
  { name: 'Taiwan', iso: 'TW', region: 'ASIA' },
  { name: 'Hong Kong', iso: 'HK', region: 'ASIA' },
  { name: 'India', iso: 'IN', region: 'ASIA' },
  { name: 'United States', iso: 'US', region: 'NA' },
  { name: 'Canada', iso: 'CA', region: 'NA' },
  { name: 'Mexico', iso: 'MX', region: 'NA' },
  { name: 'Brazil', iso: 'BR', region: 'SA' },
  { name: 'Argentina', iso: 'AR', region: 'SA' },
  { name: 'United Kingdom', iso: 'GB', region: 'EU' },
  { name: 'France', iso: 'FR', region: 'EU' },
  { name: 'Germany', iso: 'DE', region: 'EU' },
  { name: 'Spain', iso: 'ES', region: 'EU' },
  { name: 'Italy', iso: 'IT', region: 'EU' },
  { name: 'Netherlands', iso: 'NL', region: 'EU' },
  { name: 'Poland', iso: 'PL', region: 'EU' },
  { name: 'Australia', iso: 'AU', region: 'OC' },
  { name: 'New Zealand', iso: 'NZ', region: 'OC' },
  { name: 'United Arab Emirates', iso: 'AE', region: 'ME' },
  { name: 'South Africa', iso: 'ZA', region: 'AF' },
]

const STATES: { countryIso: string; code: string; name: string }[] = [
  { countryIso: 'MY', code: 'MY-14', name: 'Kuala Lumpur' },
  { countryIso: 'MY', code: 'MY-10', name: 'Selangor' },
  { countryIso: 'MY', code: 'MY-01', name: 'Johor' },
  { countryIso: 'MY', code: 'MY-07', name: 'Penang' },
  { countryIso: 'US', code: 'US-CA', name: 'California' },
  { countryIso: 'US', code: 'US-NY', name: 'New York' },
  { countryIso: 'US', code: 'US-TX', name: 'Texas' },
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: regions, error: regionErr } = await supabase
    .from('geo_nodes')
    .select('id, code')
    .eq('level', 'region')

  if (regionErr) throw regionErr
  const regionByCode = new Map((regions ?? []).map((r) => [r.code, r.id]))

  for (const c of COUNTRIES) {
    const parentId = regionByCode.get(c.region)
    if (!parentId) {
      console.warn(`Skip ${c.iso}: region ${c.region} missing`)
      continue
    }
    const { error } = await supabase.from('geo_nodes').upsert(
      {
        parent_id: parentId,
        level: 'country',
        code: c.iso,
        name: c.name,
        iso_alpha2: c.iso,
        path: `/WORLD/${c.region}/${c.iso}`,
        sort_order: 0,
      },
      { onConflict: 'path' }
    )
    if (error) console.error(c.iso, error.message)
  }

  const { data: countries } = await supabase
    .from('geo_nodes')
    .select('id, iso_alpha2, path')
    .eq('level', 'country')

  const countryByIso = new Map(
    (countries ?? []).map((c) => [c.iso_alpha2, c] as const)
  )

  for (const s of STATES) {
    const parent = countryByIso.get(s.countryIso)
    if (!parent) continue
    const { error } = await supabase.from('geo_nodes').upsert(
      {
        parent_id: parent.id,
        level: 'state',
        code: s.code,
        name: s.name,
        iso_alpha2: null,
        path: `${parent.path}/${s.code}`,
        sort_order: 0,
      },
      { onConflict: 'path' }
    )
    if (error) console.error(s.code, error.message)
  }

  const { data: members } = await supabase
    .from('members')
    .select('id, country, home_geo_id')
    .is('home_geo_id', null)
    .not('country', 'is', null)

  const nameToIso: Record<string, string> = Object.fromEntries(
    COUNTRIES.map((c) => [c.name.toLowerCase(), c.iso])
  )

  let updated = 0
  for (const m of members ?? []) {
    const iso =
      nameToIso[(m.country ?? '').toLowerCase().trim()] ||
      ((m.country ?? '').length === 2 ? (m.country ?? '').toUpperCase() : null)
    if (!iso) continue
    const node = countryByIso.get(iso)
    if (!node) continue
    const { error } = await supabase
      .from('members')
      .update({ home_geo_id: node.id })
      .eq('id', m.id)
    if (!error) updated++
  }

  console.log(`Seeded countries/states. Backfilled home_geo_id on ${updated} members.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
