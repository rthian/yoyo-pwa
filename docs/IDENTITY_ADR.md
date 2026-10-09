# Account vs Competitor Identity

**Status:** Slice A shipped · Slice B shipped · C–E deferred  
**Referenced by:** `CLAUDE.md` migrations, `lib/identity/competitors.ts`, `021_identity_slice_b_dual_columns.sql`  
**Glob:** no prior docs/IDENTITY_ADR.md  
**User:** "yes"

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
| **D** | NOT NULL `competitor_id`; drop member FKs on competition tables |
| **E** | Drop competition columns from `members` |

## Slice B notes

- `member_id` remains required and authoritative for existing judge/admin flows.
- DB trigger `fill_competitor_id_from_member` fills `competitor_id` when omitted.
- Registration confirm RPC writes both keys into `division_members`.
- Sample dual row: `{ member_id: "acct_demo", competitor_id: "comp_demo" }`.
- Rollback: drop `competitor_id` columns + trigger (do not rewrite `021`).
