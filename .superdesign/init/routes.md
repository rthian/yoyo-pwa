# Routes — YoYo League

Route groups `(admin)`, `(judge)`, `(member)` do not appear in the URL.
Middleware protects `/admin`, `/judge`, `/member` (auth); roles enforced in layouts/pages.

## Layout shells

| Shell | Layout file | Chrome |
|-------|-------------|--------|
| Root | `app/layout.tsx` | Geist fonts, AuthProvider, Toaster, globals.css |
| Admin | `app/(admin)/layout.tsx` | AdminHeader + AdminSidebar + footer |
| Judge | `app/(judge)/layout.tsx` | JudgeHeader + OfflineIndicator + main + footer + JudgeBottomNav |
| Member | `app/(member)/layout.tsx` | MemberLayoutClient → MemberHeader + gradient main |
| Home `/` | none (root only) | RoleDashboard picks Landing / Admin / Judge / Member views |

## Public / auth

| URL | File | Summary |
|-----|------|---------|
| `/` | `app/page.tsx` | Role dashboard or landing via RoleDashboard |
| `/login` | `app/login/page.tsx` | Email/password sign-in |
| `/forgot-password` | `app/forgot-password/page.tsx` | Password reset request |
| `/auth/reset-password` | `app/auth/reset-password/page.tsx` | Reset password form |
| `/auth/callback` | `app/auth/callback/route.ts` | OAuth/session callback |
| `/unauthorized` | `app/unauthorized/page.tsx` | Role denied |
| `/leaderboards` | `app/leaderboards/page.tsx` | Public hub of shared division boards |
| `/leaderboard/[divisionId]` | `app/leaderboard/[divisionId]/page.tsx` | Live podium + rankings (`?token=`) |
| `/events/[id]/schedule` | `app/events/[id]/schedule/page.tsx` | Public contest schedule |

## Member

| URL | File | Summary |
|-----|------|---------|
| `/member/events` | `app/(member)/member/events/page.tsx` | Browse/register for divisions |
| `/member/profile` | `app/(member)/member/profile/page.tsx` | Profile edit + participation history |

## Judge

| URL | File | Summary |
|-----|------|---------|
| `/judge` | `app/(judge)/judge/page.tsx` | Judge home: pending/completed + divisions |
| `/judge/divisions` | `app/(judge)/judge/divisions/page.tsx` | Assigned divisions list |
| `/judge/divisions/[id]` | `app/(judge)/judge/divisions/[id]/page.tsx` | Participants + progress + lock |
| `/judge/divisions/[id]/score/[participantId]` | `.../score/[participantId]/page.tsx` | Scoring form |
| `/judge/queue` | `app/(judge)/judge/queue/page.tsx` | Scoring queue |
| `/judge/completed` | `app/(judge)/judge/completed/page.tsx` | Completed scores |

## Admin

| URL | File | Summary |
|-----|------|---------|
| `/admin` | `app/(admin)/admin/page.tsx` | Stats + recent events |
| `/admin/events` | `app/(admin)/admin/events/page.tsx` | Event list |
| `/admin/events/new` | `app/(admin)/admin/events/new/page.tsx` | Create event |
| `/admin/events/[id]` | `app/(admin)/admin/events/[id]/page.tsx` | Event detail |
| `/admin/events/[id]/edit` | `.../edit/page.tsx` | Edit event |
| `/admin/events/[id]/divisions/new` | `.../divisions/new/page.tsx` | New division |
| `/admin/events/[id]/divisions/[divisionId]` | `.../[divisionId]/page.tsx` | Division detail |
| `/admin/events/[id]/divisions/[divisionId]/edit` | `.../edit/page.tsx` | Edit division |
| `/admin/members` | `app/(admin)/admin/members/page.tsx` | Members table |
| `/admin/members/new` | `.../new/page.tsx` | Add member |
| `/admin/members/[id]` | `.../[id]/page.tsx` | Member detail |
| `/admin/members/[id]/edit` | `.../edit/page.tsx` | Edit member |
| `/admin/judges` | `app/(admin)/admin/judges/page.tsx` | Judges list |
| `/admin/rules` | `app/(admin)/admin/rules/page.tsx` | Rulesets |
| `/admin/rules/new` | `.../new/page.tsx` | New ruleset |
| `/admin/rules/[id]` | `.../[id]/page.tsx` | Ruleset detail |
| `/admin/rules/[id]/edit` | `.../edit/page.tsx` | Edit ruleset |
| `/admin/reports` | `app/(admin)/admin/reports/page.tsx` | Reports |
| `/admin/settings` | `app/(admin)/admin/settings/page.tsx` | Settings |
