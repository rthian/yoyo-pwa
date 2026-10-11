# Extractable components

## AdminSidebar
- Source: `components/admin/AdminSidebar.tsx`
- Category: layout
- Description: Desktop side nav for admin (Dashboard, Events, Members, Judges, Rules, Reports, Settings)
- Extractable props: activeItem (string, default: "dashboard")
- Hardcoded: nav labels, lucide icon names, hrefs under /admin, CSS

## AdminHeader
- Source: `components/admin/AdminHeader.tsx`
- Category: layout
- Description: Sticky admin header with mobile Sheet nav and user dropdown
- Extractable props: memberName (string), memberEmail (string)
- Hardcoded: brand text YoYo League, sheet nav items, sign-out label

## JudgeBottomNav
- Source: `components/judge/JudgeBottomNav.tsx`
- Category: layout
- Description: Fixed bottom tab bar for judge PWA
- Extractable props: activeItem (string, default: "home")
- Hardcoded: Home/Divisions/Queue/Done labels, icons, hrefs

## JudgeHeader
- Source: `components/judge/JudgeHeader.tsx`
- Category: layout
- Description: Sticky judge header with online indicator and avatar menu
- Extractable props: memberName (string), isOnline (boolean, default: true)
- Hardcoded: brand text, menu items, CSS

## MemberHeader
- Source: `components/shared/MemberHeader.tsx`
- Category: layout
- Description: Top nav for members (Dashboard, Events, Leaderboards) + profile menu
- Extractable props: activeItem (string, default: "dashboard")
- Hardcoded: nav labels, hrefs, brand text

## JudgeDashboardHeader
- Source: `components/shared/JudgeDashboardHeader.tsx`
- Category: layout
- Description: Alternate top nav on home for judges (outside /judge shell)
- Extractable props: activeItem (string, default: "dashboard")
- Hardcoded: Dashboard / Judge Console / Leaderboards links

## MemberLayoutClient
- Source: `components/shared/MemberLayoutClient.tsx`
- Category: layout
- Description: MemberHeader + gradient main wrapper
- Extractable props: none
- Hardcoded: gradient classes

## UserProfileMenu
- Source: `components/shared/UserProfileMenu.tsx`
- Category: basic
- Description: Initials avatar dropdown with profile + sign out
- Extractable props: name (string), email (string), profileHref (string, default: "/member/profile")
- Hardcoded: menu labels, initials derivation, CSS

## LandingPage
- Source: `components/landing/LandingPage.tsx`
- Category: layout
- Description: Public marketing hero + feature cards + footer
- Extractable props: none
- Hardcoded: copy, emoji mark, feature cards, Sign In CTA

## OfflineIndicator
- Source: `components/judge/OfflineIndicator.tsx`
- Category: layout
- Description: Sync/offline status strip under judge header
- Extractable props: status (string, default: "online")
- Hardcoded: status copy, badge styles

## MobileCard
- Source: `components/ui/mobile-card.tsx`
- Category: basic
- Description: Touch-friendly list card pattern
- Extractable props: title (string), description (string), badge (string)
- Hardcoded: layout structure, skeleton variants

## EmptyState
- Source: `components/ui/empty-state.tsx`
- Category: basic
- Description: Empty/error presets (NoEvents, NoScores, Offline, etc.)
- Extractable props: title (string), description (string), actionLabel (string)
- Hardcoded: preset copy and icons

## Podium
- Source: `components/leaderboard/Podium.tsx`
- Category: basic
- Description: Medal podium for live leaderboard
- Extractable props: first (object), second (object), third (object)
- Hardcoded: gold/silver/bronze CSS vars, framer-motion

## LeaderboardRow
- Source: `components/leaderboard/LeaderboardRow.tsx`
- Category: basic
- Description: Animated ranking row
- Extractable props: rank (number), name (string), score (string), country (string)
- Hardcoded: motion, row layout
