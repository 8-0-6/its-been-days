# Chrome Web Store Submission Checklist — It's Been Days

## Monetisation: Free + open source (optional tip jar)

> No paywall, no trial lock, no subscription.
> The extension is fully usable for free. Support is optional via a
> "Buy Me a Coffee" link in Settings.

### Pre-submission steps

1. Ensure tip button opens your preferred support URL (for example:
   `https://buymeacoffee.com/<your-handle>`) in `extension/background.js`.
2. Confirm all paywall/upgrade text is removed from UI and listing copy.
3. Add your GitHub repository URL to the store listing and README.

---

## Chrome Web Store Submission

### 1. Package

```bash
cd extension
zip -r ../its-been-days.zip . \
  --exclude '*.DS_Store' \
  --exclude 'node_modules/*'
```

### 2. Developer Dashboard

- Go to https://chrome.google.com/webstore/devconsole
- Click **Add new item** → upload `its-been-days.zip`
- Fill in:
  - **Name**: It's Been Days
  - **Summary**: Track how long your tabs have been inactive. Close stale ones instantly.
  - **Category**: Productivity
  - **Language**: English

### CWS form fill — one-page checklist

Use this as your exact fill order in the Web Store dashboard:

1. **Upload package**
   - Upload `its-been-days.zip`
2. **Store listing**
   - Name: `It's Been Days`
   - Summary: `Track how long your tabs have been inactive. Close stale ones instantly.`
   - Category: `Productivity`
   - Language: `English`
   - Short description: use the text in section 3 below
   - Detailed description: use the text in section 3 below
3. **Images**
   - Upload 4 screenshots (`1280x800`) listed in section 4 below
4. **Privacy**
   - Privacy policy URL: `https://8-0-6.github.io/its-been-days/privacy-policy/`
5. **Permissions justification**
   - Use section 5 table below
6. **Monetization consistency check**
   - Confirm listing includes: `Free forever. No paywall. No trial lock. No subscription.`
   - Confirm support is optional: `Buy Me a Coffee` link only
7. **Final verification before submit**
   - Tip button opens `https://buymeacoffee.com/itsbeendays`
   - Install flow has no paywall and no locked features
   - Zip is clean (no `.DS_Store`, no `node_modules`)

### 3. Store listing copy

**Short description (132 chars max)**
> See at a glance which tabs haven't been visited in days. Close stale ones in one click and retrieve anything from your archive.

**Detailed description**
```
It's Been Days shows you exactly how long each of your open tabs has been sitting
untouched. Instead of endlessly scrolling through hundreds of tabs, you can:

• Search open and closed tabs from a single overlay (⌘ Shift Space)
• See which tabs haven't been visited in days, weeks, or months
• Close stale tabs in one click — or snooze them for 30 days with Keep
• Reopen anything from your local archive (up to 500 entries)
• Get a daily notification when tabs go stale (optional)

Everything is stored locally. No account required to use the extension.

PRICING
Free forever. No account required. Optional support via Buy Me a Coffee.
```

### 4. Screenshots required

| # | Size      | Scene |
|---|-----------|-------|
| 1 | 1280×800  | Overlay open — STALE section visible with stale tabs |
| 2 | 1280×800  | "All caught up" state after closing stale tabs |
| 3 | 1280×800  | Search mode — query typed, mixed open + archived results |
| 4 | 1280×800  | Settings panel — Support section showing Buy Me a Coffee button |

### 5. Permissions justification

| Permission | Justification |
|---|---|
| `tabs` | Read tab URLs, titles, favicons, and lastAccessed timestamps |
| `storage` | Persist tab metadata and archive on-device |
| `notifications` | Optional daily inactivity notifications |
| `activeTab` | Required for content-script injection |
| `scripting` | Inject overlay.js into the active tab |
| `alarms` | Schedule daily background recalculation |
| `history` (optional) | One-time import of browser history into archive on first run |

### 6. Privacy policy

Required because the extension requests optional `history` permission.
Use this GitHub Pages URL in the Chrome Web Store form:

`https://8-0-6.github.io/its-been-days/privacy-policy/`

The page should state:

> It's Been Days stores all data locally on your device using `chrome.storage.local`.
> No data is sent to any external server. The `history` permission is only used
> if you opt in during the onboarding import step.

### 7. Pre-submission checklist

- [ ] Tip jar URL in `background.js` points to your page
- [ ] All four screenshots taken
- [ ] Privacy policy URL ready (`https://8-0-6.github.io/its-been-days/privacy-policy/`)
- [ ] `manifest.json` version bumped
- [ ] Zip built from clean `extension/` directory (no `.DS_Store`, no `node_modules`)
- [ ] Tested: install → all features available immediately (no paywall)
- [ ] Tested: "Buy Me a Coffee" button opens the correct support URL

---

## Post-launch

- Monitor install/review feedback in Chrome Web Store
- Optional: monitor support link clicks via a URL shortener/UTM
- Keep README + store listing aligned with the free/open-source model
