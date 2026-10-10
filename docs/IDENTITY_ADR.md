# Account vs Competitor Identity

**Status:** Slice A–E shipped  
**Referenced by:** `CLAUDE.md` migrations, `lib/identity/account-profile.ts`, `024_identity_slice_e_drop_member_profile_cols.sql`  
**Glob:** existing IDENTITY_ADR.md  
**User:** "next"

## Decision

- **`members`** = Auth accounts (roles, login, staff, judges).
- **`competitors`** = persistent competition identity (profiles, enrollment, rankings).
- **`account_competitor_links`** = who may act for a competitor (`self`, guardian, etc.).

## Slices

| Slice | Scope |
|-------|--------|
| **A** | `competitors` + `account_competitor_links` + backfill + helpers (`011`) |
| **B** | Nullable `competitor_id` on `division_members`, `division_results`, `ranking_points`, `season_titles`, `member_privileges`; backfill; DB fill trigger; dual-write writers (`021`) |
| **C** | Read cutover (profiles/rankings/search via competitors) |
| **D1** | NOT NULL `competitor_id`; nullable `member_id`; unique on competitor keys; `public_competitors` (`022`) |
| **D2** | Drop `member_id` columns/FKs; switch remaining embeds to competitors |
| **E** | Drop competition columns from `members` |

## Slice B notes

- `member_id` remains required and authoritative for existing judge/admin flows.
- DB trigger `fill_competitor_id_from_member` fills `competitor_id` when omitted.
- Registration confirm RPC writes both keys into `division_members`.
- Sample dual row: `{ member_id: "acct_demo", competitor_id: "comp_demo" }`.
- Rollback: drop `competitor_id` columns + trigger (do not rewrite `021`).

## Slice D1 notes (`022`)

- Requires zero NULL `competitor_id` on the five dual-key tables (migration raises otherwise).
- `member_id` becomes nullable; uniqueness moves to `(division_id, competitor_id)` / `(event_id, category_id, competitor_id)`.
- Registration RPC upserts on competitor keys (guardian-only competitors can enroll).
- View `public_competitors` added; `public_members` kept for compatibility.

## Slice D2 notes (`023`)

- App cutover: `division_members` embeds → `competitor:competitors`; my-* filters use `getCompetitorIdsForAccount`.
- Migration drops `member_id` on the five tables; drops fill triggers; RPC inserts competitor-only.
- `division_judges.member_id` and `scores.judge_id` unchanged (Auth accounts).

## Slice E notes (`024`)

- App: `composeMember` / `getComposedMember` overlays self-competitor profile onto account row for `/api/member/me` and admin UI.
- Writes: signup/register/profile/admin update competition fields on `competitors` only; `members` keeps `full_name` as staff display name.
- Migration drops `public_id`, `nickname`, `country`, `home_geo_id`, `gender`, `avatar_url`, `bio`, `profile_visibility`, `first_competed_on` from `members`; drops `public_members`.
- `competitors.source_member_id` retained (optional later cleanup).

## Slice C notes (no migration)

- Public profile (`lib/rankings/profile.ts`), rankings (`lib/rankings/query.ts`), and search (`lib/search/query.ts`) resolve display identity from `competitors`.
- Ledger queries use `competitor_id` (D2: no `member_id` fallback on ranking tables).
- Profile PATCH dual-updates the self-linked `competitors` row so public pages stay in sync.
- Rankings `memberId` remains `source_member_id` for “my standing” focus; `competitorId` is also returned.
- Rollback: point those three libs back at `members` embeds.
