# Prompts 17+ — Product playbook

**Status:** Planning (post–Prompt 16 on `main`, identity through `025`)  
**Payments:** Manual QR + receipt verification (**20**); Stripe deferred.

---

## Sequence overview

| Prompt | Title | Migration |
|--------|--------|-----------|
| **17** | Guardian & multi-competitor accounts | Optional (invites) |
| **18** | Track advancement ops (UI + `apply`) | — |
| **19** | Organize event lifecycle (finalize, cancel, APIs) | — |
| **20** | QR payment publish + receipt upload + staff verify | `026` |
| **21** | Member event discovery & hub polish | Optional |
| **22** | **Event comms & notifications** | `027` |
| **23** | Platform hygiene & test harness | — |

**Suggested build order:** `17 → 20 → 22` (money + reminders), then `19`, `18`, `21`, `23`.

---

## Prompt 17 — Guardian & multi-competitor accounts

- Member UI: manage `account_competitor_links` (`self`, `guardian`, `manager`, `coach`) and capability flags.
- APIs: create competitor + link; revoke with audit (`granted_by`).
- Registration & music: competitor selector; `assertManagesCompetitor` enforced in UI and API.
- **Acceptance:** Parent registers and pays (20) / uploads music for a child competitor.

---

## Prompt 18 — Track advancement ops

- `/organize` (+ admin): advancement decisions from `PATCH /api/events/[id]/tracks` (`advancement_decision`, `apply: true`).
- History from `advancement_decisions`; capacity warnings before apply.
- **Acceptance:** Qualifier → Semi seats in `division_members` only after explicit apply.

---

## Prompt 19 — Organize event lifecycle

- `FinalizeEventPanel` on `/organize` when `finalize_results`.
- Capability-gated `/api/events/[id]/finalize` (not admin-only path).
- Optional `cancel_event` for owners; `delete_event` remains owner/admin.
- **Acceptance:** Event owner finalizes without global `admin` role.

---

## Prompt 20 — QR payments & receipt upload

**Not Stripe.** Regional QR (image or payload → rendered QR) + private receipt uploads + staff approval.

### Organizer
- Event fields: `payment_required`, fee amount/currency, instructions, QR asset or payload.
- Show on public hub and member registration flow.

### Registrant
- `payment_status`: `unpaid` → upload receipt → `pending` → staff → `paid` / back to `unpaid` with reason.
- Private bucket `registration-receipts`; versioned rows; `registration_audit_events`.

### Staff (`/organize` registrations)
- Queue pending receipts; approve/reject; optional **require paid before** `confirm_or_waitlist`.

### Migration `026` (sketch)
- Extend `events` payment config columns.
- `registration_receipts` (+ storage policies).

---

## Prompt 21 — Member event discovery & hub polish

- Event detail for members: registration window, fees (20), music deadlines, hub links.
- Competitor context (17) across browse → register → pay → music.
- Prep checklist UI (same data **22** uses for emails).

---

## Prompt 22 — Event comms & notifications

**Scope:** Automated reminders, event countdown prep, organizer blasts, and results/rankings digests. Email MVP; in-app bell phase 2.

### Design principles

- **Automated** = system schedules (idempotent outbox).
- **Blasts** = staff-initiated, segmented, audited; human confirms send.
- **Live scoring** = in-app Realtime first; email for **digests** and **milestones**, not per-score spam.
- **Human-in-the-loop** for payment approval; AI may **suggest** only.
- Per-category **opt-out** on member settings (replace admin “Coming Soon” placeholders).

### Message types (`comms_outbox.type`)

| Type | Trigger | Audience |
|------|---------|----------|
| `payment_unpaid` | Registration needs payment | Registrant / guardian |
| `payment_pending_ack` | Receipt uploaded | Registrant |
| `payment_pending_staff` | Receipt uploaded | `registration_manager` |
| `payment_rejected` | Staff rejects receipt | Registrant |
| `payment_approved` | → `paid` | Registrant |
| `payment_reminder` | Cron: unpaid (e.g. 3d, 1d, 6h before reg close or event) | Registrant |
| `event_countdown` | Cron: **T-6d, T-3d, T-1d** in `events.timezone` | Confirmed / checked-in (config) |
| `event_day` | Cron: morning of `starts_at` | Same cohort |
| `organizer_blast` | Staff API send | Selected segment |
| `results_published` | `results_published_at` set | Opt-in + registered |
| `division_locked_digest` | Division `scoring_locked` | Opt-in |

**Idempotency keys:** e.g. `payment_reminder:{registration_id}:d-3`, `countdown:{event_id}:{registration_id}:d-1`.

### Countdown & prep content

Templates: schedule (`starts_at`, venue), hub + schedule links, organizer contact, **dynamic checklist** (paid?, music approved?). Personalize with competitor name when **17** is live.

### Organizer / admin blasts

- **UI:** `/organize` → **Comms** tab (or Registrations sub-panel).
- **Capability:** `manage_registration` or `manage_event` to send; `view_ops` read log.
- **Segments:** all registered, unpaid, waitlisted, by division, confirmed only.
- **Flow:** segment → preview count → template + body → send → `event_comms_log`.
- **Guards:** rate limit per event; require venue/time in template when applicable.

### Live scores & rankings

| Channel | Default |
|---------|---------|
| PWA / Realtime on leaderboard | On when user is on page |
| Email per score | **Off** |
| Email on results publish | Opt-in |
| Email on division lock (summary) | Opt-in digest |

### User preferences (migration **027**)

Per `account_id`: `email_payment_reminders`, `email_event_countdown`, `email_organizer_blasts`, `email_results_and_rankings`, `email_staff_ops`. Unsubscribe per category.

### Architecture

```
Cron (hourly) / hooks → comms_outbox → /api/cron/comms → email provider → sent_at
Staff blast API → comms_outbox (immediate) + event_comms_log
```

**Tables (027):** `notification_preferences`, `comms_outbox`, `event_comms_log`; optional `comms_templates`.

**Depends on:** **20** (payment CTAs), **013** (timezone countdown), **12** (results), **17** (guardian addressing).

### AI (optional, advisory)

TypeSafe-style hints: prep checklist ordering, blast validation, receipt triage for staff — never auto-send or auto-approve payments.

### Acceptance (MVP)

1. Unpaid registrant gets payment reminder + T-3d countdown with hub links.
2. Organizer blasts “unpaid” segment; audit shows recipient count.
3. Results publish triggers one opt-in email per event.
4. Member can disable countdown emails.

### Phase 2

In-app notification center; PWA push; SMS T-1 opt-in.

---

## Prompt 23 — Platform hygiene

- Refresh `supabase/schema.sql`; RLS doc or fix.
- CI smoke on PR; `npm test` entrypoint.
- Keep migration list in `CLAUDE.md` in sync.

---

## Reference

- `lib/auth/event-permissions.ts`
- `014_registrations.sql`, `lib/registration/service.ts`
- `013_event_timing.sql`
- `docs/IDENTITY_ADR.md`
