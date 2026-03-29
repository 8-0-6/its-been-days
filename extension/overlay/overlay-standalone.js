// overlay-standalone.js
// Fallback window used on chrome:// and other non-injectable pages.
// Mirrors overlay.js logic but runs as a regular extension page.

const MS_PER_DAY = 86400000;
const DEFAULT_THRESHOLD = 10;

let openItems = [];
let archivedItems = [];
let filtered = [];
let activeIdx = -1;
let threshold = DEFAULT_THRESHOLD;
let pendingUndo = null;

const searchInput = document.getElementById('search');
const resultsList = document.getElementById('results');
const closeFooter = document.getElementById('close-footer');
const closeFooterBtn = document.getElementById('close-all-btn');
const undoToast = document.getElementById('undo-toast');
const undoMsg = document.getElementById('undo-msg');
const undoBtn = document.getElementById('undo-btn');

const settingsBtn = document.getElementById('settings-btn');
const mainView = document.getElementById('main-view');
const settingsView = document.getElementById('settings-view');
const backBtn = document.getElementById('back-btn');

// Settings inputs
const notifCheckbox = document.getElementById('notif-toggle');
const slider = document.getElementById('threshold-slider');
const sliderDisplay = document.getElementById('threshold-display');
const clearBtn = document.getElementById('clear-btn');
const clearConfirm = document.getElementById('clear-confirm');
const clearYes = document.getElementById('clear-yes');
const clearNo = document.getElementById('clear-no');
const archiveCountEl = document.getElementById('archive-count');

// Support elements
const tipBtn = document.getElementById('tip-btn');

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  await loadData();
  searchInput.focus();
  renderDefaultView();
}

init();

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadData() {
  const [storage, openTabs] = await Promise.all([
    new Promise((r) =>
      chrome.storage.local.get(['archive', 'tabs_metadata', 'settings'], r)
    ),
    new Promise((r) =>
      chrome.runtime.sendMessage({ type: 'IBD_GET_TABS' }, (tabs) => {
        void chrome.runtime.lastError;
        r(tabs ?? []);
      })
    ),
  ]);

  threshold = (storage.settings ?? {}).notification_threshold ?? DEFAULT_THRESHOLD;

  const archive = storage.archive ?? {};
  const metadata = storage.tabs_metadata ?? {};
  const now = Date.now();

  archivedItems = Object.values(archive)
    .map((e) => ({
      type: 'archived',
      id: e.id,
      url: e.url,
      title: e.title || e.url,
      favicon_url: e.favicon_url || '',
      archived_at: e.archived_at ?? now,
      age_ms: now - (e.archived_at ?? now),
    }))
    .sort((a, b) => b.archived_at - a.archived_at);

  openItems = openTabs
    .filter(
      (t) =>
        t.url &&
        !t.url.startsWith('chrome') &&
        !t.url.startsWith('about:') &&
        !t.url.startsWith('chrome-extension://')
    )
    .map((t) => {
      const meta = metadata[t.id] ?? {};
      const since = t.lastAccessed ?? meta.last_visited ?? meta.opened_at ?? now;
      const daysInactive = Math.floor((now - since) / MS_PER_DAY);
      return {
        type: 'open',
        tabId: t.id,
        windowId: t.windowId,
        url: t.url,
        title: t.title || t.url,
        favicon_url: t.favIconUrl || '',
        age_ms: now - since,
        daysInactive,
        isSuggested:
          daysInactive >= threshold &&
          !t.pinned &&
          !t.audible &&
          !(meta.kept_until && meta.kept_until > now),
      };
    })
    .sort((a, b) => b.daysInactive - a.daysInactive);
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderResults(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    renderDefaultView();
    return;
  }

  closeFooter.classList.add('hidden');
  const allItems = [...archivedItems, ...openItems];
  filtered = allItems
    .filter((i) => i.title.toLowerCase().includes(q) || i.url.toLowerCase().includes(q))
    .slice(0, 50);

  resultsList.innerHTML = '';

  if (filtered.length === 0) {
    resultsList.innerHTML = '<div class="empty">No results.</div>';
    activeIdx = -1;
    return;
  }

  filtered.forEach((item, idx) => resultsList.appendChild(buildRow(item, idx, true)));
  activeIdx = 0;
  highlightActive();
}

function renderDefaultView() {
  resultsList.innerHTML = '';
  filtered = [];
  closeFooter.classList.add('hidden');

  const stale = openItems.filter((i) => i.isSuggested);
  const open  = openItems.filter((i) => !i.isSuggested);

  // ── STALE section ──
  if (stale.length > 0) {
    const staleHeaderRow = document.createElement('div');
    staleHeaderRow.className = 'section-header-row';

    const staleLabel = document.createElement('span');
    staleLabel.className = 'section-count section-count--stale';
    staleLabel.textContent = `STALE (${stale.length})`;
    staleHeaderRow.appendChild(staleLabel);

    const closeAllBtn = document.createElement('button');
    closeAllBtn.className = 'close-inline-btn';
    closeAllBtn.textContent = `Close ${stale.length}`;
    closeAllBtn.addEventListener('click', () => closeSuggestedTabs(stale));
    staleHeaderRow.appendChild(closeAllBtn);

    resultsList.appendChild(staleHeaderRow);

    for (const item of stale) {
      const row = buildRow(item, filtered.length, false);
      row.classList.add('row--suggested');
      resultsList.appendChild(row);
      filtered.push(item);
    }

    const divider1 = document.createElement('div');
    divider1.className = 'section-divider';
    resultsList.appendChild(divider1);
  } else {
    const caughtUp = document.createElement('div');
    caughtUp.className = 'all-caught-up';
    const dot = document.createElement('span');
    dot.className = 'all-caught-up-dot';
    caughtUp.appendChild(dot);
    caughtUp.appendChild(document.createTextNode('All caught up — no stale tabs'));
    resultsList.appendChild(caughtUp);

    const divider0 = document.createElement('div');
    divider0.className = 'section-divider';
    resultsList.appendChild(divider0);
  }

  // ── ALL OPEN section ──
  if (openItems.length > 0) {
    const openHeaderRow = document.createElement('div');
    openHeaderRow.className = 'section-header-row';
    const openLabel = document.createElement('span');
    openLabel.className = 'section-count';
    openLabel.textContent = `OPEN (${openItems.length})`;
    openHeaderRow.appendChild(openLabel);
    resultsList.appendChild(openHeaderRow);

    for (const item of open) {
      const row = buildRow(item, filtered.length, false);
      resultsList.appendChild(row);
      filtered.push(item);
    }
  }

  // ── RECENTLY ARCHIVED section ──
  const recent = archivedItems.slice(0, 20);
  if (recent.length > 0) {
    const divider2 = document.createElement('div');
    divider2.className = 'section-divider';
    resultsList.appendChild(divider2);

    const archHeaderRow = document.createElement('div');
    archHeaderRow.className = 'section-header-row';
    const archLabel = document.createElement('span');
    archLabel.className = 'section-count';
    archLabel.textContent = 'RECENTLY ARCHIVED';
    archHeaderRow.appendChild(archLabel);
    resultsList.appendChild(archHeaderRow);

    for (const item of recent) {
      const row = buildRow(item, filtered.length, false);
      resultsList.appendChild(row);
      filtered.push(item);
    }
  }

  if (filtered.length === 0 && openItems.length === 0) {
    resultsList.innerHTML = '<div class="empty">No tabs tracked yet.</div>';
    activeIdx = -1;
    return;
  }

  activeIdx = 0;
  highlightActive();
}

// ── Row building ──────────────────────────────────────────────────────────────

function buildRow(item, idx, showCloseBtn = false) {
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.idx = String(idx);

  const dot = document.createElement('span');
  dot.className = `dot dot--${item.type}`;
  row.appendChild(dot);

  const fav = document.createElement('img');
  fav.className = 'favicon';
  fav.src = item.favicon_url || fallbackSvg();
  fav.addEventListener('error', () => { fav.src = fallbackSvg(); });
  row.appendChild(fav);

  const info = document.createElement('div');
  info.className = 'info';

  const titleEl = document.createElement('div');
  titleEl.className = 'title';
  titleEl.textContent = item.title;
  info.appendChild(titleEl);

  const urlEl = document.createElement('div');
  urlEl.className = 'url';
  urlEl.textContent = shortUrl(item.url);
  info.appendChild(urlEl);

  row.appendChild(info);

  const age = document.createElement('span');
  age.className = 'age';
  if (item.type === 'open') {
    age.textContent = item.daysInactive === 0 ? 'Just visited' : formatAge(item.age_ms);
  } else {
    age.textContent = formatAge(item.age_ms);
  }
  row.appendChild(age);

  // Keep button (stale open tabs in management view)
  if (item.type === 'open' && item.isSuggested) {
    const keepBtn = document.createElement('button');
    keepBtn.className = 'keep';
    keepBtn.textContent = 'Keep';
    keepBtn.title = 'Remove from suggestions for 30 days';
    keepBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ type: 'IBD_KEEP_TAB', tabId: item.tabId });
      item.isSuggested = false;
      row.classList.remove('row--suggested');
      keepBtn.remove();

      const staleLabel = resultsList.querySelector('.section-count--stale');
      const closeInline = resultsList.querySelector('.close-inline-btn');
      const remaining = openItems.filter((i) => i.isSuggested);

      if (remaining.length === 0) {
        const staleHeaderRow = staleLabel?.closest('.section-header-row');
        if (staleHeaderRow) staleHeaderRow.remove();
        const firstDiv = resultsList.querySelector('.section-divider');
        if (firstDiv) firstDiv.remove();
        const caughtUp = document.createElement('div');
        caughtUp.className = 'all-caught-up';
        const cDot = document.createElement('span');
        cDot.className = 'all-caught-up-dot';
        caughtUp.appendChild(cDot);
        caughtUp.appendChild(document.createTextNode('All caught up — no stale tabs'));
        resultsList.insertBefore(caughtUp, resultsList.firstChild);
        const divider = document.createElement('div');
        divider.className = 'section-divider';
        resultsList.insertBefore(divider, caughtUp.nextSibling);
      } else {
        if (staleLabel) staleLabel.textContent = `STALE (${remaining.length})`;
        if (closeInline) {
          closeInline.textContent = `Close ${remaining.length}`;
          closeInline.onclick = () => closeSuggestedTabs(remaining);
        }
      }
    });
    row.appendChild(keepBtn);
  }

  // Close-tab button
  if (item.type === 'open' && (item.isSuggested || showCloseBtn)) {
    const closeTabBtn = document.createElement('button');
    closeTabBtn.className = 'close-tab';
    closeTabBtn.textContent = '×';
    closeTabBtn.title = 'Close this tab';
    closeTabBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSingleTab(item, row);
    });
    row.appendChild(closeTabBtn);
  }

  // Delete button (archived rows)
  if (item.type === 'archived') {
    const del = document.createElement('button');
    del.className = 'delete';
    del.textContent = '×';
    del.title = 'Remove from history';
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      await removeArchiveEntry(item, row, parseInt(row.dataset.idx, 10));
    });
    row.appendChild(del);
  }

  row.addEventListener('click', () => activateItem(item));
  return row;
}

function highlightActive() {
  const rows = resultsList.querySelectorAll('.row');
  rows.forEach((r, i) => r.classList.toggle('row--active', i === activeIdx));
  if (activeIdx >= 0 && rows[activeIdx]) rows[activeIdx].scrollIntoView({ block: 'nearest' });
}

// ── Actions ───────────────────────────────────────────────────────────────────

function activateItem(item) {
  if (item.type === 'open') {
    chrome.runtime.sendMessage({ type: 'IBD_FOCUS_TAB', tabId: item.tabId, windowId: item.windowId });
    window.close();
  } else {
    chrome.runtime.sendMessage({ type: 'IBD_OPEN_URL', url: item.url });
    window.close();
  }
}

async function closeSuggestedTabs(suggested) {
  const tabIds = suggested.map((i) => i.tabId);

  const rows = Array.from(resultsList.querySelectorAll('.row'));
  rows.forEach((r) => {
    if (filtered[parseInt(r.dataset.idx, 10)]?.isSuggested) r.remove();
  });

  const staleHeader = resultsList.querySelector('.section-header-row');
  if (staleHeader) staleHeader.remove();
  const firstDivider = resultsList.querySelector('.section-divider');
  if (firstDivider) firstDivider.remove();

  filtered = filtered.filter((i) => !i.isSuggested);
  resultsList.querySelectorAll('.row').forEach((r, i) => { r.dataset.idx = String(i); });

  const caughtUp = document.createElement('div');
  caughtUp.className = 'all-caught-up';
  const cDot = document.createElement('span');
  cDot.className = 'all-caught-up-dot';
  caughtUp.appendChild(cDot);
  caughtUp.appendChild(document.createTextNode('All caught up — no stale tabs'));
  resultsList.insertBefore(caughtUp, resultsList.firstChild);

  const divider = document.createElement('div');
  divider.className = 'section-divider';
  resultsList.insertBefore(divider, caughtUp.nextSibling);

  const result = await new Promise((r) =>
    chrome.runtime.sendMessage({ type: 'IBD_CLOSE_TABS', tabIds }, (res) => {
      void chrome.runtime.lastError;
      r(res ?? {});
    })
  );

  showUndoToast(tabIds.length, result.entryIds ?? [], result.tabs ?? []);
}

async function closeSingleTab(item, rowEl) {
  rowEl.remove();
  const idx = parseInt(rowEl.dataset.idx, 10);
  filtered.splice(idx, 1);
  resultsList.querySelectorAll('.row').forEach((r, i) => { r.dataset.idx = String(i); });

  const result = await new Promise((r) =>
    chrome.runtime.sendMessage({ type: 'IBD_CLOSE_TABS', tabIds: [item.tabId] }, (res) => {
      void chrome.runtime.lastError;
      r(res ?? {});
    })
  );

  showUndoToast(1, result.entryIds ?? [], result.tabs ?? []);
}

async function removeArchiveEntry(item, rowEl, idx) {
  const result = await new Promise((r) => chrome.storage.local.get('archive', r));
  const archive = result.archive ?? {};
  delete archive[item.id];
  await new Promise((r) => chrome.storage.local.set({ archive }, r));

  archivedItems = archivedItems.filter((i) => i.id !== item.id);
  filtered.splice(idx, 1);
  rowEl.remove();

  resultsList.querySelectorAll('.row').forEach((r, i) => { r.dataset.idx = String(i); });
  if (filtered.length === 0) activeIdx = -1;
  else if (activeIdx >= filtered.length) activeIdx = filtered.length - 1;
  highlightActive();
}

// ── Undo toast ────────────────────────────────────────────────────────────────

const UNDO_TIMEOUT_MS = 5000;

function showUndoToast(count, entryIds, tabs) {
  if (pendingUndo?.timerId) clearTimeout(pendingUndo.timerId);

  pendingUndo = {
    entryIds,
    tabs,
    timerId: setTimeout(() => {
      undoToast.classList.add('hidden');
      pendingUndo = null;
    }, UNDO_TIMEOUT_MS),
  };

  undoMsg.textContent = `Closed ${count} tab${count === 1 ? '' : 's'}.`;
  undoToast.classList.remove('hidden');

  undoBtn.onclick = async () => {
    if (!pendingUndo) return;
    clearTimeout(pendingUndo.timerId);
    const { entryIds: ids, tabs: reopenTabs } = pendingUndo;
    pendingUndo = null;
    undoToast.classList.add('hidden');

    for (const t of reopenTabs) {
      chrome.runtime.sendMessage({ type: 'IBD_OPEN_URL', url: t.url });
    }

    if (ids?.length) {
      const res = await new Promise((r) => chrome.storage.local.get('archive', r));
      const archive = res.archive ?? {};
      for (const id of ids) delete archive[id];
      await new Promise((r) => chrome.storage.local.set({ archive }, r));
    }
  };
}

// ── Settings ──────────────────────────────────────────────────────────────────

const headerEl = document.querySelector('.header');

settingsBtn.addEventListener('click', () => {
  headerEl?.classList.add('hidden');
  mainView.classList.add('hidden');
  settingsView.classList.remove('hidden');
  loadSettingsData();
});

backBtn.addEventListener('click', () => {
  settingsView.classList.add('hidden');
  mainView.classList.remove('hidden');
  headerEl?.classList.remove('hidden');
});

async function loadSettingsData() {
  const storage = await new Promise((r) =>
    chrome.storage.local.get(['settings', 'archive'], r)
  );
  const settings = storage.settings ?? {};
  notifCheckbox.checked = settings.notifications_enabled !== false;
  slider.value = String(settings.notification_threshold ?? 10);
  sliderDisplay.textContent = slider.value;

  const archiveCount = Object.keys(storage.archive ?? {}).length;
  archiveCountEl.textContent = `${archiveCount.toLocaleString()} archived tab${archiveCount === 1 ? '' : 's'} stored on this device.`;

}

if (tipBtn) {
  tipBtn.addEventListener('click', () => {
    tipBtn.disabled = true;
    tipBtn.textContent = 'Opening…';
    chrome.runtime.sendMessage({ type: 'IBD_OPEN_TIP_JAR' }, () => {
      void chrome.runtime.lastError;
      tipBtn.disabled = false;
      tipBtn.textContent = 'Buy Me a Coffee →';
    });
  });
}

if (notifCheckbox) {
  notifCheckbox.addEventListener('change', () => {
    chrome.storage.local.get('settings', (r) => {
      const s = r.settings ?? {};
      chrome.storage.local.set({ settings: { ...s, notifications_enabled: notifCheckbox.checked } });
    });
  });
}

if (slider) {
  slider.addEventListener('input', () => { if (sliderDisplay) sliderDisplay.textContent = slider.value; });
  slider.addEventListener('change', () => {
    chrome.storage.local.get('settings', (r) => {
      const s = r.settings ?? {};
      chrome.storage.local.set({ settings: { ...s, notification_threshold: Number(slider.value) } });
    });
  });
}

if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    clearBtn.classList.add('hidden');
    if (clearConfirm) clearConfirm.classList.remove('hidden');
  });
}

if (clearNo) {
  clearNo.addEventListener('click', () => {
    if (clearConfirm) clearConfirm.classList.add('hidden');
    clearBtn.classList.remove('hidden');
  });
}

if (clearYes) {
  clearYes.addEventListener('click', async () => {
    await new Promise((r) => chrome.storage.local.set({ archive: {} }, r));
    if (archiveCountEl) archiveCountEl.textContent = '0 archived tabs stored on this device.';
    if (clearConfirm) clearConfirm.classList.add('hidden');
    clearBtn.classList.remove('hidden');
    archivedItems = [];
  });
}

// ── Keyboard navigation ───────────────────────────────────────────────────────

searchInput.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'Escape':
      e.preventDefault();
      window.close();
      break;
    case 'ArrowDown':
      e.preventDefault();
      if (filtered.length > 0) {
        activeIdx = Math.min(activeIdx + 1, filtered.length - 1);
        highlightActive();
      }
      break;
    case 'ArrowUp':
      e.preventDefault();
      if (filtered.length > 0) {
        activeIdx = Math.max(activeIdx - 1, 0);
        highlightActive();
      }
      break;
    case 'Enter':
      e.preventDefault();
      if (activeIdx >= 0 && filtered[activeIdx]) activateItem(filtered[activeIdx]);
      break;
    case 'Delete':
      if (activeIdx >= 0 && filtered[activeIdx]?.type === 'archived') {
        e.preventDefault();
        const item = filtered[activeIdx];
        const rows = resultsList.querySelectorAll('.row');
        if (rows[activeIdx]) removeArchiveEntry(item, rows[activeIdx], activeIdx);
      }
      break;
  }
});

searchInput.addEventListener('input', () => renderResults(searchInput.value));

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAge(ms) {
  const d = Math.floor(ms / MS_PER_DAY);
  if (d >= 1) return `${d}d`;
  const h = Math.floor(ms / 3600000);
  if (h >= 1) return `${h}h`;
  return `${Math.max(Math.floor(ms / 60000), 1)}m`;
}

function shortUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname.replace(/\/$/, '') || '');
  } catch {
    return url;
  }
}

function fallbackSvg() {
  return (
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E" +
    "%3Crect width='16' height='16' rx='3' fill='%23e5e7eb'/%3E%3C/svg%3E"
  );
}
