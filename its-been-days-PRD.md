# Product Requirements Document
## It's Been Days — Tab Inactivity Tracker & Archive for Chrome

> Status note (2026-03-29): this PRD is a historical draft and contains legacy subscription language.  
> Current shipping model is free + optional tip jar, with no required account flow.
> Update note (2026-03-30): legacy Supabase + Stripe implementation files were removed from the repository.
> Any payment/backend references below are historical context only and are not active.

**Version:** 1.0
**Author:** Bob
**Last Updated:** March 2026
**Status:** Draft

**Product:** Chrome extension
**Distribution:** Chrome Web Store
**Pricing:** 30-day free trial → $5/month

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement](#2-problem-statement)
3. [Competitive Landscape](#3-competitive-landscape)
4. [Target User](#4-target-user)
5. [Goals & Success Metrics](#5-goals--success-metrics)
6. [Scope](#6-scope)
7. [User Flow](#7-user-flow)
8. [Core Features — Functional Requirements](#8-core-features--functional-requirements)
9. [The Fn Key Overlay](#9-the-fn-key-overlay)
10. [Notification System](#10-notification-system)
11. [Archive Spec](#11-archive-spec)
12. [Settings Page](#12-settings-page)
13. [Monetisation & Paywall Logic](#13-monetisation--paywall-logic)
14. [Data Model](#14-data-model)
15. [Technical Architecture](#15-technical-architecture)
16. [UI & Design Spec](#16-ui--design-spec)
17. [Build Plan](#17-build-plan)
18. [Out of Scope](#18-out-of-scope)
19. [Open Questions](#19-open-questions)

---

## 1. Overview

"It's Been Days" is a lightweight Chrome extension that tracks how long each of your open tabs has been inactive, ranks them by inactivity, suggests which ones to close, archives their URLs when closed, and lets you instantly retrieve any archived tab via a keyboard-triggered overlay — switching to it if still open, or reopening it if closed.

The product lives entirely within Chrome. It has no Dock icon, no full-window UI, and no external web app. The only visible surface is a small toolbar icon and a popup panel. The Fn key overlay is the signature interaction.

The name reflects the product's personality: gently accusatory, slightly funny, immediately understood.

---

## 2. Problem Statement

The average person keeps 10+ browser tabs open at any given time. Power users keep 30–100. A significant portion of those tabs haven't been visited in days or weeks — they represent deferred intentions, articles meant to read later, tasks meant to return to.

The pain has two distinct parts:

**Part 1 — The accumulation problem.** Open tabs pile up silently. There is no native Chrome mechanism that tells you how long a tab has been sitting there unvisited. Without visibility into inactivity, people never close tabs because they're not sure if they still need them.

**Part 2 — The retrieval problem.** When someone does close a tab — intentionally or accidentally — Chrome's native history is a flat, undifferentiated list of every URL visited. Finding a specific closed tab requires knowing roughly when you visited it and scrolling through hundreds of entries. There is no search-and-switch experience.

"It's Been Days" solves both. It makes inactivity visible and actionable, and makes retrieval instant.

---

## 3. Competitive Landscape

| Product | Inactivity tracking | Ranked view | Smart close suggestions | Archive + search | Keyboard retrieval | Monetisation |
|---------|--------------------|-----------|-----------------------|------------------|--------------------|-------------|
| OneTab | No | No | No | Basic list | No | Free |
| TheTab | No | No | No | Search + date groups | No | Free |
| Tab Wrangler | Auto-close timer | No | No | Basic corral | No | Free |
| Toby | No | No | No | Visual collections | No | $9/mo |
| **Chrome Tab Organizer (native)** | No | No | No | No | No | Free (built-in) |
| **It's Been Days** | **Yes** | **Yes — by inactivity** | **Yes** | **Yes — forever** | **Yes — keyboard overlay** | **$5/mo** |

The keyboard overlay with smart switch-or-reopen behaviour is the clearest differentiator. No existing tool does this.

**Differentiation from Chrome's native AI Tab Organizer (2025/2026):** Chrome groups open tabs by content similarity — it solves organisation. "It's Been Days" tracks staleness over time and enables instant retrieval of *closed* tabs — a different job, a different emotional axis. Marketing copy and onboarding must make this distinction explicit, or the product will be perceived as a duplication of built-in features.

---

## 4. Target User

**Primary persona: The Tab Hoarder**
- Uses Chrome as their primary browser
- Consistently has 20–60+ tabs open
- Routinely loses track of tabs they meant to return to
- Has accidentally closed something important and couldn't find it
- Not a power user — doesn't want to configure a complex system
- Age: 20–40, professional or student context

**Secondary persona: The Focused Worker**
- Fewer tabs (10–20) but values clean, intentional browser sessions
- Wants to know when something has been sitting untouched for too long
- Appreciates the nudge to close rather than hoard

---

## 5. Goals & Success Metrics

| Goal | Metric | Target at 90 days |
|------|--------|-------------------|
| Activation | % of installs who keep the extension after day 3 | > 60% |
| Core engagement | % of active users who use Fn overlay at least once per week | > 40% |
| Trial conversion | % of trial users who convert to paid at day 30 | > 5% (industry baseline for Chrome extensions is 2–5%) |
| Paid retention | Monthly churn of paid subscribers | < 8% |
| Growth | New installs per week (organic) | > 100 by month 2 |

---

## 6. Scope

### In scope for v1

- Tab inactivity tracking (time since last visited, tracked continuously in background)
- Inactivity-ranked tab list in toolbar popup
- All open tabs treated equally — no special exclusions for tab groups (pinned tabs and tabs playing audio excluded from suggestions only)
- Close suggestions based on inactivity threshold
- One-click "close all suggested" with automatic URL archiving
- Individual tab close from popup, with URL archived
- Fn key overlay — search box + recent archived tabs beneath
- Smart switch-or-reopen behaviour from overlay
- Desktop notification after 10 days of tab inactivity (configurable)
- Archive stored forever until manually deleted
- ArchiveSync — optional, opt-in Supabase-backed cloud archive sync (paid feature, included in $5/month subscription)
- Minimal settings page (notifications on/off + threshold + ArchiveSync toggle)
- 30-day free trial, no credit card required
- $5/month subscription via Stripe
- Post-trial paywall: tracking stops, archive stays viewable forever
- Soft launch via unpacked extension to beta users during Chrome Web Store review

### Out of scope for v1

- Cross-device sync
- Web dashboard / companion web app
- Tab grouping or organisation features
- AI-powered categorisation of tabs
- Team or shared features
- Firefox / Edge / Safari support
- Mac menu bar app
- Export of archive
- Mobile

---

## 7. User Flow

```
Install extension
        ↓
First-run onboarding (one screen — explains the 3 core ideas:
inactivity tracking, close suggestions, Fn retrieval)
        ↓
30-day trial begins automatically — no credit card
        ↓
Extension runs silently in background
        ↓
    ┌───────────────────────────────┐
    │     Two entry points          │
    └───────────────────────────────┘
         │                    │
    Toolbar icon          Fn key held
    click                      │
         │               Overlay appears
    Popup opens          (search + archive)
         │
    Ranked tab list
    (sorted by inactivity,
    longest inactive first)
         │
    Suggested tabs
    highlighted in amber
         │
    "Close all suggested"
    button → URLs archived,
    tabs closed
         │
    Or: close individual tabs
    from the list
```

---

## 8. Core Features — Functional Requirements

### 8.1 Inactivity tracking

The extension tracks the last time each open tab was the active, focused tab in the browser. This is recorded as a timestamp per tab.

- Tracking begins the moment the extension is installed
- Every tab that is navigated to updates its `last_visited` timestamp
- Tabs that have never been visited since install show "opened X days ago" with a note "not yet visited"
- Inactivity = time elapsed since `last_visited`
- Pinned tabs are tracked but not suggested for closure (they are excluded from suggestions)
- Tabs playing audio are tracked but not suggested for closure while audio is playing

### 8.2 Popup — inactivity-ranked tab list

The main UI surface. Opens when clicking the toolbar icon.

**Layout:**
- Header: "It's Been Days" wordmark + settings gear icon (small, top right)
- Trial countdown banner (visible until trial ends): "X days left in your trial"
- Tab list: all open tabs sorted by inactivity, longest inactive first
- Each tab row shows:
  - Favicon
  - Page title (truncated at 40 chars)
  - Inactivity label: "3 days inactive", "12 days inactive", "Just visited"
  - Close button (×) on hover
- Suggested tabs (inactive beyond threshold) are visually highlighted — amber left border, slightly muted title
- "Close X suggested tabs" button at the bottom — closes all highlighted tabs and archives their URLs
- Count badge on toolbar icon showing number of suggested tabs (e.g. "7")

### 8.3 Close behaviour

When a tab is closed from the popup (individually or via "close all suggested"):
- The tab's URL, title, favicon URL, and timestamp are written to the archive in `chrome.storage.local`
- The tab is removed from Chrome
- The popup list updates immediately
- A subtle undo toast appears for 5 seconds: "Closed 7 tabs. Undo?" — clicking undo: `chrome.tabs.create({ url })` for each entry, deletes those entries from the archive. Undo state stored in `chrome.storage.session` (clears on browser close).

**Tabs closed outside the popup** (Cmd+W, clicking the ×, closing windows) are also archived via `chrome.tabs.onRemoved`, including on window close. The "safe to close" promise is unconditional — the archive always captures a tab when it disappears, regardless of how it was closed.

### 8.4 Suggestion logic

A tab is flagged as "suggested for closure" when:
- It has not been visited (focused) for 10 or more days (default threshold, configurable in settings)
- AND it is not pinned
- AND it is not currently playing audio

The threshold is the same value used for desktop notifications. Changing one changes both.

---

## 9. The Fn Key Overlay

The signature feature. Triggered by holding the Fn key (on Mac) or a configurable shortcut on Windows.

### 9.1 Trigger

The overlay is triggered via the **Chrome Commands API** — not a content script keydown listener. The Fn key does not fire reliable keydown events in Chrome on Mac, making it unsuitable as a trigger mechanism.

**Implementation:**

```json
// manifest.json
"commands": {
  "toggle-overlay": {
    "suggested_key": {
      "mac": "Command+Shift+Space",
      "windows": "Ctrl+Shift+Space",
      "linux": "Ctrl+Shift+Space"
    },
    "description": "Open the It's Been Days tab search overlay"
  }
}
```

```js
// background.js (service worker)
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-overlay') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? '';
  const isInjectable = url &&
    !url.startsWith('chrome://') &&
    !url.startsWith('chrome-extension://') &&
    !url.startsWith('about:') &&
    !url.endsWith('.pdf');
  if (isInjectable) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
    } catch {
      // Content script not yet injected — inject on demand, then message
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['overlay/overlay.js']
      });
      await new Promise(r => setTimeout(r, 50)); // wait for listener to register
      await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
    }
  } else {
    // Fallback for non-injectable tabs (chrome://, PDFs, New Tab page)
    chrome.windows.create({
      url: chrome.runtime.getURL('overlay/overlay-standalone.html'),
      type: 'popup', width: 560, height: 400
    });
  }
});
```

**Shortcut conflict warning:** Cmd+Shift+Space is commonly claimed by Alfred, Raycast, and other launchers. The onboarding screen must include: "If the shortcut doesn't work, another app may be claiming it — visit chrome://extensions/shortcuts to remap." Document this in the Chrome Web Store listing under Known Issues.

- The shortcut is user-remappable at `chrome://extensions/shortcuts`
- Pressing Escape or clicking outside dismisses the overlay

### 9.2 Overlay layout

A centred, floating panel. Not full-screen. Dimensions approximately 560px wide × 400px tall, vertically centred on screen.

```
┌──────────────────────────────────────────┐
│  🔍  Search tabs...                       │
├──────────────────────────────────────────┤
│  Recently archived                        │
│  ○  How to cook risotto — 2 hours ago    │
│  ○  Y Combinator application — 1 day ago │
│  ○  Figma login — 3 days ago             │
│  ○  ECON4200 paper draft — 5 days ago    │
│  ○  Airbnb Tokyo listings — 8 days ago   │
└──────────────────────────────────────────┘
```

- Top: search input, autofocused on open
- Below: scrollable list of recently archived tabs, most recent first (up to 20 shown before scrolling)
- Each row: favicon + title + time since archived
- Typing in the search box filters both the archived list AND currently open tabs in real-time

### 9.3 Switch-or-reopen behaviour

When the user clicks a result or hits Enter on a highlighted result:

- **If the tab is currently open:** Chrome switches focus to that tab. Overlay closes.
- **If the tab is closed (in archive):** A new tab opens with that URL and Chrome focuses it. The entry remains in the archive (it is not removed on reopen — archive is permanent until manually deleted).

The distinction is shown visually in the overlay:
- Open tabs show a green dot indicator
- Archived (closed) tabs show a grey dot

### 9.4 Keyboard navigation

- Arrow keys navigate the list
- Enter selects
- Escape closes the overlay
- The search box stays focused — typing immediately filters without needing to click

---

## 10. Notification System

### 10.1 Trigger condition

A desktop notification fires when a tab has not been visited for 10 consecutive days (default). The threshold is configurable in settings (range: 1–30 days).

### 10.2 Notification content

- **Title:** "It's Been Days 👀"
- **Body:** "You have [N] tabs that haven't been visited in over [threshold] days. Want to clean up?"
- **Action button:** "Open extension"

One notification per day maximum, regardless of how many tabs are over threshold. No per-tab spam.

### 10.3 Notification behaviour

- Clicking the notification or the action button opens the extension popup
- The notification is dismissed automatically after 8 seconds if not interacted with
- If the user has no tabs over threshold, no notification fires that day
- Notifications can be turned off entirely in settings

---

## 11. Archive Spec

### 11.1 What is stored per entry

```
{
  id:           string (UUID),
  url:          string,
  title:        string,
  favicon_url:  string,
  archived_at:  timestamp,
  last_visited: timestamp (at time of closure),
  days_inactive: number (at time of closure)
}
```

### 11.2 Storage

All archive data is stored in `chrome.storage.local`. No external server, no account required during trial. Data lives on the user's device.

**Storage quota:** Max 500 archive entries (FIFO eviction — oldest `archived_at` entry dropped when limit exceeded). At ~400 bytes per entry (URL strings + metadata, favicon stored as URL not blob), this is ~200KB. Total storage including `tabs_metadata` and subscription cache stays well under Chrome's 5MB default limit.

**Do not request `unlimitedStorage`.** It is a sensitive permission that increases Chrome Web Store review scrutiny and appears in the user-facing permissions dialog. The 500-entry cap makes it unnecessary. Revisit for v1.1 if ArchiveSync requires bulk sync.

**Favicon storage:** Store `favIconUrl` as a URL string only — never as a blob or data URI. Fetch lazily at render time via the tab object or `chrome.tabs.get`. This keeps storage small and avoids quota issues from large data URIs.

**Deduplication:** Allow duplicate URLs in the archive. If a user closes the same URL twice, create two separate entries. Show all entries sorted by `archived_at` descending. Simple and matches user expectation ("I closed it twice, I see it twice").

### 11.3 Retention policy

Archive entries are stored forever until the user manually deletes them. There is no auto-expiry. The archive is the product — it must be trustworthy and permanent.

Manual deletion: users can delete individual entries from the overlay by hovering and clicking a delete (×) button. Bulk delete is out of scope for v1.

### 11.4 Post-trial archive access

If a user's trial expires and they do not subscribe:
- Tracking stops immediately (no new inactivity data collected)
- The popup no longer shows the ranked tab list
- The keyboard overlay remains accessible in read-only mode — they can search and reopen archived tabs
- **Archive writes via `onRemoved` continue regardless of subscription status** — tabs closed by any means are still archived locally. "Your archive is safe" is unconditional.
- A banner in the overlay: "Tracking paused. Subscribe to re-enable live tab tracking."

**Feature gate matrix:**

| Feature | Trial | Paid | Expired (unpaid) |
|---------|-------|------|-----------------|
| Inactivity tracking | ✓ | ✓ | ✗ (stops) |
| Badge count | ✓ | ✓ | ✗ (hidden) |
| Popup ranked list | ✓ | ✓ | ✗ (upgrade prompt) |
| Close + archive (popup action) | ✓ | ✓ | ✗ |
| Archive writes via onRemoved | ✓ | ✓ | ✓ (always) |
| Overlay — search + reopen | ✓ | ✓ | ✓ (read-only) |
| Desktop notifications | ✓ | ✓ | ✗ |
| ArchiveSync | — | v1.1 | — |

This is the core paywall philosophy: we never hold their data hostage. We just stop providing new value until they pay.

---

## 12. Settings Page

Minimal. Accessible via the gear icon in the popup header. Opens as a new Chrome tab at `chrome-extension://[id]/settings.html`.

### Settings available

**Notifications**
- Toggle: Enable desktop notifications (default: on)
- Slider or number input: Notify me after [ ] days of inactivity (default: 10, range: 1–30)
- Note: this same threshold controls which tabs are flagged as "suggested" in the popup

**Account**
- Email address (shown once logged in / subscribed)
- Subscription status: "Trial — X days remaining" / "Active" / "Expired"
- "Manage subscription" link → Stripe customer portal

**Archive**
- Count of archived tabs: "You have 247 archived tabs"
- "Clear all archived tabs" button — with a confirmation dialog. Irreversible.

Nothing else. No theme toggles, no layout options, no tab group settings. The product should work perfectly out of the box with zero configuration.

---

## 13. Monetisation & Paywall Logic

### 13.1 Trial

- 30 days from the moment of install
- No credit card required to start
- All features fully unlocked during trial
- Trial countdown shown in popup header: "28 days left in trial"
- Day 25: amber banner in popup: "Your trial ends in 5 days"
- Day 29: red banner: "Your trial ends tomorrow"

### 13.2 Subscription

- $5/month, billed monthly via Stripe
- Cancel anytime
- No annual plan in v1
- No free tier after trial (archive remains readable, tracking stops)

### 13.3 Post-trial states

| State | What user experiences |
|-------|----------------------|
| Trial active | Full access, countdown in header |
| Trial expired, unpaid | Tracking stopped, popup shows upgrade prompt, overlay is read-only archive search only |
| Subscribed, active | Full access, no banners |
| Subscription cancelled | Full access until end of billing period, then same as expired |
| Payment failed | 3-day grace period (Stripe retry), then same as expired |

### 13.4 Account & auth

A lightweight account is needed to tie the subscription to the user across reinstalls. Implementation: email + magic link (no password). User enters their email in the popup when prompted to subscribe → receives a magic link → clicks it → logged in. Stripe customer is created at this point.

Auth handled via Supabase (email magic link). Subscription status stored in Supabase, synced to extension on startup and on each popup open.

**Stripe webhook:** Implemented as a Supabase Edge Function at `/functions/stripe-webhook`. Handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Verifies Stripe signature via `Stripe-Signature` header + webhook secret (stored as `supabase secrets set STRIPE_WEBHOOK_SECRET=...`). Required setup steps before end-to-end payment works:
1. `supabase functions deploy stripe-webhook`
2. Register the Edge Function URL in Stripe Dashboard → Webhooks
3. Copy the signing secret from Stripe Dashboard into Supabase secrets

---

## 14. Data Model

### Local (chrome.storage.local — on device)

```
tabs_metadata: {
  [tabId: string]: {
    url: string,
    title: string,
    favicon_url: string,
    opened_at: timestamp,
    last_visited: timestamp,
    days_inactive: number   // computed, updated daily
  }
}

archive: {
  [entryId: string]: {
    id: string,
    url: string,
    title: string,
    favicon_url: string,
    archived_at: timestamp,
    last_visited: timestamp,
    days_inactive: number
  }
}

settings: {
  notifications_enabled: boolean,   // default: true
  notification_threshold: number,   // default: 10
}

trial: {
  install_date: timestamp,
  trial_ends_at: timestamp,
}
```

### Remote (Supabase)

```sql
CREATE TABLE users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT UNIQUE NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  trial_start          TIMESTAMPTZ NOT NULL,  -- copied from local install_date on first login
  status               TEXT NOT NULL DEFAULT 'trial',  -- 'trial' | 'active' | 'past_due' | 'cancelled'
  stripe_customer_id   TEXT
);
```

**Subscription status in extension:** Cached in `chrome.storage.local` under the key `subscription_status` as `{ status, cached_at }`. Cache TTL: 5 minutes. On popup open, if cache is stale, re-fetch from Supabase. Use `subscription_status` as the canonical key name everywhere.

**Pre-login bootstrap:** Users who never subscribe have no Supabase row. Trial state is read entirely from `chrome.storage.local.install_date`. No Supabase query is made until the user attempts to subscribe.

**First login:** On magic link auth, if no Supabase row exists yet, create one with `trial_start = chrome.storage.local.install_date` so the 30-day clock is preserved from install, not from login.

No tab data or archive data is ever sent to the server. The server only holds account and subscription status.

---

## 15. Technical Architecture

### Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Extension | Chrome Extension Manifest V3 | Required — only way to access Chrome tab APIs |
| Background logic | Service Worker (background.js) | Tracks tab events, runs daily inactivity check, fires notifications |
| Popup UI | HTML + CSS + vanilla JS | Keeps extension lightweight, no framework overhead |
| Overlay UI | Content script injected into active tab | Renders the Fn key overlay as a DOM overlay |
| Auth + subscription | Supabase | Magic link auth, subscription status only |
| Payments | Stripe Billing | $5/mo subscription, customer portal for management |
| Storage | chrome.storage.local | All tab and archive data, never leaves device |

### Key extension components

```
its-been-days/
├── manifest.json          — permissions, background, content scripts
├── background.js          — service worker: tab event listeners,
│                            inactivity calculation, notification scheduler
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js           — renders ranked tab list, handles close actions
├── overlay/
│   ├── overlay.js         — content script: injects Fn overlay into active tab
│   └── overlay.css
├── settings/
│   ├── settings.html
│   └── settings.js
└── utils/
    ├── storage.js         — wrapper for chrome.storage.local reads/writes
    ├── archive.js         — archive read/write logic
    └── auth.js            — Supabase auth + subscription status check
```

### Permissions required (manifest.json)

```json
"permissions": [
  "tabs",
  "storage",
  "notifications",
  "activeTab",
  "scripting"
],
"host_permissions": ["<all_urls>"]
```

`<all_urls>` is required for the content script (overlay) to inject into any page. Noted clearly in the Chrome Web Store privacy disclosure.

`unlimitedStorage` is intentionally omitted — the 500-entry archive cap keeps total storage well under Chrome's 5MB default limit, and the permission adds CWS review scrutiny and user-facing permission friction for no benefit in v1.

### Background service worker logic

Runs on these events:
- `chrome.tabs.onActivated` → update `last_visited` for the newly active tab
- `chrome.tabs.onCreated` → record `opened_at` for new tab
- `chrome.tabs.onRemoved` → if tab was not closed by the extension itself, still archive it
- `chrome.tabs.onUpdated` → update URL/title if tab navigates
- Daily alarm (`chrome.alarms`) → recalculate `days_inactive` for all tabs, check notification threshold

### Fn key detection

The content script listens for `keydown` events. On Mac, the Fn key does not fire a standard `keydown` event in most browsers. The workaround: detect `Fn` via the `keydown` event's `key` property on supported configurations, or use a fallback shortcut (Cmd+Shift+Space on Mac, Ctrl+Shift+Space on Windows) with a note in onboarding explaining the keyboard shortcut.

This is a known limitation of web-based Fn key detection and should be documented honestly in the onboarding screen and Chrome Web Store listing.

---

## 16. UI & Design Spec

### Visual style

Clean, minimal, slightly dark-humoured in copy. The product has personality — the name is "It's Been Days" — but the UI itself is restrained. No bright colours, no gamification, no clutter. It should feel like a tool a developer would trust, not a productivity app trying too hard.

### Colour palette

- Background: #1A1A1A (dark) or #FAFAFA (light) — respects system preference
- Text primary: #F0F0F0 / #111111
- Text muted: #888888
- Accent / suggested tabs: amber — #F59E0B (border only, not fill)
- Destructive / close: #EF4444 (on hover only)
- Green dot (open tab in overlay): #22C55E
- Grey dot (archived tab in overlay): #6B7280

### Popup dimensions

320px wide × auto height (max 500px, scrollable). Standard Chrome extension popup width.

### Overlay dimensions

560px wide × 400px tall, centred on screen. Slight backdrop blur on the page behind it (via CSS `backdrop-filter`). Rounded corners (12px). Subtle drop shadow.

### Typography

System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. No custom fonts — keeps the extension lightweight and fast.

### Copy tone

Slightly wry, never preachy. Examples:

- Empty state (no suggested tabs): "All clear. Enjoy it while it lasts."
- Many suggested tabs: "These [N] tabs haven't been visited in over [X] days. It's been a while."
- Post-trial upgrade prompt: "Tracking paused. Your archive is safe — subscribe to start tracking again."
- Onboarding headline: "Your tabs have been quietly aging. Now you'll know."

---

## 17. Build Plan

Target: **4–5 days** for a working, submittable v1.

### Day 1 — Core tracking + popup

| Task | Est. time |
|------|-----------|
| Project setup: manifest.json, file structure, load unpacked in Chrome | 1h |
| Background service worker: tab event listeners (onActivated, onCreated, onRemoved, onUpdated) | 2h |
| Storage utils: read/write tab metadata to chrome.storage.local | 1h |
| Daily alarm: recalculate days_inactive for all tabs | 1h |
| Popup: render inactivity-ranked tab list from storage | 2h |

**Day 1 exit:** Extension installs, tracks tab activity in background, popup shows ranked list.

---

### Day 2 — Close, archive, and suggestions

| Task | Est. time |
|------|-----------|
| Suggestion logic: flag tabs inactive beyond threshold | 1h |
| Amber highlighting for suggested tabs in popup | 30min |
| Individual tab close from popup → archive entry written | 1h |
| "Close all suggested" button → batch close + archive | 1h |
| Undo toast (5 second window, reopens tabs, removes archive entries) | 1.5h |
| Archive storage + retrieval utils | 1h |

**Day 2 exit:** Full close + archive flow working end-to-end.

---

### Day 3 — Fn overlay + notifications

| Task | Est. time |
|------|-----------|
| Commands API trigger: manifest.json commands entry, background.js onCommand handler, non-injectable tab fallback | 1.5h |
| Overlay UI: search box + recent archived tabs list | 1.5h |
| Real-time search filtering (open tabs + archive) | 1h |
| Switch-or-reopen logic (green/grey dot, switch focus vs open new tab) | 1h |
| Desktop notification: daily alarm check, fire notification if tabs over threshold | 1h |
| Keyboard navigation in overlay (arrows, enter, escape) | 1h |

**Day 3 exit:** Fn overlay working, notifications firing correctly.

---

### Day 4 — Auth, paywall, settings, polish, submit

| Task | Est. time |
|------|-----------|
| Settings page: notifications toggle + threshold input | 1h |
| Trial logic: install_date stored, trial_ends_at calculated, countdown in popup | 1h |
| Supabase setup: users table, magic link auth, first-login row creation | 1.5h |
| Stripe: product + price created, checkout flow from popup upgrade prompt | 1.5h |
| Supabase Edge Function: Stripe webhook handler (signature verification, status update, deploy + register in Stripe Dashboard) | 1.5h |
| Post-trial paywall: disable tracking, show read-only overlay, upgrade prompt | 1h |

**Day 4 exit:** Full subscription flow working end-to-end. CWS submission is Day 5.

---

### Day 5 — Chrome Web Store submission

| Task | Est. time |
|------|-----------|
| Chrome Web Store assets: screenshots (must show overlay interaction), description copy, privacy policy | 2h |
| Submit to Chrome Web Store | — |
| Set up soft launch: distribute unpacked extension to 10–20 beta users while in review | 1h |

**Day 5 exit:** Submitted to Chrome Web Store. Soft launch active during review period (2–4 weeks).

---

### Risk flags

| Risk | Mitigation |
|------|-----------|
| Keyboard shortcut conflict (Alfred, Raycast) | Onboarding copy explains how to remap at chrome://extensions/shortcuts; documented in CWS listing |
| Chrome Web Store review rejection | Clearly document `<all_urls>` usage in privacy policy justification; enhanced review for this permission takes 2–4 weeks |
| chrome.storage.local hitting limits | 500-entry cap with FIFO eviction; no `unlimitedStorage` needed |
| Service worker termination (MV3 limitation) | Use chrome.alarms for scheduled work — alarms wake the service worker reliably |
| Stripe webhook silent failure | Follow 3-step setup: deploy Edge Function, register URL in Stripe Dashboard, set signing secret in Supabase |

---

## 18. Out of Scope

- Cross-device sync beyond ArchiveSync (ArchiveSync covers archive only, not active tab state)
- Companion web dashboard
- Firefox, Edge, or Safari support
- Mac menu bar app (v2 consideration pending user traction)
- AI-powered tab categorisation or suggestions
- Tab grouping or workspace organisation
- Team or shared features
- Export of archive (CSV, JSON)
- Annual billing plan
- Tab age tracking (replaced by inactivity tracking as the primary signal)
- Custom close rules (e.g. "always keep YouTube tabs")
- Bulk archive deletion

---

## 19. Decisions Log

All open questions resolved.

| # | Question | Decision |
|---|----------|----------|
| 1 | Fn key detection fallback shortcut? | **Deferred** — to be decided before Day 3 build. Likely Cmd+Shift+Space on Mac, Ctrl+Shift+Space on Windows. Will document in onboarding. |
| 2 | Should Chrome Tab Group tabs be excluded from close suggestions? | **No** — all tabs treated equally. No special handling for tab groups, pinned status aside. |
| 3 | Optional archive sync for reinstalls? | **Yes — ArchiveSync**, a Supabase-backed cloud sync of the user's archive. Paid feature, included in the $5/month subscription. See section 20. |
| 4 | Launch plan during Chrome Web Store review? | **Soft launch** — distribute unpacked extension to friends and beta users while in review. Collect early feedback before public launch. |
| 5 | Popup vs overlay — keep both surfaces? | **No — retire the popup, keep the overlay only.** Decision made 2026-03-29. The popup (toolbar click) and overlay (Cmd+Shift+Space) were redundant and split the learning curve across two surfaces. The overlay is the superior UI: more space (560px vs 320px), keyboard-native, and capable of showing both open tabs and archive in one place. All popup functionality (ranked tab list, amber suggested highlights, close-suggested with undo, trial banner, settings access) has been moved into the overlay. The toolbar icon now triggers the overlay directly via `chrome.action.onClicked`. The `popup/` directory is retained but the `default_popup` manifest key has been removed. |

---

## 20. ArchiveSync Spec

ArchiveSync is optional, opt-in cloud backup and sync of the user's tab archive via Supabase. It is included in the $5/month subscription — no separate tier needed.

### Why it matters

By default, the archive lives in `chrome.storage.local` — on-device only. If the user reinstalls Chrome, gets a new laptop, or uninstalls and reinstalls the extension, their entire archive is lost. ArchiveSync solves this by keeping a copy in Supabase, tied to their account.

### How it works

- User subscribes and logs in via magic link → account created in Supabase
- In settings, an "Enable ArchiveSync" toggle appears (default: off — explicit opt-in)
- When enabled: all existing archive entries are uploaded to Supabase in a one-time sync
- From that point, every new archive entry (tab closed) is written to both `chrome.storage.local` AND Supabase simultaneously
- On reinstall or new device login: archive is pulled from Supabase and written to local storage — full archive restored

### Data stored in Supabase (archive table)

```
archive_entries
  id              uuid PK
  user_id         uuid FK → users.id
  url             string
  title           string
  favicon_url     string
  archived_at     timestamp
  last_visited    timestamp
  days_inactive   number
  deleted_at      timestamp (soft delete — null if not deleted)
```

Deletions are soft-deleted (deleted_at timestamp set) so they sync correctly across devices rather than leaving orphaned records.

### Privacy

- ArchiveSync is explicitly opt-in — users who do not enable it have zero data sent to the server
- Archive data is stored in Supabase with Row Level Security — users can only access their own records
- Clearly disclosed in the settings page and Chrome Web Store privacy policy

### Settings UI addition

In the settings page, under a new "Sync" section:

- Toggle: Enable ArchiveSync (default: off)
- Status: "Last synced: 2 minutes ago" / "Not enabled" / "Syncing..."
- Note: "Your archive will be backed up to our servers and restored if you reinstall. Only available to subscribers."
- If not subscribed: toggle is greyed out with note "Subscribe to enable ArchiveSync"

### Build time addition

Approximately +4–6 hours on top of the Day 4 build. Can be deferred to v1.1 if timeline is tight — the core product works without it.

---

*End of document. Version 1.0 — It's Been Days.*
