# It's Been Days

Track tab inactivity, close stale tabs faster, and instantly recover anything from your archive.

`It's Been Days` is a lightweight Chrome extension for people who keep too many tabs open and still need to find things quickly.

## Why This Exists

Chrome shows your tabs, but not how long they have been untouched.

This extension helps you:

- see which tabs are stale at a glance
- close stale tabs in one click
- keep a local archive of closed tabs
- reopen archived tabs instantly from a keyboard-first overlay

## Core Features

- **Inactivity tracking**: ranks open tabs by days since last visit
- **Stale suggestions**: highlights tabs past your threshold
- **Bulk cleanup**: close all suggested tabs with undo
- **Archive search**: search open + archived tabs from one overlay
- **Smart reopen**: switch to open tab or reopen closed tab
- **Daily reminder (optional)**: desktop notification for stale tabs

## Keyboard Shortcut

- Default: `Cmd+Shift+Space` (macOS), `Ctrl+Shift+Space` (Windows/Linux)
- If it conflicts with Alfred/Raycast or other launchers, remap at:
  `chrome://extensions/shortcuts`

## Privacy

- All tab/archive data is stored locally in `chrome.storage.local`
- No account required
- No mandatory backend for core functionality
- Optional history import is explicit opt-in

See also: `store/privacy-policy.html`

## Install (Developer Mode)

1. Clone this repo
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the `extension/` folder

## Support

The project is free and open source.

If it helps you, you can support development via the in-app **Buy Me a Coffee** button (configured in `extension/background.js`).

## Project Structure

```text
extension/
  background.js                  # tab tracking, alarms, notifications, messaging
  manifest.json                  # MV3 config
  overlay/                       # main keyboard overlay UI
  settings/                      # extension settings page
  popup/                         # legacy popup UI (kept in repo)
  utils/                         # storage/archive/helpers
```

## Development Notes

- Manifest V3 service worker architecture
- No framework runtime in extension UI (vanilla JS + CSS)
- Main surfaces are overlay + settings

Useful docs in this repo:

- `SUBMIT.md` — Chrome Web Store submission checklist
- `PLAN.md` — implementation notes and architecture planning
- `its-been-days-PRD.md` — product requirement draft
- `DESIGN.md` — UI and style decisions

## Roadmap (Short-Term)

- polish visual details and copy
- improve onboarding flow
- add better archive management ergonomics
- publish stable Web Store release

---

Built for tab hoarders who still want fast retrieval.
