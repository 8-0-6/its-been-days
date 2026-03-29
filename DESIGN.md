# It's Been Days — Design System

_Extracted from `extension/overlay/overlay.css` and `extension/overlay/overlay-standalone.css`._
_Update this file whenever a new token or component pattern is introduced._

> Status note (2026-03-29): parts of this design doc reference legacy paywall/subscription states.
> Current product model is free + optional tip jar.

---

## Philosophy

Restrained, tool-like, slightly dark-humoured. No bright fills, no gamification, no clutter. The extension should feel like something a developer would trust. Personality lives in copy, not decoration.

---

## Color Tokens

### Brand / Interactive

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--indigo-500` | `#6366f1` | `#818cf8` | Primary buttons, caret, back button text, toggle on-state, slider thumb |
| `--indigo-600` | `#4f46e5` | — | Primary button hover |

### Semantic

| Token | Value | Usage |
|-------|-------|-------|
| `--green` | `#22c55e` | Open-tab dot, Keep button hover border |
| `--green-dark` | `#16a34a` | Keep button hover text, success messages |
| `--amber` | `#f59e0b` | Stale tab border, badge background, trial-warn text, close-all button |
| `--red` | `#ef4444` | Close/delete button hover, destructive actions |
| `--red-hover-bg` | `#fee2e2` | Delete button hover background |

### Dot indicators (overlay list)

| Dot class | Color | Meaning |
|-----------|-------|---------|
| `.ibd-dot--open` | `#22c55e` green | Tab is currently open |
| `.ibd-dot--archived` | `#d1d5db` grey (`#4b5563` dark) | Tab is in archive (closed) |

### Status badges (settings / account)

| Class | Background | Usage |
|-------|-----------|-------|
| `.ibd-badge-trial` | `#f59e0b` amber | Trial active |
| `.ibd-badge-active` | `#22c55e` green | Paid subscriber |
| `.ibd-badge-expired` | `#ef4444` red | Trial expired, not subscribed |

### Surface colors

| Role | Light | Dark |
|------|-------|------|
| Panel background | `#ffffff` | `#1c1c1e` |
| Backdrop overlay | `rgba(0,0,0,0.45)` | `rgba(0,0,0,0.60)` |
| Section card background | `#fff` | `#1c1c1e` |
| Section card border | `#ebebeb` | `#2c2c2e` |
| Hover row | `#f7f7fb` | `#2a2a2c` |
| Active (keyboard) row | `#eef0fd` | `#26263a` |
| Undo toast background | `#1f2937` | — (same in dark) |
| Import card background (onboarding) | `#f9f9fb` | `#2c2c2e` |

### Text colors

| Role | Light | Dark |
|------|-------|------|
| Primary text | `#111` | `#f0f0f0` |
| Muted text | `#888` | `#666` |
| URL / secondary | `#999` | `#666` |
| Section label (caps) | `#bbb` | `#444` |
| Placeholder | `#aaa` | `#555` |

### Trial banners

| State | Background | Text | Border |
|-------|-----------|------|--------|
| Normal (>5d left) | `#eff6ff` blue-50 | `#1d4ed8` | `#dbeafe` |
| Warning (≤5d, `.ibd-trial-warn`) | `#fffbeb` amber-50 | `#92400e` | `#fde68a` |
| Danger (≤1d, `.ibd-trial-danger`) | `#fef2f2` red-50 | `#991b1b` | `#fecaca` |
| Dark: normal | `#172554` | `#93c5fd` | `#1e3a8a` |
| Dark: warning | `#3d2e00` | `#fcd34d` | `#4d3900` |
| Dark: danger | `#3d0000` | `#fca5a5` | `#5a0000` |

---

## Typography

**Font stack:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`
No custom fonts — keeps the extension lightweight and instant.

| Role | Size | Weight | Notes |
|------|------|--------|-------|
| Search input | 15px | 400 | Main header input |
| Row title (`.ibd-title`) | 13px | 500 | Tab name, truncated with ellipsis |
| Row URL (`.ibd-url`) | 11px | 400 | Hostname + path |
| Row age badge (`.ibd-age`) | 11px | 500 | "3d", "Just visited", etc. |
| Section header | 11px | 600 | All-caps, `letter-spacing: 0.5px` |
| Onboarding title | 15px | 600 | First-run welcome headline |
| Onboarding bullets | 13px | 400 | `line-height: 1.5` |
| Settings label (caps) | 11px | 600 | All-caps section titles |
| Settings body text | 13px | 400 | Toggle labels, slider labels |
| Settings muted note | 12px | 400 | Helper text below inputs |
| Button text | 12px | 500 | `.ibd-btn` base size |
| ESC / kbd hint | 11px | 500 | Keyboard shortcut labels |
| Status badge | 10px | 600 | Account status pill |
| Undo toast | 12px | 400 | — |

---

## Spacing Scale

The UI uses an informal 4px base grid. Common values in use:

| Value | Common usage |
|-------|-------------|
| 4px | Button padding vertical, gap in header |
| 6px | Kbd padding, age badge padding, button padding horizontal (small) |
| 8px | Row gap, section divider margin, slider margin |
| 10px | Row gap between elements |
| 12px | Standard button height (30px = 6px × 5 implied), horizontal button padding |
| 14px | Toast padding, close footer padding |
| 16px | Row padding horizontal, settings body horizontal padding |
| 20px | Onboarding body padding horizontal |
| 28px | Overlay top padding (`14vh` approximately) |

---

## Border Radius

| Value | Usage |
|-------|-------|
| 4px | Age badge, kbd, keep button, small ghost buttons |
| 5px | Delete button, back button, settings button hover |
| 6px | Primary/ghost/destructive buttons (`.ibd-btn`) |
| 8px | Settings section cards, onboarding import card |
| 12px | Overlay panel |

---

## Shadows

| Component | Value |
|-----------|-------|
| Overlay panel (light) | `0 24px 64px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.06)` |
| Overlay panel (dark) | `0 24px 64px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.07)` |
| Slider thumb | `0 1px 3px rgba(0,0,0,0.2)` |
| Toggle knob | `0 1px 3px rgba(0,0,0,0.2)` |

---

## Component Vocabulary

### Buttons

| Class | Appearance | Use case |
|-------|-----------|---------|
| `.ibd-btn-primary` | Indigo fill, white text | Subscribe, Get started, Send magic link |
| `.ibd-btn-ghost` | Transparent, grey border | Sign out, Manage subscription, Cancel |
| `.ibd-btn-destructive` | Transparent, grey border, red text | Clear archive (idle state) |
| `.ibd-btn-destructive-sm` | Red fill, white text, h26 | "Yes, delete everything" confirm |
| `.ibd-btn-ghost-sm` | Transparent, grey border, h26 | "Cancel" in confirm flows |
| `.ibd-keep` | Transparent, grey border, h22 | Keep tab (appears on stale rows on hover/active) |
| `.ibd-close-all-btn` | Amber border, amber text, full width | "Close N suggested tabs" footer |
| `.ibd-undo-btn` | Dark background, grey border | Undo inside toast |

All `.ibd-btn` variants share: `height: 30px`, `font-family: inherit`, `font-weight: 500`, `border-radius: 6px`, `white-space: nowrap`, `cursor: pointer`, `transition: background 0.12s`.

Disabled state: `opacity: 0.5; cursor: not-allowed` (applies to all via `.ibd-btn:disabled`).

### Row variants

| Class | Visual |
|-------|--------|
| `.ibd-row` | Default: `padding: 8px 16px`, min-height 46px |
| `.ibd-row:hover` | Light purple-grey tint |
| `.ibd-row--active` | Indigo-tinted background (keyboard navigation) |
| `.ibd-row--suggested` | Amber 6% tint background; title text muted to `#888` |

### Dots

8×8px circle, `flex-shrink: 0`. Green = open, grey = archived.

### Age badges

`background: #f3f4f6`, `border-radius: 5px`, `padding: 2px 6px`. Show "Just visited", "3d", "2h", "15m".

### Section headers / dividers

- Header: 11px, 600 weight, all-caps, `#bbb`, `padding: 8px 16px 4px`
- Divider: 1px `#f0f0f0` line, `margin: 4px 0`

### Toggle switch

Custom CSS toggle. Unchecked: `#d1d5db` track. Checked: `#6366f1` track. Knob: 15×15px white circle with shadow, slides 17px on check.

### Skeleton loading rows

Two stacked bars per row: title (60% width, 10px tall) + URL (40% width, 8px tall). `@keyframes ibd-shimmer` — gradient sweep `#f0f0f0 → #e8e8e8 → #f0f0f0`, 1.4s infinite. Dark mode: `#2c2c2e / #3a3a3c`.

### Paywall banner

Amber-50 background strip below the search header. Inline link to subscribe. Same visual weight as trial-warn banner.

### Undo toast

Dark (`#1f2937`) strip pinned to bottom of panel. Flex row: message text + Undo button. Auto-dismisses after 5 seconds.

### Onboarding view

Full-height replacement of the results area (header stays visible). Contains: headline (15px/600), 3 bullet points with indigo dots, import card (grey border, white bg), "Get started" primary button.

---

## Overlay dimensions

| Surface | Size |
|---------|------|
| Content-script overlay panel | `560px wide × max 520px tall` |
| Standalone popup window | `560px × 560px` |
| Backdrop padding-top | `14vh` (centers panel in upper third) |

---

## Dark mode

All dark mode overrides use `@media (prefers-color-scheme: dark)`. No manual toggle — respects system preference only.

Key substitutions:
- White surfaces → `#1c1c1e`
- Light grey borders → `#2c2c2e` or `#3a3a3c`
- `#111` text → `#f0f0f0`
- `#999`/`#888` muted → `#666`
- `#f3f4f6` age badge bg → `#2c2c2e`
- Hover rows → `#2a2a2c` / active → `#26263a`
- Indigo accent for focus: `#818cf8` (lighter variant)

---

## Animation

| Animation | Duration | Usage |
|-----------|---------|-------|
| Row background transition | 80ms | Hover state change |
| Button background transition | 120ms | All button hover states |
| Keep button border/color transition | 100ms | Hover |
| Delete button opacity/color transition | 100ms | Show on row hover |
| Toggle track transition | 200ms | Checkbox on/off |
| Toggle knob transform | 200ms | Slide knob |
| Shimmer sweep | 1.4s infinite linear | Skeleton loading rows |

No entry/exit animations on the overlay — it appears and disappears instantly to feel like a native tool, not a web app.

---

## Copy tone

Slightly wry, never preachy. Lead with user outcome.

| Context | Copy |
|---------|------|
| Empty state (no stale) | "All caught up. Enjoy it while it lasts." |
| First-run headline | "Your tabs have been quietly aging. Now you'll know." |
| Onboarding bullets | "Track how long tabs have been open / Close stale ones in one place / Reopen anything from your archive" |
| Post-trial banner | "Tracking paused. Subscribe to re-enable →" |
| Notification title | "It's Been Days 👀" |
| Notification body | "You have N tabs that haven't been visited in over X days. Want to clean up?" |

---

_Last updated: 2026-03-29. Update whenever a new token, component, or animation is introduced._
