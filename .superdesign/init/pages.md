# Page dependency trees

Local `@/` imports only. Candidate context sets for Superdesign — apply PAYLOAD BUDGET when selecting.

## / (Home / role dashboard)

Entry: `app/page.tsx`
Dependencies:
- `components/dashboard/RoleDashboard.tsx`
  - `components/landing/LandingPage.tsx`
    - `components/ui/button.tsx`
    - `components/ui/card.tsx`
  - `components/dashboard/AdminDashboardView.tsx`
    - `components/ui/card.tsx`
    - `components/ui/button.tsx`
    - `components/ui/badge.tsx`
  - `components/dashboard/JudgeDashboardView.tsx`
    - `components/ui/card.tsx`
    - `components/ui/button.tsx`
    - `components/ui/badge.tsx`
    - `components/shared/JudgeDashboardHeader.tsx`
      - `components/shared/UserProfileMenu.tsx`
  - `components/dashboard/MemberDashboardView.tsx`
    - `components/ui/card.tsx`
    - `components/ui/button.tsx`
    - `components/ui/badge.tsx`
    - `components/shared/MemberHeader.tsx`
      - `components/shared/UserProfileMenu.tsx`

## /login

Entry: `app/login/page.tsx`
Dependencies:
- `components/ui/button.tsx`
- `components/ui/input.tsx`
- `components/ui/label.tsx`
- `components/ui/card.tsx`

## /admin (Admin dashboard)

Entry: `app/(admin)/admin/page.tsx`
Layout deps:
- `components/admin/AdminHeader.tsx`
  - `components/ui/button.tsx`
  - `components/ui/dropdown-menu.tsx`
  - `components/ui/sheet.tsx`
- `components/admin/AdminSidebar.tsx`
Page deps:
- `components/ui/card.tsx`

## /judge (Judge console home)

Entry: `app/(judge)/judge/page.tsx`
Layout deps:
- `components/judge/JudgeHeader.tsx`
  - `components/ui/button.tsx`
  - `components/ui/dropdown-menu.tsx`
- `components/judge/OfflineIndicator.tsx`
  - `components/ui/badge.tsx`
  - `components/ui/button.tsx`
- `components/judge/JudgeBottomNav.tsx`
Page deps:
- `components/ui/card.tsx`
- `components/ui/badge.tsx`

## /judge/divisions/[id]

Entry: `app/(judge)/judge/divisions/[id]/page.tsx`
Dependencies:
- `components/ui/card.tsx`
- `components/ui/badge.tsx`
- `components/ui/button.tsx`
- `components/judge/LockDivisionButton.tsx`
- `components/judge/DivisionPageTabs.tsx`
  - `components/ui/tabs.tsx`
  - `components/judge/JudgeVisualiser.tsx`
    - `components/ui/card.tsx`
    - `components/ui/button.tsx`

## /judge/divisions/[id]/score/[participantId]

Entry: `app/(judge)/judge/divisions/[id]/score/[participantId]/page.tsx`
Dependencies:
- `components/judge/ScoringForm.tsx`
  - `components/ui/button.tsx`
  - `components/ui/card.tsx`
  - `components/ui/badge.tsx`
  - `components/judge/ClickerInput.tsx`

## /member/events

Entry: `app/(member)/member/events/page.tsx`
Layout deps:
- `components/shared/MemberLayoutClient.tsx`
  - `components/shared/MemberHeader.tsx`
    - `components/shared/UserProfileMenu.tsx`
Page deps:
- `components/ui/card.tsx`
- `components/ui/button.tsx`
- `components/ui/badge.tsx`

## /member/profile

Entry: `app/(member)/member/profile/page.tsx`
Layout deps: same as /member/events
Page deps:
- `components/ui/card.tsx`
- `components/ui/button.tsx`
- `components/ui/input.tsx`
- `components/ui/label.tsx`
- `components/ui/badge.tsx`
- `components/ui/tabs.tsx`

## /leaderboards

Entry: `app/leaderboards/page.tsx`
Dependencies:
- `components/ui/card.tsx`
- `components/ui/badge.tsx`
- `components/ui/button.tsx`

## /leaderboard/[divisionId]

Entry: `app/leaderboard/[divisionId]/page.tsx`
Dependencies:
- `components/ui/card.tsx`
- `components/ui/badge.tsx`
- `components/ui/button.tsx`
- `components/leaderboard/Podium.tsx`
- `components/leaderboard/LeaderboardRow.tsx`
