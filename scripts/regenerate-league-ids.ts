/**
 * Regenerate all member League IDs to opaque 8-char Crockford codes (no brand/year/name).
 * Run: npx tsx --env-file=.env.local scripts/regenerate-league-ids.ts
 * Callers: manual CLI. Glob: scripts/regenerate-league-ids.ts exists (overwrite).
 * Writes members.public_id e.g. ZX905JYC. User: no brand; scale 10000+ internationally
 */
import { createClient } from '@supabase/supabase-js'
import { formatLeagueId, generateLeagueId } from '../lib/rankings/league-id'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env')

  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: members, error } = await sb
    .from('members')
    .select('id, public_id, full_name')
  if (error) throw new Error(error.message)
  if (!members?.length) {
    console.log('No members')
    return
  }

  const used = new Set<string>()
  let updated = 0

  for (const m of members) {
    let id = generateLeagueId()
    let guard = 0
    while (used.has(id) && guard++ < 40) id = generateLeagueId()
    used.add(id)

    const { error: upErr } = await sb
      .from('members')
      .update({ public_id: id })
      .eq('id', m.id)

    if (upErr) {
      console.error(m.full_name, upErr.message)
      continue
    }
    updated++
    console.log(`${m.full_name}: ${m.public_id ?? '(none)'} → ${formatLeagueId(id)}`)
  }

  console.log(`\nUpdated ${updated}/${members.length} League IDs (8-char opaque).`)
  console.log('Capacity: 32^8 ≈ 1.1 trillion codes — fine for 10k–1M+ players.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
