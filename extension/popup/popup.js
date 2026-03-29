import { getTabsMetadata, getSettings } from '../utils/storage.js';
import { deleteArchiveEntries } from '../utils/archive.js';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

async function init() {
  const [metadata, settings, openTabs] = await Promise.all([
    getTabsMetadata(),
    getSettings(),
    chrome.tabs.query({}),
  ]);
  renderTabList(openTabs, metadata, settings.notification_threshold);

  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

// ── Tab list ──────────────────────────────────────────────────────────────

function renderTabList(openTabs, metadata, threshold) {
  const loading = document.getElementById('loading');
  const tabList = document.getElementById('tab-list');
  const emptyState = document.getElementById('empty-state');
  const footer = document.getElementById('footer');
  const suggestedCount = document.getElementById('suggested-count');
  const closeAllBtn = document.getElementById('close-suggested-btn');

  const now = Date.now();

  const enriched = openTabs.map((tab) => {
    const meta = metadata[tab.id];
    // tab.lastAccessed is the browser's authoritative last-visit time.
    // Prefer it over stored metadata, which may be stale from a fresh install.
    const since = tab.lastAccessed ?? meta?.last_visited ?? meta?.opened_at ?? now;
    const daysInactive = Math.floor((now - since) / MS_PER_DAY);
    return {
      tab,
      daysInactive,
      isSuggested:
        daysInactive >= threshold &&
        !tab.pinned &&
        !tab.audible &&
        !(meta?.kept_until && meta.kept_until > now),
    };
  });

  enriched.sort((a, b) => b.daysInactive - a.daysInactive);

  loading.classList.add('hidden');

  if (enriched.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  tabList.classList.remove('hidden');

  const suggested = enriched.filter((e) => e.isSuggested);
  if (suggested.length > 0) {
    suggestedCount.textContent = suggested.length;
    footer.classList.remove('hidden');
  }

  for (const { tab, daysInactive, isSuggested } of enriched) {
    tabList.appendChild(buildTabRow(tab, daysInactive, isSuggested));
  }

  // Switch to tab on row click
  tabList.addEventListener('click', (e) => {
    const row = e.target.closest('.tab-row');
    if (!row || e.target.closest('.tab-close-btn')) return;
    chrome.tabs.update(Number(row.dataset.tabId), { active: true });
    chrome.windows.update(Number(row.dataset.windowId), { focused: true });
    window.close();
  });

  // Close individual tab
  tabList.addEventListener('click', async (e) => {
    const btn = e.target.closest('.tab-close-btn');
    if (!btn) return;
    const tabId = Number(btn.dataset.tabId);
    const closedTabIds = await closeTabs([tabId]);
    if (closedTabIds.includes(tabId)) {
      btn.closest('.tab-row').remove();
      updateSuggestedCount(tabList, suggestedCount, footer);
    }
  });

  // Close all suggested
  closeAllBtn.addEventListener('click', async () => {
    const rows = Array.from(tabList.querySelectorAll('.tab-row.suggested'));
    const ids = rows.map((r) => Number(r.dataset.tabId));
    const closedTabIds = await closeTabs(ids);
    rows.forEach((r) => {
      const id = Number(r.dataset.tabId);
      if (closedTabIds.includes(id)) r.remove();
    });
    updateSuggestedCount(tabList, suggestedCount, footer);
  });
}

// ── Close + archive logic ──────────────────────────────────────────────────

// Archive entries written by this popup session, keyed by tabId.
// Used to undo: reopen tabs + delete the entries.
let pendingUndo = null; // { entryIds, tabs, timerId }

async function closeTabs(tabIds) {
  const result = await new Promise((resolve) =>
    chrome.runtime.sendMessage({ type: 'IBD_CLOSE_TABS', tabIds }, (res) => {
      void chrome.runtime.lastError;
      resolve(res ?? {});
    })
  );

  const closedTabIds = result.closedTabIds ?? [];
  if (closedTabIds.length > 0) {
    showUndoToast(closedTabIds.length, result.entryIds ?? [], result.tabs ?? []);
  }
  return closedTabIds;
}

// ── Undo toast ─────────────────────────────────────────────────────────────

const UNDO_TIMEOUT_MS = 5000;

function showUndoToast(count, entryIds, tabs) {
  const toast = document.getElementById('undo-toast');
  const msg = document.getElementById('undo-msg');
  const undoBtn = document.getElementById('undo-btn');

  // Clear any existing undo timer
  if (pendingUndo?.timerId) clearTimeout(pendingUndo.timerId);

  pendingUndo = {
    entryIds,
    tabs,
    timerId: setTimeout(() => {
      toast.classList.add('hidden');
      pendingUndo = null;
    }, UNDO_TIMEOUT_MS),
  };

  msg.textContent = `Closed ${count} tab${count === 1 ? '' : 's'}.`;
  toast.classList.remove('hidden');

  undoBtn.onclick = async () => {
    if (!pendingUndo) return;
    clearTimeout(pendingUndo.timerId);
    const { entryIds: ids, tabs: reopenTabs } = pendingUndo;
    pendingUndo = null;
    toast.classList.add('hidden');

    // Reopen tabs and remove their archive entries
    await Promise.all(reopenTabs.map((t) => chrome.tabs.create({ url: t.url })));
    await deleteArchiveEntries(ids);
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildTabRow(tab, daysInactive, isSuggested) {
  const li = document.createElement('li');
  li.className = `tab-row${isSuggested ? ' suggested' : ''}`;
  li.dataset.tabId = tab.id;
  li.dataset.windowId = tab.windowId;

  if (tab.favIconUrl) {
    const img = document.createElement('img');
    img.className = 'tab-favicon';
    img.src = tab.favIconUrl;
    img.alt = '';
    img.addEventListener('error', () => {
      const ph = document.createElement('div');
      ph.className = 'tab-favicon-placeholder';
      img.replaceWith(ph);
    });
    li.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'tab-favicon-placeholder';
    li.appendChild(ph);
  }

  const info = document.createElement('div');
  info.className = 'tab-info';

  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = truncate(tab.title || 'Untitled', 40);

  const inactivity = document.createElement('div');
  inactivity.className = 'tab-inactivity';
  inactivity.textContent = formatInactivity(daysInactive);

  info.append(title, inactivity);
  li.appendChild(info);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'tab-close-btn';
  closeBtn.dataset.tabId = tab.id;
  closeBtn.title = 'Close tab';
  closeBtn.textContent = '×';
  li.appendChild(closeBtn);

  return li;
}

function updateSuggestedCount(tabList, countEl, footer) {
  const remaining = tabList.querySelectorAll('.tab-row.suggested').length;
  if (remaining === 0) footer.classList.add('hidden');
  else countEl.textContent = remaining;
}

function formatInactivity(days) {
  if (days === 0) return 'Just visited';
  if (days === 1) return '1 day inactive';
  return `${days} days inactive`;
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

init();
