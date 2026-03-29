import { KEYS } from './storage.js';

const MAX_ENTRIES = 500;
const SESSION_POPUP_CLOSING = 'popup_closing_tabs';

function localGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function localSet(items) {
  return new Promise((resolve) => chrome.storage.local.set(items, resolve));
}
function sessionGet(keys) {
  return new Promise((resolve) => chrome.storage.session.get(keys, resolve));
}
function sessionSet(items) {
  return new Promise((resolve) => chrome.storage.session.set(items, resolve));
}

// ── Read / write ───────────────────────────────────────────────────────────

export async function getArchive() {
  const result = await localGet(KEYS.ARCHIVE);
  return result[KEYS.ARCHIVE] ?? {};
}

async function setArchive(data) {
  await localSet({ [KEYS.ARCHIVE]: data });
}

// Write one archive entry. Evicts oldest when over cap. Returns the new entry ID.
export async function writeArchiveEntry({ url, title, favicon_url, last_visited, days_inactive }) {
  const archive = await getArchive();
  const entries = Object.values(archive);

  // FIFO eviction — drop oldest archived_at entries
  if (entries.length >= MAX_ENTRIES) {
    entries.sort((a, b) => a.archived_at - b.archived_at);
    const overflow = entries.length - MAX_ENTRIES + 1;
    for (let i = 0; i < overflow; i++) delete archive[entries[i].id];
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  archive[id] = {
    id,
    url,
    title,
    favicon_url,
    archived_at: now,
    last_visited: last_visited ?? now,
    days_inactive: days_inactive ?? 0,
  };

  await setArchive(archive);
  return id;
}

// Bulk-write history items into the archive. Deduplicates by URL (existing archive
// entries win). Takes the most recent items first to stay within the 500-entry cap.
export async function bulkWrite(items) {
  const archive = await getArchive();
  const existingUrls = new Set(Object.values(archive).map((e) => e.url));

  // Sort by most recent first so we keep the freshest history if we hit the cap
  const sorted = [...items].sort((a, b) => (b.last_visited ?? 0) - (a.last_visited ?? 0));

  let written = 0;
  for (const item of sorted) {
    if (!item.url) continue;
    if (existingUrls.has(item.url)) continue; // dedup

    // Evict oldest if at cap
    const entries = Object.values(archive);
    if (entries.length >= MAX_ENTRIES) {
      entries.sort((a, b) => a.archived_at - b.archived_at);
      delete archive[entries[0].id];
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    archive[id] = {
      id,
      url: item.url,
      title: item.title || item.url,
      favicon_url: item.favicon_url ?? '',
      archived_at: item.archived_at ?? now,
      last_visited: item.last_visited ?? now,
      days_inactive: item.days_inactive ?? 0,
    };
    existingUrls.add(item.url);
    written++;
  }

  await setArchive(archive);
  return written;
}

export async function deleteArchiveEntries(ids) {
  const archive = await getArchive();
  for (const id of ids) delete archive[id];
  await setArchive(archive);
}

// ── Popup-closing flag ─────────────────────────────────────────────────────
// Popup marks tab IDs before calling chrome.tabs.remove so background.js
// knows not to double-archive those specific tabs.

export async function markPopupClosing(tabIds) {
  const result = await sessionGet(SESSION_POPUP_CLOSING);
  const current = result[SESSION_POPUP_CLOSING] ?? {};
  for (const id of tabIds) current[id] = true;
  await sessionSet({ [SESSION_POPUP_CLOSING]: current });
}

// Returns true and clears the flag if the tab was popup-initiated.
export async function consumePopupClosingFlag(tabId) {
  const result = await sessionGet(SESSION_POPUP_CLOSING);
  const current = result[SESSION_POPUP_CLOSING] ?? {};
  if (!current[tabId]) return false;
  delete current[tabId];
  await sessionSet({ [SESSION_POPUP_CLOSING]: current });
  return true;
}

// Called by background.js onRemoved for externally-closed tabs (Cmd+W, window close, etc.)
export async function archiveTab(tab, meta) {
  await writeArchiveEntry({
    url: tab.url ?? meta.url,
    title: tab.title ?? meta.title,
    favicon_url: meta.favicon_url,
    last_visited: meta.last_visited,
    days_inactive: meta.days_inactive,
  });
}
