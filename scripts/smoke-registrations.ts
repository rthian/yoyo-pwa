/**
 * Smoke-check Prompt 5 registration aggregate.
 * Requires migrations 011–014.
 * Run: npx tsx --env-file=.env.local scripts/smoke-registrations.ts
 */
import { createAdminClient } from '../lib/supabase/admin'
import {
  cancelRegistration,
  getOrCreateRegistration,
  addRegistrationEntry,
  submitRegistration,
} from '../lib/registration/service'
import { ensureSelfCompetitorForMember } from '../lib/identity/competitors'
import { generateLeagueId } from '../lib/rankings/league-id'

async function main() {
  const sb = createAdminClient()
  const checks: { name: string; ok: boolean; detail?: unknown }[] = []

  const { error: tableErr } = await sb.from('registrations').select('id').limit(1)
  if (tableErr) {
    console.error(
      'registrations missing. Apply supabase/migrations/014_registrations.sql first.\n',
      tableErr.message
    )
    process.exit(1)
  }
  checks.push({ name: 'registrations_table', ok: true })

  const { data: event } = await sb.from('events').select('id, status').limit(1).maybeSingle()
  const { data: admin } = await sb
    .from('members')
    .select('id, full_name, nickname, country, public_id, is_active, role')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (!event || !admin) {
    checks.push({ name: 'skipped_live_flow', ok: true, detail: 'no event/admin' })
  } else {
    // Ensure published for window helper (admin bypass still used)
    const { data: division, error: divErr } = await sb
      .from('divisions')
      .insert({
        event_id: event.id,
        name: `SMOKE-REG-${Date.now()}`,
        scoring_type: 'standard',
        sort_order: 9999,
        is_active: true,
        capacity: 1,
        waitlist_enabled: true,
      })
      .select('*')
      .single()

    checks.push({
      name: 'create_capacity_division',
      ok: !divErr && Boolean(division),
      detail: divErr?.message || division?.id,
    })

    if (division) {
      const a = await ensureSelfCompetitorForMember(sb, {
        ...admin,
        public_id: admin.public_id || generateLeagueId(),
      })

      // Second synthetic competitor (no auth user) — insert competitor only + manager link
      const { data: competitorB, error: bErr } = await sb
        .from('competitors')
        .insert({
          full_name: 'Smoke Waitlist Competitor',
          public_id: generateLeagueId(),
          profile_visibility: 'private',
        })
        .select('*')
        .single()

      checks.push({
        name: 'create_second_competitor',
        ok: !bErr && Boolean(competitorB),
        detail: bErr?.message,
      })

      if (competitorB) {
        await sb.from('account_competitor_links').insert({
          account_id: admin.id,
          competitor_id: competitorB.id,
          relationship: 'manager',
          can_register: true,
          can_manage_music: false,
          can_manage_profile: false,
          granted_by: admin.id,
        })

        const regA = await getOrCreateRegistration(sb, {
          eventId: event.id,
          competitorId: a.competitor.id,
          accountId: admin.id,
          isAdmin: true,
        })
        await addRegistrationEntry(sb, {
          registrationId: regA.id,
          divisionId: division.id,
          accountId: admin.id,
        })
        const subA = await submitRegistration(sb, {
          registrationId: regA.id,
          accountId: admin.id,
          isAdmin: true,
        })
        const entryA = subA.entries.find((e) => e.division_id === division.id)
        checks.push({
          name: 'first_gets_confirmed',
          ok: entryA?.status === 'confirmed',
          detail: entryA?.status,
        })

        const regB = await getOrCreateRegistration(sb, {
          eventId: event.id,
          competitorId: competitorB.id,
          accountId: admin.id,
          isAdmin: true,
        })
        await addRegistrationEntry(sb, {
          registrationId: regB.id,
          divisionId: division.id,
          accountId: admin.id,
        })
        const subB = await submitRegistration(sb, {
          registrationId: regB.id,
          accountId: admin.id,
          isAdmin: true,
        })
        const entryB = subB.entries.find((e) => e.division_id === division.id)
        checks.push({
          name: 'second_gets_waitlisted',
          ok: entryB?.status === 'waitlisted',
          detail: entryB,
        })

        // Duplicate registration same competitor+event should reuse
        const again = await getOrCreateRegistration(sb, {
          eventId: event.id,
          competitorId: a.competitor.id,
          accountId: admin.id,
          isAdmin: true,
        })
        checks.push({
          name: 'duplicate_event_competitor_reuses',
          ok: again.id === regA.id,
          detail: { again: again.id, first: regA.id },
        })

        await cancelRegistration(sb, {
          registrationId: regA.id,
          accountId: admin.id,
          reason: 'smoke cleanup',
          isAdmin: true,
        })
        await cancelRegistration(sb, {
          registrationId: regB.id,
          accountId: admin.id,
          reason: 'smoke cleanup',
          isAdmin: true,
        })

        await sb.from('account_competitor_links').delete().eq('competitor_id', competitorB.id)
        await sb.from('competitors').delete().eq('id', competitorB.id)
      }

      await sb.from('divisions').delete().eq('id', division.id)
    }
  }

  const failed = checks.filter((c) => !c.ok)
  for (const c of checks) {
    console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.name}`, c.detail ?? '')
  }
  if (failed.length) {
    console.error(`\n${failed.length} check(s) failed`)
    process.exit(1)
  }
  console.log(`\nAll ${checks.length} checks passed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
