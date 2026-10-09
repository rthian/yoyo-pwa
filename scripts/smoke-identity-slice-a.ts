/**
 * Smoke-check Slice A identity tables + helpers.
 * Requires migration 011 applied.
 * Run: npx tsx --env-file=.env.local scripts/smoke-identity-slice-a.ts
 */
import { createAdminClient } from '../lib/supabase/admin'
import {
  assertManagesCompetitor,
  ensureSelfCompetitorForMember,
  getManagedCompetitors,
} from '../lib/identity/competitors'
import { generateLeagueId } from '../lib/rankings/league-id'

async function main() {
  const sb = createAdminClient()

  const checks: { name: string; ok: boolean; detail?: unknown }[] = []

  const { error: tableErr } = await sb.from('competitors').select('id').limit(1)
  if (tableErr) {
    console.error(
      'competitors table missing. Apply supabase/migrations/011_competitors_identity.sql first.\n',
      tableErr.message
    )
    process.exit(1)
  }
  checks.push({
    name: 'competitors_table',
    ok: true,
    detail: 'ok',
  })

  const { error: linkErr } = await sb.from('account_competitor_links').select('id').limit(1)
  checks.push({
    name: 'account_competitor_links_table',
    ok: !linkErr,
    detail: linkErr?.message || 'ok',
  })

  const { count: rpCount } = await sb
    .from('ranking_points')
    .select('*', { count: 'exact', head: true })

  if ((rpCount ?? 0) > 0) {
    // Callers: npx tsx scripts/smoke-identity-slice-a.ts. Glob: existing file.
    // Sample: { competitor_id: "comp_demo" }. User: "next"
    const { data: sample } = await sb
      .from('ranking_points')
      .select('competitor_id')
      .limit(20)
    const competitorIds = [
      ...new Set((sample ?? []).map((r) => r.competitor_id).filter(Boolean)),
    ]
    checks.push({
      name: 'backfill_ranking_points_sample',
      ok: competitorIds.length === (sample ?? []).length,
      detail: {
        sampled: (sample ?? []).length,
        withCompetitor: competitorIds.length,
      },
    })
  } else {
    checks.push({
      name: 'backfill_ranking_points_sample',
      ok: true,
      detail: 'no ranking_points rows — skipped',
    })
  }

  const stamp = Date.now()
  const email = `identity-smoke-${stamp}@example.com`
  const publicId = generateLeagueId()

  const { data: authData, error: authError } = await sb.auth.admin.createUser({
    email,
    password: `Smoke-${stamp}-Aa1`,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    checks.push({ name: 'create_temp_user', ok: false, detail: authError?.message })
  } else {
    const userId = authData.user.id
    const { error: memErr } = await sb.from('members').insert({
      id: userId,
      email,
      full_name: 'Identity Smoke',
      role: 'member',
      is_active: true,
      public_id: publicId,
    })
    checks.push({ name: 'create_temp_member', ok: !memErr, detail: memErr?.message })

    if (!memErr) {
      const ensured = await ensureSelfCompetitorForMember(
        sb,
        { id: userId, full_name: 'Identity Smoke', public_id: publicId },
        { publicId }
      )
      checks.push({
        name: 'ensure_self_competitor',
        ok: Boolean(ensured.competitor?.id && ensured.link?.relationship === 'self'),
        detail: { competitorId: ensured.competitor.id, created: ensured.created },
      })

      const again = await ensureSelfCompetitorForMember(
        sb,
        { id: userId, full_name: 'Identity Smoke', public_id: publicId },
        { publicId }
      )
      checks.push({
        name: 'ensure_self_idempotent',
        ok: again.created === false && again.competitor.id === ensured.competitor.id,
      })

      const managed = await getManagedCompetitors(sb, userId)
      checks.push({
        name: 'get_managed_competitors',
        ok: managed.length === 1 && managed[0]?.id === ensured.competitor.id,
        detail: { count: managed.length },
      })

      await assertManagesCompetitor(sb, userId, ensured.competitor.id, 'register')
      checks.push({ name: 'assert_manages_register', ok: true })

      let denied = false
      try {
        await assertManagesCompetitor(sb, userId, '00000000-0000-0000-0000-000000000000', 'any')
      } catch {
        denied = true
      }
      checks.push({ name: 'assert_forged_competitor_denied', ok: denied })
    }

    await sb.from('account_competitor_links').delete().eq('account_id', userId)
    await sb.from('competitors').delete().eq('source_member_id', userId)
    await sb.from('members').delete().eq('id', userId)
    await sb.auth.admin.deleteUser(userId)
    checks.push({ name: 'cleanup_temp_user', ok: true })
  }

  console.log(JSON.stringify({ checks }, null, 2))
  if (checks.some((c) => !c.ok)) process.exit(1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
