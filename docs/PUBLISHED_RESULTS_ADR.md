# Published Results (Prompt 12)

Official public results are a **frozen snapshot**, separate from live leaderboards and season finalize.

## Pipelines

| Stage | Purpose | Public? |
|-------|---------|---------|
| Live `/leaderboard/*` | Ops board from live `scores` | Token / post-lock |
| Lock | Freezes `division_results` | Unlocks live board if hidden |
| **Publish (this)** | Marks event results official; serves `division_results` | Yes on hub Results |
| Finalize | Awards `ranking_points` for season race | Rankings only |

## Rules

1. Capability: `publish_results` (owner, organizer, admin).
2. Publish requires every active division to be `scoring_locked` with non-empty `division_results` (or zero participants).
3. On publish, refresh auto snapshots from current standings for locked divisions.
4. Unpublish clears `results_published_at` (does not delete `division_results`).
5. Live boards stay on `/leaderboard/*`; official standings use public names + league `public_id` only (no emails).

## Schema

- `events.results_published_at` / `results_published_by`
- `published_results_audit` append-only
