# CLAUDE.md — YoYo League PWA

## Project Overview

YoYo League PWA is a Progressive Web Application for managing yo-yo competition events. It supports event management, judge scoring (including offline), real-time leaderboards, and role-based dashboards for admins, judges, and members.

**Tech Stack**: Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4 · Supabase (PostgreSQL + Auth + Realtime) · PWA via `@ducanh2912/next-pwa`

---

## Development Commands

```bash
npm run dev       # Start development server (localhost:3000)
npm run build     # Production build
npm start         # Start production server
npm run lint      # Run ESLint
```

No test runner is currently configured.

---

## Environment Variables

Copy `.env.local.example` to `.env.local` and populate these:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # Server-side only; bypasses RLS
```

The service role key is used in `lib/supabase/admin.ts` for server-side operations that need to bypass Row Level Security (see [Known Issues](#known-issues)).

---

## Repository Structure

```
app/                    # Next.js App Router
  (admin)/admin/        # Admin pages (event/division/member management)
  (judge)/judge/        # Judge pages (mobile-optimized scoring)
  (member)/member/      # Member pages
  api/                  # API route handlers
  leaderboard/[id]/     # Public shareable leaderboard
  leaderboards/         # Public leaderboard hub
  login/                # Auth page
  page.tsx              # Root: role-based redirect
components/
  admin/                # Admin-specific UI (DivisionForm, DivisionJudges, etc.)
  judge/                # Judge-specific UI (ScoringForm, NumberStepper, ClickerInput,
                        #   LockDivisionButton, JudgeVisualiser, DivisionPageTabs)
  leaderboard/          # Leaderboard display components
  ui/                   # shadcn/ui base components
lib/
  auth/                 # Auth context (client) and server actions
  hooks/                # Custom hooks (online status, leaderboard, haptics)
  offline/              # IndexedDB score queue and sync manager
  supabase/             # Supabase clients: client.ts, server.ts, admin.ts, middleware.ts
  types/
    database.ts         # All TypeScript types for DB rows and enums
    visualiser.ts       # Types for head judge visualiser API responses
  utils/
    judge-analytics.ts  # Panel stats, outlier detection, judge deviation analytics
    country-flags.ts    # Country flag utilities
    haptics.ts          # Haptic feedback
    utils.ts            # cn() and general utilities
  validations/index.ts  # All Zod schemas for forms
supabase/
  schema.sql            # Full DB schema
  migrations/           # Schema migrations
docs/                   # Deployment guide, RLS workaround, scoring rules
middleware.ts           # Route protection: /admin, /judge, /member require auth
```

---

## Architecture

### Route Groups & Layouts

Routes are organized in Next.js [route groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups):
- `(admin)` — admin layout wrapping all admin pages
- `(judge)` — judge layout (mobile-first, bottom nav)
- `(member)` — member layout

The root `app/page.tsx` checks the user's role and redirects to the appropriate dashboard using the `RoleDashboard` component with `dynamic = 'force-dynamic'`.

### Authentication & Authorization

1. **Middleware** (`middleware.ts`): Checks for a Supabase session on protected routes (`/admin`, `/judge`, `/member`). Unauthenticated requests redirect to `/login`.
2. **Role enforcement** happens in individual page components (not middleware) by reading the `member.role` from the database.
3. **Auth Context** (`lib/auth/context.tsx`): Client-side React context providing `user` and `member` objects.
4. **Server Actions** (`lib/auth/actions.ts`): `signOut`, `getCurrentUser`, `updatePassword`, etc.

### Supabase Clients

| File | Usage | Notes |
|------|-------|-------|
| `lib/supabase/client.ts` | Browser components | Custom mutex lock to avoid `navigator.locks` AbortError in Next.js HMR/navigation |
| `lib/supabase/server.ts` | Server Components & Route Handlers | Cookie-based session |
| `lib/supabase/admin.ts` | Server-only sensitive operations | Uses `SUPABASE_SERVICE_ROLE_KEY`; bypasses RLS |
| `lib/supabase/middleware.ts` | Auth middleware | Session refresh in middleware |

**Always use `admin.ts` when performing role/permission checks server-side** due to the RLS infinite recursion workaround (see below).

### Offline Support

Judges can score without internet connectivity:

1. **Score Queue** (`lib/offline/queue.ts`): Stores pending scores in IndexedDB via `localforage`.
2. **Sync Manager** (`lib/offline/sync-manager.ts`): Watches online status and automatically flushes queued scores to `/api/scores/sync` when connectivity returns.
3. **UI Feedback** (`components/judge/OfflineIndicator.tsx`): Shows offline badge and pending count.
4. **Online Hook** (`lib/hooks/use-online-status.ts`): Reactive `boolean` for connectivity state.

### Real-time Leaderboards

- `lib/hooks/use-leaderboard.ts` subscribes to Supabase Realtime on the `scores` table for a given division.
- Public leaderboard pages (`app/leaderboard/[id]/`) use token-based access via `leaderboard_tokens` table for shareable links.

---

## Database Schema

Key tables (full schema in `supabase/schema.sql`, TypeScript types in `lib/types/database.ts`):

| Table | Description |
|-------|-------------|
| `members` | Users with roles: `admin`, `judge`, `member` |
| `events` | Competition events (draft → published → active → completed → cancelled) |
| `divisions` | Categories within events; has `scoring_type`, `scoring_locked`, `hide_scores_until_complete` |
| `division_members` | Competitor enrollment per division |
| `division_judges` | Judge assignments; has `judge_type` (incl. `shadow`) and `scores_included_in_leaderboard` |
| `scores` | Judge scores (clicks, choreography, consistency, etc.) |
| `rulesets` | Scoring rule definitions |
| `leaderboard_tokens` | UUID tokens for public leaderboard sharing |
| `schedule_entries` | Event schedule/timeline |

**Enums** (from `lib/types/database.ts`):
- `MemberRole`: `admin | judge | member`
- `EventStatus`: `draft | published | active | completed | cancelled`
- `ScoringType`: `standard | clicker | head_to_head`
- `JudgeType`: `head | general | technical | performance | shadow`
- `DivisionMemberStatus`, `RoundType`, `ScheduleEntryType`

### Migrations

Applied in order from `supabase/migrations/`:
1. `001_*` — base schema (covered by `schema.sql`)
2. `002_scoring_lock_and_hide.sql` — adds `scoring_locked` and `hide_scores_until_complete` to `divisions`
3. `003_judge_included_and_shadow.sql` — adds `scores_included_in_leaderboard` to `division_judges`; extends `judge_type` with `shadow`

---

## Component Patterns

### shadcn/ui

Components live in `components/ui/`. Style is `new-york`. Extend via `components.json`. All components use Tailwind CSS v4 with CSS variables for theming.

```bash
# Add a new shadcn component
npx shadcn@latest add <component-name>
```

### Form Handling

All forms use React Hook Form + Zod:

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { mySchema } from '@/lib/validations'

const form = useForm({ resolver: zodResolver(mySchema) })
```

Validation schemas are centralized in `lib/validations/index.ts`.

### Server Components vs. Client Components

- Default to Server Components for data fetching pages.
- Use `'use client'` only when hooks, interactivity, or browser APIs are needed.
- Server Components use `lib/supabase/server.ts`; client components use `lib/supabase/client.ts`.

### Path Aliases

`@/` maps to the repository root (configured in `tsconfig.json`). Always use `@/` imports:

```ts
import { cn } from '@/lib/utils/utils'
import type { Member } from '@/lib/types/database'
```

---

## API Routes

All API routes live under `app/api/` and follow Next.js Route Handler conventions (`route.ts` files with `GET`, `POST`, `PATCH`, `DELETE` exports).

Typical pattern:
1. Authenticate with `createServerClient()` or `createAdminClient()` depending on sensitivity.
2. Validate request body with Zod schemas from `lib/validations`.
3. Return `NextResponse.json()` with appropriate HTTP status codes.

Important endpoints:

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/scores` | `POST` | judge | Submit/overwrite a score |
| `/api/scores/sync` | `POST` | judge | Batch offline score sync |
| `/api/divisions/[id]/lock` | `PATCH` | head judge / admin | Toggle `scoring_locked` on a division |
| `/api/divisions/[id]/visualiser` | `GET` | head judge / admin | Panel analytics data |
| `/api/divisions/[id]/judges` | `GET/POST/PATCH` | admin | Manage judge assignments and `scores_included_in_leaderboard` |
| `/api/leaderboard/[divisionId]` | `GET` | public (token) | Leaderboard; respects `hide_scores_until_complete` |
| `/api/members` | `POST` | admin | Create a member |

---

## Head Judge & Scoring Control Features

These features are available to **head judges** (and admins) only.

### Division Scoring Lock

A head judge can lock/unlock a division via `PATCH /api/divisions/[id]/lock` with `{ scoring_locked: boolean }`.

- When `scoring_locked = true`, the scores API returns `403` for any new score submissions in that division.
- The `LockDivisionButton` component (`components/judge/LockDivisionButton.tsx`) provides the UI toggle.

### Score Overwrite UX

When a judge attempts to submit a score for a participant they have already scored:
- The UI shows a confirmation dialog before overwriting.
- The scoring form displays the `updated_at` timestamp of the existing score so judges know it was previously submitted.

### Hide Leaderboard Until Complete

Divisions have an optional `hide_scores_until_complete` flag (set in the admin division form via the "Hide leaderboard until complete" switch).

- When `true`, the public leaderboard API returns a message instead of scores until the division's `scoring_locked = true`.
- `components/leaderboard/` renders a "scores hidden" state in this case.

### Head Judge Visualiser

A dedicated **Visualiser** tab appears on the judge division page for head judges only (`components/judge/JudgeVisualiser.tsx`, `components/judge/DivisionPageTabs.tsx`).

**Data source**: `GET /api/divisions/[id]/visualiser` — returns participants, judges, all scores (submitted + draft), panel stats, outliers, and judge summaries.

**Analytics** (computed server-side in `lib/utils/judge-analytics.ts`):

| Function | Description |
|----------|-------------|
| `computeParticipantPanelStats()` | Mean and std dev of `total_score` per participant across all judges |
| `computeOutliers()` | Scores where `|deviation| > max(1.5 × stdDev, 2.0)` |
| `computeJudgeSummaries()` | Per-judge: avg absolute deviation from panel mean, outlier count |

**Charts** (rendered with `recharts`):
- Grouped bar chart of scores by participant (one bar per judge)
- Judge deviation chart with red highlight when `|deviation| > 2`
- Outlier list table
- Panel status card showing excluded/shadow judges

Draft scores are included in the visualiser with a "draft" banner. A refresh button re-fetches data.

### Judge Exclusion & Shadow Judge

**`scores_included_in_leaderboard`** (`division_judges` column, default `true`):
- Head judge or admin can toggle this per judge via the admin `DivisionJudges` component.
- When `false`, that judge's scores are excluded from leaderboard calculations and visualiser panel stats.

**`shadow` judge type** (extends `JudgeType` enum):
- Shadow judges are assigned for training; their scores **never** count regardless of `scores_included_in_leaderboard`.
- Visible in admin dropdown as "Shadow (training)".
- The visualiser's Panel Status card lists all excluded and shadow judges.

---

## PWA Configuration

Configured in `next.config.ts` via `@ducanh2912/next-pwa`:
- **Disabled in development** (`disable: process.env.NODE_ENV === 'development'`)
- Caches frontend navigation assets aggressively
- Workbox for service worker generation
- Manifest at `public/manifest.json`; icons at `public/icons/` (72px → 512px)
- Cache headers defined in `vercel.json` (icons: 1 year, manifest: no-cache)

---

## Known Issues

### Supabase RLS Infinite Recursion

Supabase Row Level Security (RLS) policies on the `members` table can cause infinite recursion when a policy queries the same table to check the caller's role.

**Workaround**: Use `createAdminClient()` (service role) for any server-side operation that needs to read `members` for role/permission checks. This bypasses RLS entirely on the server side and is safe because these calls are never exposed to the browser.

See `docs/RLS_WORKAROUND.md` for the full explanation and the SQL fix that can be applied to resolve the underlying policy issue.

---

## Deployment

Full guide at `docs/DEPLOYMENT.md`. Summary:

1. Create a Supabase project and run `supabase/schema.sql`
2. Set environment variables on Vercel (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
3. Deploy via Vercel (framework auto-detected as Next.js)
4. Create the first admin user: `node scripts/create-admin.js`

The `vercel.json` is pre-configured with security headers and correct cache policies for PWA assets.

---

## Adding New Features

### New Admin Page

1. Create `app/(admin)/admin/<feature>/page.tsx` (Server Component).
2. Fetch data with `createAdminClient()` or `createServerClient()` depending on sensitivity.
3. Add navigation link in the admin layout/sidebar component.

### New API Endpoint

1. Create `app/api/<resource>/route.ts`.
2. Import the appropriate Supabase client.
3. Add Zod validation for request bodies in `lib/validations/index.ts`.
4. Handle auth and return typed responses.

### New Database Table

1. Add the table to `supabase/schema.sql`.
2. Create a timestamped migration in `supabase/migrations/`.
3. Add TypeScript types to `lib/types/database.ts`.
4. Consider RLS policies and whether the admin client workaround applies.

### New shadcn/ui Component

```bash
npx shadcn@latest add <component-name>
```

The component will appear in `components/ui/`.
