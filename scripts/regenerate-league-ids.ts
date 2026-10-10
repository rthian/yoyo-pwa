/**
 * Regenerate League IDs on competitors (Slice E).
 * Run: npx tsx --env-file=.env.local scripts/regenerate-league-ids.ts
 * GateGuard: callers manual CLI; Glob existing script; sample public_id ZX905JYC; User: "next"
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

  const { data: competitors, error } = await sb
    .from('competitors')
    .select('id, public_id, full_name')
  if (error) throw new Error(error.message)
  if (!competitors?.length) {
    console.log('No competitors')
    return
  }

  const used = new Set<string>()
  let updated = 0

  for (const c of competitors) {
    let id = generateLeagueId()
    let guard = 0
    while (used.has(id) && guard++ < 40) id = generateLeagueId()
    used.add(id)

    const { error: upErr } = await sb
      .from('competitors')
      .update({ public_id: id })
      .eq('id', c.id)

    if (upErr) {
      console.error(c.full_name, upErr.message)
      continue
    }
    updated++
    console.log(`${c.full_name}: ${c.public_id ?? '(none)'} → ${formatLeagueId(id)}`)
  }

  console.log(`\nUpdated ${updated}/${competitors.length} League IDs on competitors.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
