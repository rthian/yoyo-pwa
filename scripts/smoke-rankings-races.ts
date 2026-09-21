/**
 * Smoke test: race boards, tiers, field_scope schema.
 * Run: npx tsx scripts/smoke-rankings-races.ts
 */
import { createAdminClient } from '../lib/supabase/admin'
import { getLeagueRankings } from '../lib/rankings/query'

type Check = { name: string; ok: boolean; detail: unknown }

async function main() {
  const sb = createAdminClient()
  const seasonId = '00000000-0000-4000-8000-000000000200'
  const checks: Check[] = []

  const { data: tiers, error: te } = await sb
    .from('event_tiers')
    .select('code,multiplier,counts_for_world_race,counts_for_national_race')
    .order('sort_order')
  const expected: Record<string, [number, boolean, boolean]> = {
    LOCAL: [0.5, false, false],
    STATE: [1, false, false],
    REGIONAL: [2, false, true],
    NATIONAL: [3, true, true],
    CONTINENTAL: [4, true, false],
    WORLD: [5, true, false],
  }
  let tiersOk = !te
  for (const [code, [mult, world, nat]] of Object.entries(expected)) {
    const t = tiers?.find((x) => x.code === code)
    if (
      !t ||
      Number(t.multiplier) !== mult ||
      t.counts_for_world_race !== world ||
      t.counts_for_national_race !== nat
    ) {
      tiersOk = false
    }
  }
  checks.push({ name: 'tiers_match_design', ok: !!tiersOk, detail: te?.message || tiers })

  const { error: ce } = await sb.from('ranking_points').select('id,field_scope').limit(1)
  checks.push({ name: 'ranking_points.field_scope_column', ok: !ce, detail: ce?.message || 'ok' })

  const { data: divs, error: de } = await sb.from('divisions').select('id,field_scope').limit(10)
  checks.push({
    name: 'divisions.field_scope_column',
    ok: !de,
    detail: de?.message || [...new Set((divs ?? []).map((d) => d.field_scope))],
  })

  const { data: season } = await sb.from('seasons').select('counting_results').eq('id', seasonId).single()
  checks.push({ name: 'counting_results_is_6', ok: season?.counting_results === 6, detail: season })

  const world = await getLeagueRankings(sb, { seasonId, worldRaceOnly: true, countingResults: 6, limit: 200 })
  const national = await getLeagueRankings(sb, { seasonId, nationalRaceOnly: true, countingResults: 6, limit: 200 })
  checks.push({
    name: 'race_boards_load',
    ok: world.total >= 0 && national.total >= 0,
    detail: { worldTotal: world.total, nationalTotal: national.total },
  })

  const { count: champCount } = await sb
    .from('ranking_points')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', seasonId)
    .eq('field_scope', 'championship')
  const { count: inviteCount } = await sb
    .from('ranking_points')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', seasonId)
    .eq('field_scope', 'invitational')
  checks.push({
    name: 'field_scope_row_counts',
    ok: true,
    detail: { championship: champCount, invitational: inviteCount },
  })

  const { data: anyMember } = await sb.from('members').select('id').limit(1).maybeSingle()
  const { data: cat } = await sb.from('play_categories').select('id').eq('code', '1A').maybeSingle()
  const { data: anyEvent } = await sb
    .from('events')
    .select('id, tier_id')
    .eq('season_id', seasonId)
    .limit(1)
    .maybeSingle()

  if (anyMember && cat && anyEvent) {
    const { data: inserted, error: insErr } = await sb
      .from('ranking_points')
      .insert({
        season_id: seasonId,
        event_id: anyEvent.id,
        category_id: cat.id,
        member_id: anyMember.id,
        round_type: 'final',
        placement: 1,
        field_size: 1,
        base_points: 9999,
        bonus_points: 0,
        multiplier: 1,
        points: 9999,
        eligibility: 'open',
        field_scope: 'invitational',
        notes: `smoke-invite-${Date.now()}`,
      })
      .select('id')
      .maybeSingle()

    if (insErr || !inserted) {
      checks.push({ name: 'invite_insert', ok: false, detail: insErr?.message || 'insert failed' })
    } else {
      const beforeNat = national.total
      const afterNat = await getLeagueRankings(sb, {
        seasonId,
        nationalRaceOnly: true,
        countingResults: 6,
        limit: 500,
      })
      const eventBoard = await getLeagueRankings(sb, {
        seasonId,
        countingResults: 6,
        eventIds: [anyEvent.id],
        limit: 500,
      })
      const inNational = afterNat.entries.some(
        (e) => e.memberId === anyMember.id && e.totalPoints >= 9999
      )
      const inEventBoard = eventBoard.entries.some((e) => e.memberId === anyMember.id)

      checks.push({
        name: 'invite_excluded_from_national_race',
        ok: !inNational && afterNat.total === beforeNat,
        detail: { inNational, beforeNat, afterNat: afterNat.total, inEventBoard },
      })
      checks.push({
        name: 'invite_visible_without_national_filter',
        ok: inEventBoard,
        detail: { inEventBoard },
      })

      await sb.from('ranking_points').delete().eq('id', inserted.id)
      checks.push({ name: 'invite_cleanup', ok: true, detail: inserted.id })
    }
  } else {
    checks.push({ name: 'invite_exclusion_test', ok: false, detail: 'Missing fixtures' })
  }

  const worldHttp = await fetch(
    'http://localhost:3000/api/rankings?season=2026&race=world&category=1A&limit=3'
  ).then((r) => r.json())
  const natHttp = await fetch(
    'http://localhost:3000/api/rankings?season=2026&race=national&category=1A&limit=3'
  ).then((r) => r.json())
  checks.push({
    name: 'http_race_param',
    ok:
      worldHttp.filters?.race === 'world' &&
      natHttp.filters?.race === 'national' &&
      Array.isArray(worldHttp.entries),
    detail: { worldTotal: worldHttp.total, nationalTotal: natHttp.total, world: worldHttp.filters, national: natHttp.filters },
  })

  const hitw = await fetch('http://localhost:3000/rankings/how-it-works').then((r) => r.text())
  checks.push({
    name: 'howitworks_copy',
    ok:
      /Championship vs invitational/i.test(hitw) &&
      /National Race/i.test(hitw) &&
      /Custom Leagues/i.test(hitw),
    detail: hitw.match(/best[^.<]{0,40}/i)?.[0],
  })

  const failed = checks.filter((c) => !c.ok)
  console.log(JSON.stringify({ passed: checks.length - failed.length, failed: failed.length, checks }, null, 2))
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
