/**
 * Seed investor-demo ranking data from existing members.
 * Invoked manually: npx tsx --env-file=.env.local scripts/seed-demo-rankings.ts
 * Glob: no prior seed-demo*.ts (only seed-league-geo.ts / create-admin.js).
 * Writes: events (DEMO:*), divisions, division_members, scores, division_results, ranking_points.
 * Dates: event_date as YYYY-MM-DD (e.g. 2026-03-15).
 * User: "yes" (seed demo rankings) / "create new contest if you need to"
 */
import { createClient } from '@supabase/supabase-js'
import { snapshotDivisionResults } from '../lib/rankings/standings'
import { finalizeEventPoints } from '../lib/rankings/finalize'

const DEMO_PREFIX = 'DEMO:'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: season, error: seasonErr } = await sb
    .from('seasons')
    .select('id, slug, points_table_id')
    .eq('is_active', true)
    .maybeSingle()

  if (seasonErr || !season) {
    throw new Error(
      `No active season. Apply migration 004. ${seasonErr?.message ?? ''}`
    )
  }

  const { data: categories } = await sb
    .from('play_categories')
    .select('id, code')
    .in('code', ['1A', '2A', '5A', 'AP'])

  const catByCode = new Map((categories ?? []).map((c) => [c.code, c.id]))
  if (!catByCode.get('1A')) {
    throw new Error('play_categories missing — apply migration 004')
  }

  const { data: tiers } = await sb.from('event_tiers').select('id, code, multiplier')
  const tierByCode = new Map((tiers ?? []).map((t) => [t.code, t]))

  const { data: countries } = await sb
    .from('geo_nodes')
    .select('id, iso_alpha2, path, name')
    .eq('level', 'country')

  const geoByIso = new Map(
    (countries ?? []).map((g) => [g.iso_alpha2?.toUpperCase(), g] as const)
  )

  let { data: players } = await sb
    .from('members')
    .select('id, full_name, nickname, country, role, gender, home_geo_id, public_id')
    .eq('is_active', true)
    .eq('role', 'member')
    .order('full_name')

  if (!players?.length) {
    const fallback = await sb
      .from('members')
      .select('id, full_name, nickname, country, role, gender, home_geo_id, public_id')
      .eq('is_active', true)
      .neq('role', 'admin')
      .order('full_name')
    players = fallback.data ?? []
  }

  if (!players.length) {
    throw new Error('No players found. Create members or run seed_sample_data.sql first.')
  }

  console.log(`Using ${players.length} players`)

  // Require scoring lock columns (migration 002)
  {
    const probe = await sb
      .from('divisions')
      .select('id, scoring_locked')
      .limit(1)
    if (probe.error && /scoring_locked/i.test(probe.error.message)) {
      throw new Error(
        `Missing divisions.scoring_locked. In Supabase SQL Editor run:\n\n` +
          `ALTER TABLE divisions ADD COLUMN IF NOT EXISTS scoring_locked BOOLEAN DEFAULT false;\n` +
          `ALTER TABLE divisions ADD COLUMN IF NOT EXISTS hide_scores_until_complete BOOLEAN DEFAULT false;\n\n` +
          `Then re-run this script.`
      )
    }
  }

  const nameToIso: Record<string, string> = {
    usa: 'US',
    'united states': 'US',
    japan: 'JP',
    malaysia: 'MY',
    singapore: 'SG',
    indonesia: 'ID',
    thailand: 'TH',
    philippines: 'PH',
    vietnam: 'VN',
    china: 'CN',
    taiwan: 'TW',
    'hong kong': 'HK',
    'south korea': 'KR',
    korea: 'KR',
    india: 'IN',
    france: 'FR',
    germany: 'DE',
    poland: 'PL',
    italy: 'IT',
    mexico: 'MX',
    uae: 'AE',
    'united arab emirates': 'AE',
    ireland: 'IE',
    australia: 'AU',
    brazil: 'BR',
    canada: 'CA',
    spain: 'ES',
    'united kingdom': 'GB',
    uk: 'GB',
  }

  const randGender = mulberry32(42)
  for (let i = 0; i < players.length; i++) {
    const p = players[i]
    const patch: Record<string, unknown> = {}
    if (!p.gender || p.gender === 'undisclosed') {
      patch.gender = randGender() < 0.35 ? 'female' : 'male'
    }
    if (!p.home_geo_id && p.country) {
      const iso =
        nameToIso[p.country.toLowerCase().trim()] ||
        (p.country.length === 2 ? p.country.toUpperCase() : null)
      const geo = iso ? geoByIso.get(iso) : null
      if (geo) patch.home_geo_id = geo.id
    }
    if (Object.keys(patch).length) {
      await sb.from('members').update(patch).eq('id', p.id)
      Object.assign(p, patch)
    }
  }

  const { data: oldEvents } = await sb
    .from('events')
    .select('id')
    .ilike('name', `${DEMO_PREFIX}%`)

  if (oldEvents?.length) {
    const ids = oldEvents.map((e) => e.id)
    await sb.from('ranking_points').delete().in('event_id', ids)
    await sb.from('events').delete().in('id', ids)
    console.log(`Removed ${ids.length} previous demo events`)
  }

  type ContestSpec = {
    name: string
    location: string
    date: string
    tier: string
    hostIso: string
    categories: {
      code: string
      round: 'qualifier' | 'semi_final' | 'final'
      eligibility: 'open' | 'women'
    }[]
    playerCount: number
  }

  const contests: ContestSpec[] = [
    {
      name: `${DEMO_PREFIX} KL Open 2026`,
      location: 'Kuala Lumpur, Malaysia',
      date: '2026-03-15',
      tier: 'NATIONAL',
      hostIso: 'MY',
      categories: [
        { code: '1A', round: 'qualifier', eligibility: 'open' },
        { code: '1A', round: 'final', eligibility: 'open' },
        { code: '2A', round: 'final', eligibility: 'open' },
      ],
      playerCount: Math.min(14, players.length),
    },
    {
      name: `${DEMO_PREFIX} SEA Invitational 2026`,
      location: 'Singapore',
      date: '2026-06-20',
      tier: 'REGIONAL',
      hostIso: 'SG',
      categories: [
        { code: '1A', round: 'semi_final', eligibility: 'open' },
        { code: '1A', round: 'final', eligibility: 'open' },
        { code: '5A', round: 'final', eligibility: 'open' },
        { code: '1A', round: 'final', eligibility: 'women' },
      ],
      playerCount: Math.min(12, players.length),
    },
    {
      name: `${DEMO_PREFIX} World Freestyle Cup 2026`,
      location: 'Tokyo, Japan',
      date: '2026-08-10',
      tier: 'WORLD',
      hostIso: 'JP',
      categories: [
        { code: '1A', round: 'qualifier', eligibility: 'open' },
        { code: '1A', round: 'semi_final', eligibility: 'open' },
        { code: '1A', round: 'final', eligibility: 'open' },
        { code: '2A', round: 'final', eligibility: 'open' },
        { code: '5A', round: 'final', eligibility: 'open' },
      ],
      playerCount: Math.min(16, players.length),
    },
  ]

  for (let ci = 0; ci < contests.length; ci++) {
    const c = contests[ci]
    const tier = tierByCode.get(c.tier)
    if (!tier) throw new Error(`Missing tier ${c.tier}`)
    const hostGeo = geoByIso.get(c.hostIso)

    const { data: event, error: eventErr } = await sb
      .from('events')
      .insert({
        name: c.name,
        description: 'Investor demo contest — seeded ranking points',
        location: c.location,
        event_date: c.date,
        status: 'active',
        season_id: season.id,
        tier_id: tier.id,
        geo_id: hostGeo?.id ?? null,
      })
      .select('id')
      .single()

    if (eventErr || !event) throw new Error(eventErr?.message || 'Event create failed')

    const offset = ci * 3
    const field = [...players]
      .slice(offset)
      .concat(players.slice(0, offset))
      .slice(0, c.playerCount)

    const women = field.filter((p) => p.gender === 'female')
    const openField = field

    for (let di = 0; di < c.categories.length; di++) {
      const divSpec = c.categories[di]
      const categoryId = catByCode.get(divSpec.code)
      if (!categoryId) continue

      const pool =
        divSpec.eligibility === 'women'
          ? women.length >= 3
            ? women
            : openField.slice(0, Math.min(6, openField.length))
          : openField

      const rng = mulberry32(1000 + ci * 100 + di)
      const shuffled = [...pool].sort(() => rng() - 0.5)
      const size =
        divSpec.round === 'final'
          ? Math.min(8, shuffled.length)
          : divSpec.round === 'semi_final'
            ? Math.min(12, shuffled.length)
            : shuffled.length
      const entrants = shuffled.slice(0, size)

      const { data: division, error: divErr } = await sb
        .from('divisions')
        .insert({
          event_id: event.id,
          name: `${divSpec.code} ${divSpec.round.replace('_', ' ')}${
            divSpec.eligibility === 'women' ? ' (Women)' : ''
          }`,
          scoring_type: 'standard',
          sort_order: di,
          is_active: true,
          round_type: divSpec.round,
          category_id: categoryId,
          eligibility: divSpec.eligibility,
        })
        .select('id')
        .single()

      if (divErr || !division) throw new Error(divErr?.message || 'Division create failed')

      const dmRows = entrants.map((p, idx) => ({
        division_id: division.id,
        member_id: p.id,
        play_order: idx + 1,
        status: 'completed',
      }))
      const { data: dms, error: dmErr } = await sb
        .from('division_members')
        .insert(dmRows)
        .select('id, member_id')
      if (dmErr) throw new Error(dmErr.message)

      const { data: admin } = await sb
        .from('members')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle()
      const judgeId = admin?.id || entrants[0].id

      await sb.from('division_judges').upsert(
        {
          division_id: division.id,
          member_id: judgeId,
          judge_type: 'head',
          scores_included_in_leaderboard: true,
        },
        { onConflict: 'division_id,member_id' }
      )

      const scoreRows = (dms ?? []).map((dm, idx) => {
        const base = 85 - idx * 2.4 + rng() * 1.5
        const total = Math.max(40, Math.round(base * 100) / 100)
        return {
          division_id: division.id,
          division_member_id: dm.id,
          judge_id: judgeId,
          ex_clicks: 50,
          ex_pv: 8,
          ex_ch: 8,
          ex_cons: 8,
          ex_space: 7,
          ex_body: 7,
          ex_showman: 7,
          ex_music: 7,
          ex_construct: 7,
          ex_trick_div: 7,
          ex_deductions: 0,
          technical_score: Math.round(total * 0.4 * 100) / 100,
          performance_score: Math.round(total * 0.6 * 100) / 100,
          total_score: total,
          is_submitted: true,
          submitted_at: new Date().toISOString(),
        }
      })
      const { error: scoreErr } = await sb.from('scores').insert(scoreRows)
      if (scoreErr) throw new Error(scoreErr.message)

      await sb.from('divisions').update({ scoring_locked: true }).eq('id', division.id)
      await snapshotDivisionResults(sb, division.id)
    }

    const result = await finalizeEventPoints(sb, event.id)
    if (!result.ok) {
      console.warn(`Finalize blockers for ${c.name}:`, result.blockers)
    } else {
      console.log(
        `✓ ${c.name} — ${result.awardsWritten} awards (×${tier.multiplier} ${c.tier})`
      )
    }
  }

  const { count } = await sb
    .from('ranking_points')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', season.id)

  const females = players.filter((p) => p.gender === 'female').length

  console.log(`\nDone. Season ${season.slug}: ${count ?? 0} ranking_points rows.`)
  console.log(`Players marked female for Women board: ${females}`)
  console.log('Open /rankings — try 1A, Women, and region filters.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
