# It's Been Days — Build Plan
_Updated from PRD via /plan-ceo-review on 2026-03-28_
_See `its-been-days-PRD.md` for the full original spec. This document captures all changes and decisions made during the CEO review._

> Status note (2026-03-29): this file contains historical planning content, including older monetization assumptions.  
> Current shipping model is free + optional tip jar. Use `README.md`, `SUBMIT.md`, and current `extension/` code as source of truth.

---

## What Changed from the PRD

| # | Change | Why |
|---|--------|-----|
| 1 | **No popup** — overlay is the one UI, two triggers | Eliminated duplication; overlay is the better surface |
| 2 | **One-time $10 via ExtensionPay** (replaces $5/month Stripe subscription) | Subscription risky for tab utility category; no backend needed |
| 3 | **No Supabase, no auth, no webhook** in v1 | Follows from #2; ArchiveSync deferred to v1.1 |
| 4 | **"Keep" button** on stale tabs | Prevents false-positive fatigue; users need to say "I know, leave me alone" |
| 5 | **Close button in overlay** for open-tab results | Makes overlay a complete surface: find, switch, or close |
| 6 | **First-run history import** via `optional_permissions` (requested at runtime) | Archive empty on day 1 otherwise; `optional_permissions` avoids scary install warning |
| 7 | **Overlay has two modes**: management view (empty query) + search view (typed query) | Single surface replaces popup's ranked list |
| 8 | **Ready-handshake trigger** (no setTimeout) | Eliminates reliability bug in PRD's overlay trigger mechanism |
| 9 | **Undo toast inside overlay** (overlay stays open after close-all) | Overlay-only design needs toast to live somewhere |
| 10 | **Single context-aware overlay.js** (handles content-script + standalone-page contexts) | No code duplication between content-script and standalone fallback |

---

## Architecture

### File Structure

```
its-been-days/
├── manifest.json
├── background.js              ← service worker: all tab events, alarm, badge, notifications,
│                                ExtensionPay owner, pendingClose guard
├── overlay/
│   ├── overlay.js             ← context-aware: content-script OR standalone page
│   │                            management view (empty query) + search view (typed query)
│   └── overlay.css
├── overlay-standalone.html    ← fallback window for non-injectable pages (chrome://, PDFs)
├── settings/
│   ├── settings.html
│   └── settings.js
└── utils/
    ├── storage.js             ← chrome.storage.local wrapper (all reads/writes)
    ├── archive.js             ← CRUD on archive[], FIFO eviction at 500 entries
    └── pay.js                 ← ExtensionPay cache wrapper (messages background for status)
```

_Removed from PRD: `popup/popup.html`, `popup/popup.css`, `popup/popup.js`, `utils/auth.js`_

### Two Triggers, One UI

```
toolbar click  ──▶  chrome.action.onClicked  ──▶  background.js: toggleOverlay()
Cmd+Shift+Space ──▶ chrome.commands.onCommand ──▶  background.js: toggleOverlay()
                                                           │
                                      ┌────────────────────┴────────────────────┐
                                      │ injectable page?                         │
                                     YES                                         NO
                                      │                                          │
                          executeScript(overlay.js)              windows.create(standalone.html)
                          wait for OVERLAY_READY
                          send TOGGLE_OVERLAY
```

### Overlay Modes

```
Query empty → MANAGEMENT VIEW
┌─────────────────────────────────────────────────────┐
│  🔍  Search tabs...                          ⚙  ✕   │
├─────────────────────────────────────────────────────┤
│  STALE (7)                            [Close all]   │
│  ○  Reddit ML — 14d inactive  [Keep] [×]            │
│  ○  Figma login — 12d         [Keep] [×]            │
├─────────────────────────────────────────────────────┤
│  ALL OPEN (23 total)                                │
│  ●  GitHub — just now                               │
│  ●  Notion — 2h ago                                 │
├─────────────────────────────────────────────────────┤
│  RECENTLY ARCHIVED                                  │
│  ○  YC application — 1 day ago                      │
│  ○  Airbnb Tokyo — 8 days ago                       │
└─────────────────────────────────────────────────────┘
  ● green dot = currently open
  ○ grey dot  = archived (closed)
  Amber tint  = stale (inactive beyond threshold)

Query non-empty → SEARCH VIEW (same as original PRD overlay spec)
  Filters all three sections in real-time.

Query empty + zero stale tabs → MANAGEMENT VIEW (zero-stale state)
┌─────────────────────────────────────────────────────┐
│  🔍  Search open & closed tabs...            ⚙  ✕   │
├─────────────────────────────────────────────────────┤
│  ● All caught up — no stale tabs                    │
├─────────────────────────────────────────────────────┤
│  ALL OPEN (18 total)                                │
│  ●  GitHub — just now                               │
│  ●  Notion — 2h ago                                 │
├─────────────────────────────────────────────────────┤
│  RECENTLY ARCHIVED                                  │
│  ○  YC application — 1d ago                         │
└─────────────────────────────────────────────────────┘
Note: STALE section is hidden entirely when stale count = 0.
"All caught up" row uses green dot, #16a34a text, normal weight.
No "Close all" footer when stale = 0.
```

### Settings View IA

The settings panel (slide-in within the same panel, Back button returns to main view) has three sections:

```
NOTIFICATIONS
  Enable daily digest          [toggle on/off]
  ─────────────────────────────────────────────
  Stale after: N days   [────●────────────]
                         3d              30d

ACCOUNT
  user@email.com               [TRIAL / ACTIVE / EXPIRED badge]
  Trial: 28 days remaining     (or expiry message)
  [Upgrade — $10 one-time]     (shown during trial / expired)

DATA
  [Clear archive]              (destructive, requires confirm step)
```

### Interaction State Coverage

| Feature | Loading | Empty | Error | Success |
|---------|---------|-------|-------|---------|
| Overlay open | Skeleton rows (2–3 per section, grey shimmer) while storage read is in-flight | Zero-stale state (see IA above) | — | Full render |
| Tab close (single) | — | — | Tab already gone: catch, archive from tabs_metadata anyway, no error shown to user | Undo toast: "Closed [Title]. Undo" |
| Tab close (Close all) | — | — | Same as single | Undo toast: "Closed 7 tabs. Undo" |
| Search | — | "No tabs matching '{query}'" + sub-line "Try a shorter term, or check your archive" | — | Filtered rows update in real-time |
| History import | Button label: "Importing... (N tabs)" | — | Permission denied: "Permission denied — history not imported" (inline in onboarding) | "Done — N tabs imported" (inline in onboarding) |
| Payment status | — | — | Network failure: optimistic allow, no user-visible error | Badge update to ACTIVE |

**Skeleton row spec:** Two stacked grey bars per row (title bar: 60% width, 10px tall; URL bar: 40% width, 8px tall). Use CSS `@keyframes shimmer` with `background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)`. One shimmer animation covers the panel. Dark mode: replace with `#2c2c2e / #3a3a3c`.

### Component Ownership

| Component | Owns |
|-----------|------|
| `background.js` | Tab events (onActivated, onCreated, onRemoved, onUpdated), daily alarm, badge, notifications, ExtensionPay state (sole caller of `extpay.getUser()`), `pendingClose` dedup guard |
| `overlay.js` | UI rendering (both modes), user interactions, first-run onboarding prompt |
| `storage.js` | All `chrome.storage.local` reads/writes |
| `archive.js` | Archive CRUD, FIFO eviction at 500 entries, bulk write (history import) |
| `pay.js` | Payment status cache; sends `GET_PAYMENT_STATUS` to background.js; never calls extpay directly |

### Critical: Double-Archive Race Condition Guard

When the user clicks ✕ in the overlay, two events fire:
1. Overlay sends `CLOSE_AND_ARCHIVE(tabId)` to background.js
2. `chrome.tabs.onRemoved` fires in background.js

Without a guard, the same tab gets archived twice.

**Fix:** `background.js` maintains `pendingClose = new Set()`.
- When handling `CLOSE_AND_ARCHIVE`: add `tabId` to `pendingClose`, call `chrome.tabs.remove()`, write archive entry, remove from `pendingClose`
- In `onRemoved` handler: if `tabId` is in `pendingClose` → skip archiving (already handled)

---

## Permissions (manifest.json)

```json
{
  "permissions": ["tabs", "storage", "notifications", "activeTab", "scripting"],
  "optional_permissions": ["history"],
  "host_permissions": ["<all_urls>"]
}
```

- `history` is **optional** (not required): requested at runtime during first-run onboarding via `chrome.permissions.request()`, triggered by a user click (required for permission request API)
- `<all_urls>` required for overlay content script injection (must be in CWS privacy disclosure)
- No `unlimitedStorage` (500-entry FIFO cap keeps well under Chrome's 5MB limit)

---

## Data Model

_Same as PRD section 14, with these additions:_

```
tabs_metadata: {
  [tabId: string]: {
    url:          string,
    title:        string,
    favicon_url:  string,
    opened_at:    timestamp,
    last_visited: timestamp,
    days_inactive: number,
    kept_until:   timestamp | null   // NEW: null = not kept; timestamp = exempt from suggestions until this date
  }
}

onboarding: {                        // NEW
  history_import_offered:    boolean,  // true once we've asked
  history_import_completed:  boolean,  // true once import ran
  install_date:              timestamp  // canonical trial start (moved from trial.install_date)
}

// subscription_status (same as PRD but backed by ExtensionPay, not Supabase):
subscription_status: {
  isPaid:      boolean,
  cached_at:   timestamp    // TTL: 24h; on expiry, re-fetch from ExtensionPay
}
```

_Removed from PRD data model: remote Supabase `users` table (deferred to v1.1)_

---

## Monetisation (replaces PRD section 13)

- **Price:** One-time $10 via ExtensionPay
- **Trial:** 30 days from `onboarding.install_date`, fully unlocked
- **After trial:** paywall shown in overlay management view header
- **Payment flow:** ExtensionPay opens Stripe Checkout in new tab; on return, overlay rechecks status
- **Status caching:** `subscription_status.isPaid` cached with 24h TTL; on cache miss use optimistic allow
- **No backend required:** ExtensionPay handles all payment validation

**Feature gate matrix (updated):**

| Feature | Trial | Paid | Expired |
|---------|-------|------|---------|
| Inactivity tracking | ✓ | ✓ | ✗ |
| Badge count | ✓ | ✓ | ✗ |
| Overlay management view | ✓ | ✓ | ✗ (paywall prompt) |
| Close + archive (from overlay) | ✓ | ✓ | ✗ |
| Archive writes via onRemoved | ✓ | ✓ | ✓ (always) |
| Overlay search + reopen | ✓ | ✓ | ✓ (read-only) |
| Desktop notifications | ✓ | ✓ | ✗ |
| ArchiveSync | — | v1.1 | — |

---

## Revised Build Plan

### Day 1 — Core tracking + overlay scaffold

| Task | Est. (CC) |
|------|-----------|
| manifest.json, file structure, load unpacked | 15min |
| background.js: tab event listeners (onActivated, onCreated, onRemoved, onUpdated) with pendingClose guard | 30min |
| storage.js utils | 15min |
| Daily alarm: recalculate days_inactive, skip kept_until tabs | 20min |
| overlay.js: scaffold (context detection + TOGGLE_OVERLAY message handler) | 30min |
| overlay.js: management view — render stale tabs + all open tabs + archive sections | 45min |

**Day 1 exit:** Extension installs, tracks tab activity in background, management view opens via toolbar click.

### Day 2 — Close, archive, Keep, undo

| Task | Est. (CC) |
|------|-----------|
| Suggestion logic: flag tabs inactive beyond threshold (skip pinned, audio, kept_until) | 15min |
| Stale tab styling in management view (amber row tint, Keep button, Close button) | 20min |
| CLOSE_AND_ARCHIVE message flow (overlay → background, pendingClose guard) | 30min |
| "Close all stale" button → batch close + archive | 20min |
| Undo toast (5 seconds, inside overlay, overlay stays open) | 30min |
| Keep button → sets kept_until +30d in storage | 15min |

**Day 2 exit:** Full close/archive/keep/undo flow working end-to-end.

### Day 3 — Search view, overlay trigger, notifications

| Task | Est. (CC) |
|------|-----------|
| Ready-handshake trigger (background.js + overlay.js OVERLAY_READY message) | 20min |
| Non-injectable fallback (overlay-standalone.html + context detection in overlay.js) | 30min |
| Overlay search view: real-time filter on open tabs + archive | 30min |
| Switch-or-reopen logic (green/grey dot, switch focus vs open new tab) | 20min |
| Keyboard navigation (arrows, enter, escape) | 20min |
| ARIA roles and labels (dialog, search, sections) | 10min |
| Close button in overlay for open-tab results | 15min |
| Desktop notification: daily alarm check, fire if tabs over threshold | 20min |

**ARIA spec for overlay.js:**
- `panel.setAttribute('role', 'dialog')`
- `panel.setAttribute('aria-label', 'Tab manager')`
- `panel.setAttribute('aria-modal', 'true')`
- `searchInput.setAttribute('aria-label', 'Search tabs')`
- Each section header: `role="group"` with `aria-label` matching the section name (e.g., `aria-label="Stale tabs"`)
- On overlay open: move focus to `searchInput`
- On overlay close: return focus to the element that was focused before open

**Day 3 exit:** Overlay fully working (both modes), notifications firing.

### Day 4 — First-run onboarding, auth, paywall, settings

**First-run onboarding design spec:**
- Appears inline inside the overlay panel on the very first open (`onboarding.history_import_offered === false`)
- Replaces the results area; overlay header (search input, settings gear) remains visible so the user sees the real product chrome
- Layout:
  ```
  Welcome to It's Been Days

  ● Track how long tabs have been open
  ● Close stale ones in one place
  ● Reopen anything from your archive

  ┌──────────────────────────────────────────┐
  │ Import browser history (optional)         │
  │ Gives you an archive from day 1           │
  │ [Import history]   (shows progress inline) │
  └──────────────────────────────────────────┘

  [Get started]  ← dismisses onboarding, sets history_import_offered = true
  ```
- Import button states: idle → "Importing... (142 tabs)" → "Done — 142 tabs imported" / "Permission denied — history not imported"
- "Get started" is always visible (user can skip import and proceed)
- Font: same `.ibd-title` / `.ibd-url` token classes. Title: 15px, font-weight 600. Bullets: 13px, line-height 1.6.

| Task | Est. (CC) |
|------|-----------|
| First-run onboarding screen (explains 3 concepts + history import prompt) | 30min |
| optional_permissions history request (on button click in onboarding) | 15min |
| History import: chrome.history.search() → archive.bulkWrite() (500 max, dedup by URL) | 30min |
| Settings page: notifications toggle + threshold slider | 30min |
| Trial logic: install_date → trial_ends_at, countdown display in overlay header | 20min |
| ExtensionPay setup: add script to background.js, implement GET_PAYMENT_STATUS handler | 30min |
| ExtensionPay caching in storage.js (24h TTL, optimistic allow on network failure) | 15min |
| Post-trial paywall: disable tracking, show paywall banner in overlay | 30min |
| Trial urgency banners (Day 25 amber, Day 29 red) | 15min |

**Day 4 exit:** Full end-to-end working. CWS submission is Day 5.

### Day 5 — Chrome Web Store submission

| Task | Est. (CC) |
|------|-----------|
| CWS assets: screenshots + description copy | 1h |
| Privacy policy (cover `<all_urls>`, optional `history` permission, ExtensionPay) | 30min |

**CWS Screenshot brief (1280×800 each):**
- **Screenshot 1 — Management view:** Dark page background (simulate a real website behind the overlay). Panel shows STALE (7) section with 3 amber-tinted rows + Keep/close buttons, ALL OPEN section with 4 rows. "Close 7 stale tabs" footer visible. Headline below screenshot: "See which tabs have been sitting for days."
- **Screenshot 2 — Search view:** User has typed "figma" in search. 2 open + 3 archived results shown with matching favicon rows. Headline: "Instantly find any tab — open or closed."
- **Screenshot 3 — All caught up state + archive depth:** Zero stale state, "All caught up" row at top, recently archived section shows 8 rows demonstrating archive depth. Headline: "Closed 3 days ago? It's still there."

Caption strategy: lead with user outcome, not feature name. "It's been 14 days." not "Tab inactivity tracking".
| Submit to CWS | — |
| Soft launch: unpacked extension to 10-20 beta users while in review | 30min |

---

## NOT in Scope (v1)

- ArchiveSync (Supabase cloud backup) — deferred to v1.1
- Supabase auth / user accounts
- Stripe Billing / subscriptions / webhooks
- Annual billing
- Export (CSV/JSON)
- Web dashboard
- Cross-device sync (requires account)
- Bulk archive deletion
- Browser history in live overlay search (history import populates archive; no live query)
- Firefox/Edge/Safari
- Mac menu bar app
- Tab grouping

---

## Risk Flags (updated from PRD + eng review)

| Risk | Mitigation |
|------|-----------|
| Keyboard shortcut conflict (Alfred, Raycast) | Onboarding copy + CWS Known Issues section |
| CWS review rejection for `<all_urls>` | Clear privacy policy justification; 2-4 week enhanced review expected |
| Service worker termination (MV3) | chrome.alarms for all scheduled work; pendingClose in chrome.storage.session (not in-memory Set) |
| ExtensionPay server down | 24h cached isPaid; optimistic allow on cache miss |
| Double-archive race condition | pendingClose in chrome.storage.session (survives SW termination) |
| onRemoved fires after tab is gone | tabs_metadata is canonical source for archive data; onUpdated keeps it current |
| History permission install warning | optional_permissions requested at runtime (avoids install-time warning) |
| ExtensionPay from content script | background.js is sole ExtensionPay owner; overlay messages background |
| Badge count stale after close | setBadgeText called after every archive write, not just daily alarm |

---

## Engineering Decisions from Eng Review (2026-03-28)

| # | Decision | Detail |
|---|----------|--------|
| 1 | pendingClose uses chrome.storage.session | MV3 service workers terminate; in-memory Set loses state. storage.session persists for browser session. |
| 2 | tabs_metadata is canonical for onRemoved | Tab object gone when onRemoved fires. Read from tabs_metadata[tabId]. If missing: archive url='unknown', log warning. |
| 3 | Badge refreshes after every archive write | Not just daily alarm. After CLOSE_AND_ARCHIVE and onRemoved handlers. |
| 4 | Context detection via window.location.protocol | overlay.js: `const isStandalone = window.location.protocol === 'chrome-extension:';` |
| 5 | CLOSE_AND_ARCHIVE accepts array<tabId> | Single handler for single-tab and batch-close. `{ type: 'CLOSE_AND_ARCHIVE', tabIds: [...] }` |
| 6 | Message router pattern in background.js | `const handlers = { CLOSE_AND_ARCHIVE: fn, GET_PAYMENT_STATUS: fn, ... }; handlers[msg.type]?.(msg, sender, reply)` |
| 7 | daily alarm: kept_until expiry cleared | If `kept_until < now`, set to null in tabs_metadata. Tab becomes eligible for suggestions again. |
| 8 | daily alarm: batch read/write | `chrome.storage.local.get('tabs_metadata')` once, compute all, `.set()` once. No per-tab operations. |
| 9 | Search: filter JS array, render DOM from results | Never iterate DOM to filter. Store archive + tabs as JS arrays; filter on keypress; re-render matching nodes only. |
| 10 | Test stack: Jest + jest-chrome + Playwright | Unit tests for background/storage/archive logic. E2E for overlay UI flows. Setup on Day 1. |

---

## Test Requirements (from eng review)

### Test stack
```
package.json dependencies (devDependencies):
  jest, jest-chrome, @types/chrome    ← unit tests for background.js + utils
  playwright, @playwright/test         ← E2E tests for overlay UI
```

### Unit tests (test/background.test.js, test/archive.test.js, test/storage.test.js)

**archive.js:**
- `writeEntry()`: under 500 entries → appends
- `writeEntry()`: at 500 entries → evicts oldest, appends new
- `writeEntry()`: duplicate URL → allowed (separate entries)
- `bulkWrite()`: dedup by URL (archive wins), > 500 items (takes most recent 500), all items new

**background.js — onRemoved:**
- tabId in pendingClose (storage.session) → skip archive, remove from pendingClose
- tabId NOT in pendingClose → read tabs_metadata, write archive entry
- tabs_metadata[tabId] missing → archive with url='unknown', log warning

**background.js — daily alarm:**
- days_inactive calculated correctly from last_visited timestamp
- tabs with kept_until in future → skipped in suggestions
- kept_until expired → cleared (set to null)
- notification fires when stale count > 0 and notifications enabled
- badge text set to stale count

**background.js — CLOSE_AND_ARCHIVE:**
- happy path: adds to pendingClose (session), removes tab, writes archive entry
- tab already closed: chrome.tabs.remove() throws → catch, archive anyway from tabs_metadata
- tabs_metadata missing: archive with partial data

**background.js — GET_PAYMENT_STATUS:**
- cache fresh (< 24h) → return cached isPaid, no extpay call
- cache stale → extpay.getUser() → cache + return
- extpay network failure → return cached value (optimistic allow)
- no cache + network failure → return { isPaid: true } (optimistic allow)

### E2E tests (e2e/overlay.spec.js)
- Install extension → open overlay via toolbar click → management view renders
- Open overlay via keyboard shortcut (Cmd+Shift+Space)
- Close single stale tab → archive entry created → undo toast appears
- Undo: reopen 1 tab → tab exists, entry removed from archive
- Close all stale → multiple archive entries → undo reopens all
- Search: type query → filters open tabs + archive in real-time
- Click open tab in search → Chrome switches to that tab
- Click archived tab in search → new tab opens with that URL
- Trial expiry: mock install_date 25 days ago → amber banner visible
- Trial expired: mock install_date 31 days ago → paywall shown, overlay search still works

---

## Code Architecture Notes (for implementer)

### background.js structure
```javascript
// Message router (avoids big switch statement)
const handlers = {
  CLOSE_AND_ARCHIVE: handleCloseAndArchive,
  GET_PAYMENT_STATUS: handlePaymentStatus,
  // add new handlers here as the product grows
};
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = handlers[msg.type];
  if (handler) {
    handler(msg, sender, sendResponse);
    return true; // keep channel open for async response
  }
});

// pendingClose: uses chrome.storage.session (survives SW termination)
// pattern:
async function addPendingClose(tabId) {
  const { pendingClose = [] } = await chrome.storage.session.get('pendingClose');
  await chrome.storage.session.set({ pendingClose: [...pendingClose, tabId] });
}
async function removePendingClose(tabId) {
  const { pendingClose = [] } = await chrome.storage.session.get('pendingClose');
  await chrome.storage.session.set({ pendingClose: pendingClose.filter(id => id !== tabId) });
}
async function isInPendingClose(tabId) {
  const { pendingClose = [] } = await chrome.storage.session.get('pendingClose');
  return pendingClose.includes(tabId);
}
```

### overlay.js context detection
```javascript
const isStandalone = window.location.protocol === 'chrome-extension:';
// In standalone mode: no need to inject/remove from DOM, already in own window
// In content-script mode: inject overlay div into page, remove on Escape/outside-click
```

### overlay.js search: JS-array filtering pattern
```javascript
// Store data in module-level arrays (populated on open)
let openTabs = [];
let archiveEntries = [];

function renderOverlay(query = '') {
  const q = query.toLowerCase();
  const filteredTabs = q ? openTabs.filter(t => t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q)) : openTabs;
  const filteredArchive = q ? archiveEntries.filter(e => e.title.toLowerCase().includes(q) || e.url.toLowerCase().includes(q)) : archiveEntries.slice(0, 20);
  // render DOM from filtered arrays (not DOM iteration)
}

searchInput.addEventListener('input', e => renderOverlay(e.target.value));
```

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | 6 proposals, 5 accepted, 1 skipped |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 7 issues found, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 5/10 → 9/10, 10 decisions |

**VERDICT:** CEO + ENG + DESIGN CLEARED — ready to implement.
