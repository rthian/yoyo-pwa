/**
 * Smoke-check Prompt 3 Slice 1 event staff roles + helpers.
 * Requires migration 012 applied.
 * Run: npx tsx --env-file=.env.local scripts/smoke-event-staff-roles.ts
 */
import { createAdminClient } from '../lib/supabase/admin'
import {
  canLockDivisionScores,
  EVENT_CAPABILITY_ROLES,
  getActiveEventRoles,
  grantEventRole,
  hasEventCapability,
  listEventStaff,
  revokeEventRole,
} from '../lib/auth/event-permissions'

async function main() {
  const sb = createAdminClient()
  const checks: { name: string; ok: boolean; detail?: unknown }[] = []

  const { error: tableErr } = await sb.from('event_staff_roles').select('id').limit(1)
  if (tableErr) {
    console.error(
      'event_staff_roles missing. Apply supabase/migrations/012_event_staff_roles.sql first.\n',
      tableErr.message
    )
    process.exit(1)
  }
  checks.push({ name: 'event_staff_roles_table', ok: true, detail: 'ok' })

  const { error: auditErr } = await sb.from('event_staff_role_audit').select('id').limit(1)
  checks.push({
    name: 'event_staff_role_audit_table',
    ok: !auditErr,
    detail: auditErr?.message || 'ok',
  })

  const { data: eventsWithCreator } = await sb
    .from('events')
    .select('id, created_by')
    .not('created_by', 'is', null)
    .limit(20)

  let backfillMissing = 0
  for (const e of eventsWithCreator ?? []) {
    if (!e.created_by) continue
    const roles = await getActiveEventRoles(sb, e.created_by, e.id)
    if (!roles.includes('owner')) backfillMissing += 1
  }
  checks.push({
    name: 'owner_backfill_sample',
    ok: backfillMissing === 0,
    detail: {
      sampled: eventsWithCreator?.length ?? 0,
      missingOwner: backfillMissing,
    },
  })

  const { data: admin } = await sb
    .from('members')
    .select('id')
    .eq('role', 'admin')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  const { data: event } = await sb.from('events').select('id').limit(1).maybeSingle()

  if (!admin?.id || !event?.id) {
    checks.push({
      name: 'grant_revoke_skipped',
      ok: true,
      detail: 'no admin or event to exercise grant/revoke',
    })
  } else {
    const { data: member } = await sb
      .from('members')
      .select('id')
      .neq('id', admin.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (!member?.id) {
      checks.push({
        name: 'grant_revoke_skipped',
        ok: true,
        detail: 'no second member for grant target',
      })
    } else {
      const granted = await grantEventRole(sb, {
        eventId: event.id,
        accountId: member.id,
        role: 'readonly_staff',
        actorId: admin.id,
        note: 'smoke-event-staff-roles',
      })
      checks.push({
        name: 'grant_readonly',
        ok: granted.role === 'readonly_staff' && !granted.revoked_at,
        detail: granted.id,
      })

      const canView = await hasEventCapability(
        sb,
        member.id,
        event.id,
        'view_ops'
      )
      const canManage = await hasEventCapability(
        sb,
        member.id,
        event.id,
        'manage_event'
      )
      checks.push({
        name: 'readonly_view_ops',
        ok: canView === true,
        detail: canView,
      })
      checks.push({
        name: 'readonly_denied_manage_event',
        ok: canManage === false,
        detail: canManage,
      })

      const staff = await listEventStaff(sb, event.id)
      checks.push({
        name: 'list_includes_grant',
        ok: staff.some(
          (r) => r.account_id === member.id && r.role === 'readonly_staff'
        ),
      })

      const revoked = await revokeEventRole(sb, {
        eventId: event.id,
        accountId: member.id,
        role: 'readonly_staff',
        actorId: admin.id,
        note: 'smoke-event-staff-roles cleanup',
      })
      checks.push({
        name: 'revoke_readonly',
        ok: Boolean(revoked?.revoked_at),
        detail: revoked?.revoked_at,
      })

      const after = await hasEventCapability(sb, member.id, event.id, 'view_ops')
      // May still be true if they hold another role / are admin — only assert if no other roles
      const remaining = await getActiveEventRoles(sb, member.id, event.id)
      checks.push({
        name: 'revoke_clears_view_ops_when_alone',
        ok: remaining.length > 0 ? true : after === false,
        detail: { after, remaining },
      })
    }

    const adminCanUnfinalize = await hasEventCapability(
      sb,
      admin.id,
      event.id,
      'unfinalize_results'
    )
    checks.push({
      name: 'admin_unfinalize',
      ok: adminCanUnfinalize === true,
      detail: adminCanUnfinalize,
    })

    const { data: division } = await sb
      .from('divisions')
      .select('id, event_id')
      .eq('event_id', event.id)
      .limit(1)
      .maybeSingle()

    if (division) {
      const lock = await canLockDivisionScores(
        sb,
        admin.id,
        division.event_id,
        division.id
      )
      checks.push({
        name: 'admin_can_lock_division',
        ok: lock === true,
        detail: lock,
      })
    }
  }

  checks.push({
    name: 'capability_map_nonempty',
    ok: Object.keys(EVENT_CAPABILITY_ROLES).length >= 10,
    detail: Object.keys(EVENT_CAPABILITY_ROLES).length,
  })

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
