# YoYo League — UX Review & Refresh (design/ux-refresh)

Date: 2026-10-20 · Scope: role dashboard, member hub, judge home/queue, scoring chrome, design tokens.

## 1. System analysis

YoYo League serves four audiences through one PWA:

| Audience | Primary surfaces | Core loop |
|---|---|---|
| Spectators | `/leaderboard/[id]`, `/leaderboards` | Open link → watch live ranks |
| Competitors (member) | `/`, `/member/*` | Check schedule → register → see results |
| Judges | `/judge/*` | Pick next in queue → click TE → rate FE → submit |
| Organizers/admins | `/organize/*`, `/admin/*` | Create event → divisions → assign judges → publish |

The judge flow is the product's differentiator (offline-capable mobile scoring, WYYC-aligned
TE clicker). The member dashboard is the highest-traffic signed-in screen. Both already follow
the M3 Expressive design system (`.superdesign/design-system.md`), so this refresh works
*within* those tokens rather than replacing them.

## 2. Findings (ranked by impact)

### F1 — Member dashboard lacks a "next action"
The dashboard greets the user but front-loads nothing: the most important question a
competitor has on event day — *"when do I play next?"* — is buried inside a generic
"Upcoming Sessions" card identical in weight to "My Events" and "Scoreboards". No primary
CTA exists above the fold.

**Fix:** Next-up hero card (date/time countdown, division, venue, round badge), then stats,
then the rest of the content.

### F2 — No sense of progress anywhere for the judge
Judge home shows counts; the queue shows "N left · M done" as plain text. Neither shows
*progress*. Judges on a panel are time-pressured; a progress bar plus a persistent "Score
next" FAB-style action reduces wayfinding time.

**Fix:** Progress bar on judge home hero and queue header; keep the run-order list as the
single source of truth.

### F3 — Inconsistent press/feedback affordances across roles
Judge cards use `active:scale-[0.98]`; member cards use `hover:bg-accent` only; navigation
rows in judge home use `active:bg-accent`. On a PWA judged mostly on phones, touch feedback
should be uniform: brief scale + tonal state layer (per M3 Expressive "button press ~0.96").

**Fix:** Add shared `.pressable` utility and apply to interactive rows/cards in the touched
surfaces.

### F4 — Scoring screen chrome wastes vertical space
The scoring page stacks a sticky header, a back button, participant name, a "Back to live
TE" outline button, and the fixed totals bar. The step indicator ("Live TE" vs "FE
Evaluation") is a text suffix in a subtitle — easy to miss mid-flow, where a wrong-step
mistake costs real time.

**Fix:** Explicit segmented step indicator in the scoring header (TE → Evaluate), removing
the ambiguity. (Implemented as a header stepper in `ScoringForm`.)

### F5 — Typography hierarchy is flat on key screens
Welcome heading, section titles, and card titles all sit close in size/weight. M3 Expressive
calls for emphasized display type at the top of the screen with quiet supporting text.

**Fix:** Larger emphasized greeting with date/context line; section titles get consistent
`Title Large` treatment.

## 3. What changed on this branch

1. **`app/globals.css`** — shared interaction utilities: `.pressable` (M3 press scale +
   state layer), focus-visible rings, `prefers-reduced-motion` guard.
2. **`components/dashboard/MemberDashboardView.tsx`** — restructured around next-up session
   hero, stat strip, quick actions, and clearer hierarchy (F1, F3, F5).
3. **`app/(judge)/judge/page.tsx`** — progress-aware hero with inline progress bar,
   emphasized pending count, cleaner division rows (F2, F3, F5).
4. **`app/(judge)/judge/queue/page.tsx`** — progress bar in header, done state summary (F2).
5. **`components/judge/ScoringForm.tsx`** — explicit TE → Evaluate step indicator in the
   sticky header (F4).

## 4. Out of scope (candidates for follow-up)

- Organizer/admin surfaces (`/organize/*`, `/admin/*`) — same treatment, separate pass.
- Leaderboard podium/list visual density and rank-change animations.
- Member bottom navigation on mobile (currently top-nav only; judges have bottom nav).
- Empty-state illustration set (currently icon-only).
