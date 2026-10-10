# YoYo League — Design System (Material 3 Expressive)

**Style source:** Google Material Design 3 — latest **Material 3 Expressive** update (2025), plus Superdesign `material` prompt DNA adapted for YoYo League.

Replaces the previous “Arena Night” direction. Do **not** use dark cinematic/cyan/gold-arena styling.

## Product context

**YoYo League** — PWA for competitive yo-yo: admin event ops, mobile judging, live public leaderboards.

**Key surfaces:** Landing `/`, Live leaderboard `/leaderboard/[divisionId]`, Judge home `/judge`, Judge scoring, Admin `/admin`.

## Design philosophy (M3 Expressive)

Personal, adaptive, spirited. Tonal surfaces over stark white. Soft organic shape language. Emphasized typography for hierarchy. Springy, confident motion. Components follow Material specs: Filled / Filled tonal / Outlined / Text buttons, FABs, Navigation bar, Navigation rail, Cards, Chips, Badges, Dialogs, Top app bars.

## Color — tonal scheme (seed: competition blue)

Dynamic-color style scheme from seed **`#0B57D0`** (Material-like blue; avoids default demo purple so brand stays competition-focused while remaining true MD3).

### Light

| Role | Hex | Use |
|------|-----|-----|
| surface | `#F8F9FF` | Page background (tinted, not #FFF) |
| on-surface | `#1A1B21` | Primary text |
| surface-container-lowest | `#FFFFFF` | Elevated cards |
| surface-container-low | `#F2F3FA` | Recessed areas |
| surface-container | `#ECEDF4` | Nav, sheets |
| surface-container-high | `#E6E8EF` | Hover / nested |
| primary | `#0B57D0` | CTAs, active nav, FABs |
| on-primary | `#FFFFFF` | Text on primary |
| primary-container | `#D6E3FF` | Tonal fills, selected chips |
| on-primary-container | `#001B3D` | Text on primary container |
| secondary | `#555F71` | Less emphasis actions |
| secondary-container | `#D9E3F8` | Chips, tonal buttons |
| tertiary | `#8B5000` | Medal / accent moments (amber family) |
| tertiary-container | `#FFDCBE` | Soft accent surfaces |
| error | `#BA1A1A` | Errors, destructive |
| outline | `#74777F` | Borders |
| outline-variant | `#C4C6D0` | Dividers |
| gold / silver / bronze | `#C9A227` / `#8E9099` / `#A66B3C` | Leaderboard ranks only (as tertiary accents, not neon) |

### Dark

| Role | Hex |
|------|-----|
| surface | `#121318` |
| on-surface | `#E3E2E8` |
| surface-container | `#1E1F25` |
| primary | `#A9C7FF` |
| on-primary | `#002F6C` |
| primary-container | `#00429A` |
| on-primary-container | `#D6E3FF` |

**Rules:** Use surface-container steps for depth — not drop-shadow stacks. Prefer state layers (`primary` at 8%/12% opacity) for hover/focus. Do not use Arena Night `#050505` / cyan `#22D3EE` / Syne.

## Typography

- **Brand / display:** Roboto Flex or Roboto (Google Fonts) — M3 type scale
- **Plain / UI:** Roboto
- Emphasized styles (Expressive): heavier weight for headlines, CTAs, selected nav labels, podium names
- Scale (baseline): Display Large 57/64, Headline Large 32/40, Title Large 22/28, Body Large 16/24, Label Large 14/20
- Emphasized: same sizes, higher weight (≈700 vs 400/500)

## Shape

- Extra-small 4px · Small 8px · Medium 12px · Large 16px · Extra-large 28px
- Buttons: full pill for prominent primary (Expressive), or large (16–20px) corner for filled
- Cards: 12–16px
- Navigation bar / FAB: circular / pill per M3

## Elevation & depth

Prefer **tonal elevation** (surface-container levels) over heavy Material 2 shadows. Soft ambient shadow only on FAB / modal if needed (`0 1px 3px rgba(0,0,0,0.15)`).

## Components (must look Material)

- **Top app bar** — surface tint, 64px, title + actions
- **Navigation bar** (judge mobile) — 80px, active indicator pill on icon, Label Large emphasized when selected
- **Navigation rail / drawer** (admin) — active item: secondary-container or primary-container tonal
- **Filled button** — primary container, pill; **Filled tonal** for secondary; **Outlined** / **Text** as needed
- **FAB** — optional primary action (e.g. Start judging, New event)
- **Cards** — surface-container-lowest, no harsh border; optional outline-variant
- **Chips** — filter/suggestion for status (active, pending)
- **Dialogs** — M3 dialog shape for submit confirm
- **Lists** — one-line / two-line with trailing icons

## Layout patterns per surface

**Landing:** Material marketing — large Display/Headline emphasized brand “YoYo League”, body support, filled Sign In; feature moments as tonal cards or list — soft, friendly, not cinematic black.

**Leaderboard:** Surface stage; Live chip with primary; podium using tertiary/gold containers; ranked list as M3 list items.

**Judge home:** Top app bar + Navigation bar; pending/completed as tonal stat cards; divisions as clickable list rows; optional FAB “Score next”.

**Scoring:** Large touch targets; filled tonal steppers; sticky bottom bar with filled Submit + tonal Save; totals in primary-container.

**Admin:** Top app bar + Navigation rail/drawer; metric cards on surface-container; recent events as M3 list.

## Motion (Expressive)

- Springy enter/exit (emphasized easing)
- Nav active indicator morph
- Button press: brief scale (~0.96)
- Respect `prefers-reduced-motion`

## Fidelity rule

Use ONLY Material 3 Expressive tokens, Roboto, tonal surfaces, and component patterns above. Do not introduce Arena Night dark/cyan styling, Syne, purple-only demo aesthetics unless mapping to primary roles, or non-Material card-grid SaaS layouts.
