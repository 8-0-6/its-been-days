// It's Been Days — Overlay content script
// Unified interface: ranked open tabs + archive, search, close-suggested, undo.
// Injected into the active tab on Cmd+Shift+Space or toolbar icon click.
// Communicates with background.js for tab operations (chrome.tabs not available
// in content scripts).

(function () {
  'use strict';

  if (window.__ibdOverlayInit) return;
  window.__ibdOverlayInit = true;

  const MS_PER_DAY = 86400000;
  const DEFAULT_THRESHOLD = 10;

  // ── Shadow DOM setup ───────────────────────────────────────────────────────

  const host = document.createElement('div');
  host.id = 'ibd-overlay-root';
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; top: 0; left: 0;';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = chrome.runtime.getURL('overlay/overlay.css');
  shadow.appendChild(styleLink);

  const backdrop = document.createElement('div');
  backdrop.className = 'ibd-backdrop ibd-hidden';
  shadow.appendChild(backdrop);

  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close();
  });

  const panel = document.createElement('div');
  panel.className = 'ibd-panel';
  backdrop.appendChild(panel);

  // ── Header: search + ESC hint + settings gear ──────────────────────────────

  const header = document.createElement('div');
  header.className = 'ibd-header';
  panel.appendChild(header);

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'ibd-search';
  searchInput.placeholder = 'Search open & closed tabs\u2026';
  searchInput.setAttribute('autocomplete', 'off');
  searchInput.setAttribute('autocorrect', 'off');
  searchInput.setAttribute('spellcheck', 'false');
  header.appendChild(searchInput);

  const escHint = document.createElement('kbd');
  escHint.className = 'ibd-esc';
  escHint.textContent = 'ESC';
  header.appendChild(escHint);

  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'ibd-settings-btn';
  settingsBtn.title = 'Settings';
  settingsBtn.innerHTML =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="3"/>' +
    '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' +
    '</svg>';
  header.appendChild(settingsBtn);
  settingsBtn.addEventListener('click', () => showSettings());

  // ── Main view ──────────────────────────────────────────────────────────────

  const mainView = document.createElement('div');
  mainView.className = 'ibd-main-view';
  panel.appendChild(mainView);

  const resultsList = document.createElement('div');
  resultsList.className = 'ibd-results';
  mainView.appendChild(resultsList);

  // Close-footer kept for search-mode compat
  const closeFooter = document.createElement('div');
  closeFooter.className = 'ibd-close-footer ibd-hidden';
  mainView.appendChild(closeFooter);

  const closeFooterBtn = document.createElement('button');
  closeFooterBtn.className = 'ibd-close-all-btn';
  closeFooter.appendChild(closeFooterBtn);

  const undoToast = document.createElement('div');
  undoToast.className = 'ibd-undo-toast ibd-hidden';
  mainView.appendChild(undoToast);

  const undoMsg = document.createElement('span');
  undoToast.appendChild(undoMsg);

  const undoBtn = document.createElement('button');
  undoBtn.className = 'ibd-undo-btn';
  undoBtn.textContent = 'Undo';
  undoToast.appendChild(undoBtn);

  // ── Onboarding view ────────────────────────────────────────────────────────

  const onboardingView = document.createElement('div');
  onboardingView.className = 'ibd-onboarding-view ibd-hidden';
  panel.appendChild(onboardingView);

  const onboardingBody = document.createElement('div');
  onboardingBody.className = 'ibd-onboarding-body';
  onboardingView.appendChild(onboardingBody);

  const onboardingTitle = document.createElement('p');
  onboardingTitle.className = 'ibd-onboarding-title';
  onboardingTitle.textContent = 'Your tabs have been quietly aging. Now you\u2019ll know.';
  onboardingBody.appendChild(onboardingTitle);

  const onboardingBullets = document.createElement('ul');
  onboardingBullets.className = 'ibd-onboarding-bullets';
  ['Track how long tabs have been open', 'Close stale ones in one place', 'Reopen anything from your archive'].forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    onboardingBullets.appendChild(li);
  });
  onboardingBody.appendChild(onboardingBullets);

  const importCard = document.createElement('div');
  importCard.className = 'ibd-onboarding-import-card';
  onboardingBody.appendChild(importCard);

  const importTitle = document.createElement('p');
  importTitle.className = 'ibd-onboarding-import-title';
  importTitle.textContent = 'Import browser history (optional)';
  importCard.appendChild(importTitle);

  const importSub = document.createElement('p');
  importSub.className = 'ibd-onboarding-import-sub';
  importSub.textContent = 'Gives you an archive to search from day 1.';
  importCard.appendChild(importSub);

  const importBtn = document.createElement('button');
  importBtn.className = 'ibd-btn ibd-btn-ghost';
  importBtn.textContent = 'Import history';
  importCard.appendChild(importBtn);

  const importStatus = document.createElement('p');
  importStatus.className = 'ibd-import-status ibd-hidden';
  importCard.appendChild(importStatus);

  const getStartedBtn = document.createElement('button');
  getStartedBtn.className = 'ibd-btn ibd-btn-primary';
  getStartedBtn.textContent = 'Get started \u2192';
  onboardingBody.appendChild(getStartedBtn);

  // ── Settings view ──────────────────────────────────────────────────────────

  const settingsView = document.createElement('div');
  settingsView.className = 'ibd-settings-view ibd-hidden';
  panel.appendChild(settingsView);

  const settingsHeader = document.createElement('div');
  settingsHeader.className = 'ibd-settings-header';
  settingsView.appendChild(settingsHeader);

  const backBtn = document.createElement('button');
  backBtn.className = 'ibd-back-btn';
  backBtn.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
    ' Back';
  backBtn.addEventListener('click', () => hideSettings());
  settingsHeader.appendChild(backBtn);

  const settingsTitle = document.createElement('span');
  settingsTitle.className = 'ibd-settings-title';
  settingsTitle.textContent = 'Settings';
  settingsHeader.appendChild(settingsTitle);

  const settingsBody = document.createElement('div');
  settingsBody.className = 'ibd-settings-body';
  settingsView.appendChild(settingsBody);

  function makeSection(label) {
    const sec = document.createElement('div');
    sec.className = 'ibd-set-section';
    const h = document.createElement('div');
    h.className = 'ibd-set-label';
    h.textContent = label;
    sec.appendChild(h);
    settingsBody.appendChild(sec);
    return sec;
  }

  // — Notifications —
  const notifSection = makeSection('Notifications');

  const toggleRow = document.createElement('label');
  toggleRow.className = 'ibd-set-toggle-row';
  notifSection.appendChild(toggleRow);

  const toggleSpan = document.createElement('span');
  toggleSpan.textContent = 'Enable desktop notifications';
  toggleRow.appendChild(toggleSpan);

  const toggleWrap = document.createElement('span');
  toggleWrap.className = 'ibd-toggle-wrap';
  const notifCheckbox = document.createElement('input');
  notifCheckbox.type = 'checkbox';
  const toggleTrack = document.createElement('span');
  toggleTrack.className = 'ibd-toggle-track';
  toggleWrap.appendChild(notifCheckbox);
  toggleWrap.appendChild(toggleTrack);
  toggleRow.appendChild(toggleWrap);

  const sliderRow = document.createElement('div');
  sliderRow.className = 'ibd-set-slider-row';
  notifSection.appendChild(sliderRow);

  const sliderLabel = document.createElement('label');
  sliderLabel.className = 'ibd-set-slider-label';
  const sliderDisplay = document.createElement('strong');
  sliderDisplay.id = 'ibd-threshold-display';
  sliderLabel.innerHTML = 'Suggest & notify after ';
  sliderLabel.appendChild(sliderDisplay);
  sliderLabel.appendChild(document.createTextNode(' days of inactivity'));
  sliderRow.appendChild(sliderLabel);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '1';
  slider.max = '30';
  slider.className = 'ibd-slider';
  sliderRow.appendChild(slider);

  const sliderEnds = document.createElement('div');
  sliderEnds.className = 'ibd-slider-ends';
  sliderEnds.innerHTML = '<span>1 day</span><span>30 days</span>';
  sliderRow.appendChild(sliderEnds);

  // — Support —
  const supportSection = makeSection('Support');
  const supportText = document.createElement('p');
  supportText.className = 'ibd-set-muted';
  supportText.textContent = 'Free and open source. If this helps you, consider buying me a coffee.';
  supportSection.appendChild(supportText);

  const tipRow = document.createElement('div');
  tipRow.className = 'ibd-account-row';
  const tipBtn = document.createElement('button');
  tipBtn.className = 'ibd-btn ibd-btn-primary';
  tipBtn.textContent = 'Buy Me a Coffee \u2192';
  tipRow.appendChild(tipBtn);
  supportSection.appendChild(tipRow);

  // — Archive —
  const archiveSection = makeSection('Archive');

  const archiveCountEl = document.createElement('p');
  archiveCountEl.className = 'ibd-set-muted';
  archiveSection.appendChild(archiveCountEl);

  const clearBtn = document.createElement('button');
  clearBtn.className = 'ibd-btn ibd-btn-destructive';
  clearBtn.textContent = 'Clear all archived tabs';
  archiveSection.appendChild(clearBtn);

  const clearConfirm = document.createElement('div');
  clearConfirm.className = 'ibd-clear-confirm ibd-hidden';
  clearConfirm.innerHTML = '<strong>This cannot be undone.</strong>';
  const clearYes = document.createElement('button');
  clearYes.className = 'ibd-btn ibd-btn-destructive-sm';
  clearYes.textContent = 'Yes, delete everything';
  const clearNo = document.createElement('button');
  clearNo.className = 'ibd-btn ibd-btn-ghost-sm';
  clearNo.textContent = 'Cancel';
  clearConfirm.appendChild(clearYes);
  clearConfirm.appendChild(clearNo);
  archiveSection.appendChild(clearConfirm);

  // — Keyboard shortcut —
  const kbSection = makeSection('Keyboard Shortcut');
  const kbNote = document.createElement('p');
  kbNote.className = 'ibd-set-muted';
  kbNote.innerHTML =
    '<kbd class="ibd-kbd">\u2318 Shift Space</kbd> opens this overlay. ' +
    'If it doesn\u2019t work, another app (Alfred, Raycast) may be claiming it.';
  kbSection.appendChild(kbNote);

  // ── State ──────────────────────────────────────────────────────────────────

  let openItems = [];
  let archivedItems = [];
  let allItems = [];
  let filtered = [];
  let activeIdx = -1;
  let overlayOpen = false;
  let threshold = DEFAULT_THRESHOLD;
  let pendingUndo = null;
  let onboardingDone = false;

  // ── Toggle / open / close ──────────────────────────────────────────────────

  function toggle() {
    overlayOpen ? close() : openOverlay();
  }

  async function openOverlay() {
    overlayOpen = true;
    backdrop.classList.remove('ibd-hidden');
    searchInput.value = '';
    requestAnimationFrame(() => searchInput.focus());

    const [, onboarding] = await Promise.all([
      loadData(),
      new Promise((r) =>
        chrome.runtime.sendMessage({ type: 'IBD_GET_ONBOARDING' }, (data) => {
          void chrome.runtime.lastError;
          r(data ?? { history_import_offered: true });
        })
      ),
    ]);

    if (!overlayOpen) return;

    if (!onboardingDone && !onboarding.history_import_offered) {
      showOnboarding();
      return;
    }

    resultsList.classList.remove('ibd-hidden');
    renderResults('');
  }

  function close() {
    overlayOpen = false;
    backdrop.classList.add('ibd-hidden');
    activeIdx = -1;
    closeFooter.classList.add('ibd-hidden');
    settingsView.classList.add('ibd-hidden');
    onboardingView.classList.add('ibd-hidden');
    mainView.classList.remove('ibd-hidden');
  }

  // ── Onboarding ─────────────────────────────────────────────────────────────

  function showOnboarding() {
    mainView.classList.add('ibd-hidden');
    settingsView.classList.add('ibd-hidden');
    onboardingView.classList.remove('ibd-hidden');
    importBtn.disabled = false;
    importBtn.textContent = 'Import history';
    importStatus.className = 'ibd-import-status ibd-hidden';
    importStatus.textContent = '';
  }

  function dismissOnboarding() {
    onboardingDone = true;
    chrome.runtime.sendMessage({ type: 'IBD_SET_ONBOARDING', data: { history_import_offered: true } });
    onboardingView.classList.add('ibd-hidden');
    mainView.classList.remove('ibd-hidden');
    resultsList.classList.remove('ibd-hidden');
    renderResults('');
  }

  getStartedBtn.addEventListener('click', () => dismissOnboarding());

  importBtn.addEventListener('click', () => {
    importBtn.disabled = true;
    importBtn.textContent = 'Requesting permission\u2026';
    importStatus.className = 'ibd-import-status ibd-hidden';

    chrome.permissions.request({ permissions: ['history'] }, (granted) => {
      void chrome.runtime.lastError;
      if (!granted) {
        importStatus.textContent = 'Permission denied \u2014 history not imported.';
        importStatus.className = 'ibd-import-status ibd-import-status--error';
        importStatus.classList.remove('ibd-hidden');
        importBtn.disabled = false;
        importBtn.textContent = 'Import history';
        return;
      }
      importBtn.textContent = 'Importing\u2026';
      chrome.runtime.sendMessage({ type: 'IBD_IMPORT_HISTORY' }, (res) => {
        void chrome.runtime.lastError;
        if (res?.ok) {
          importStatus.textContent = `Done \u2014 ${res.count} tab${res.count === 1 ? '' : 's'} imported.`;
          importStatus.className = 'ibd-import-status ibd-import-status--success';
          importStatus.classList.remove('ibd-hidden');
          importBtn.textContent = 'Import history';
          importBtn.disabled = true;
          loadData();
        } else {
          importStatus.textContent = `Import failed: ${res?.error ?? 'unknown error'}`;
          importStatus.className = 'ibd-import-status ibd-import-status--error';
          importStatus.classList.remove('ibd-hidden');
          importBtn.disabled = false;
          importBtn.textContent = 'Import history';
        }
      });
    });
  });

  // ── Settings ───────────────────────────────────────────────────────────────

  async function showSettings() {
    mainView.classList.add('ibd-hidden');
    onboardingView.classList.add('ibd-hidden');
    settingsView.classList.remove('ibd-hidden');
    await loadSettingsData();
  }

  function hideSettings() {
    settingsView.classList.add('ibd-hidden');
    mainView.classList.remove('ibd-hidden');
  }

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

  notifCheckbox.addEventListener('change', () => {
    chrome.storage.local.get('settings', (r) => {
      const s = r.settings ?? {};
      chrome.storage.local.set({ settings: { ...s, notifications_enabled: notifCheckbox.checked } });
    });
  });

  slider.addEventListener('input', () => { sliderDisplay.textContent = slider.value; });
  slider.addEventListener('change', () => {
    chrome.storage.local.get('settings', (r) => {
      const s = r.settings ?? {};
      chrome.storage.local.set({ settings: { ...s, notification_threshold: Number(slider.value) } });
    });
  });

  tipBtn.addEventListener('click', () => {
    tipBtn.disabled = true;
    tipBtn.textContent = 'Opening\u2026';
    chrome.runtime.sendMessage({ type: 'IBD_OPEN_TIP_JAR' }, () => {
      void chrome.runtime.lastError;
      tipBtn.disabled = false;
      tipBtn.textContent = 'Buy Me a Coffee \u2192';
    });
  });

  clearBtn.addEventListener('click', () => {
    clearBtn.classList.add('ibd-hidden');
    clearConfirm.classList.remove('ibd-hidden');
  });

  clearNo.addEventListener('click', () => {
    clearConfirm.classList.add('ibd-hidden');
    clearBtn.classList.remove('ibd-hidden');
  });

  clearYes.addEventListener('click', async () => {
    await new Promise((r) => chrome.storage.local.set({ archive: {} }, r));
    archiveCountEl.textContent = '0 archived tabs stored on this device.';
    clearConfirm.classList.add('ibd-hidden');
    clearBtn.classList.remove('ibd-hidden');
    archivedItems = [];
    allItems = [...openItems];
  });

  // ── Data loading ────────────────────────────────────────────────────────────

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
          isSuggested: daysInactive >= threshold && !t.pinned && !t.audible &&
            !(meta.kept_until && meta.kept_until > now),
        };
      })
      .sort((a, b) => b.daysInactive - a.daysInactive);

    allItems = [...archivedItems, ...openItems];
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  function renderResults(query) {
    const q = query.trim().toLowerCase();

    if (!q) {
      renderDefaultView();
      return;
    }

    // Search mode — flat filtered list
    closeFooter.classList.add('ibd-hidden');
    filtered = allItems
      .filter((i) => i.title.toLowerCase().includes(q) || i.url.toLowerCase().includes(q))
      .slice(0, 50);

    resultsList.innerHTML = '';

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ibd-empty';
      empty.textContent = 'No results.';
      resultsList.appendChild(empty);
      activeIdx = -1;
      return;
    }

    // In search mode every open-tab row gets a close button
    filtered.forEach((item, idx) => resultsList.appendChild(buildRow(item, idx, true)));
    activeIdx = 0;
    highlightActive();
  }

  // Management view: STALE → ALL OPEN → RECENTLY ARCHIVED
  function renderDefaultView() {
    resultsList.innerHTML = '';
    filtered = [];
    closeFooter.classList.add('ibd-hidden');

    const stale = openItems.filter((i) => i.isSuggested);
    const open  = openItems.filter((i) => !i.isSuggested);

    // ── STALE section ──
    if (stale.length > 0) {
      const staleHeaderRow = document.createElement('div');
      staleHeaderRow.className = 'ibd-section-header-row';

      const staleLabel = document.createElement('span');
      staleLabel.className = 'ibd-section-count ibd-section-count--stale';
      staleLabel.textContent = `STALE (${stale.length})`;
      staleHeaderRow.appendChild(staleLabel);

      const closeAllBtn = document.createElement('button');
      closeAllBtn.className = 'ibd-close-inline-btn';
      closeAllBtn.textContent = `Close ${stale.length}`;
      closeAllBtn.addEventListener('click', () => closeSuggestedTabs(stale));
      staleHeaderRow.appendChild(closeAllBtn);

      resultsList.appendChild(staleHeaderRow);

      for (const item of stale) {
        const row = buildRow(item, filtered.length, false);
        row.classList.add('ibd-row--suggested');
        resultsList.appendChild(row);
        filtered.push(item);
      }

      const divider1 = document.createElement('div');
      divider1.className = 'ibd-section-divider';
      resultsList.appendChild(divider1);
    } else {
      // All caught up
      const caughtUp = document.createElement('div');
      caughtUp.className = 'ibd-all-caught-up';
      const dot = document.createElement('span');
      dot.className = 'ibd-all-caught-up-dot';
      caughtUp.appendChild(dot);
      caughtUp.appendChild(document.createTextNode('All caught up \u2014 no stale tabs'));
      resultsList.appendChild(caughtUp);

      const divider0 = document.createElement('div');
      divider0.className = 'ibd-section-divider';
      resultsList.appendChild(divider0);
    }

    // ── ALL OPEN section ──
    if (openItems.length > 0) {
      const openHeaderRow = document.createElement('div');
      openHeaderRow.className = 'ibd-section-header-row';
      const openLabel = document.createElement('span');
      openLabel.className = 'ibd-section-count';
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
      divider2.className = 'ibd-section-divider';
      resultsList.appendChild(divider2);

      const archHeaderRow = document.createElement('div');
      archHeaderRow.className = 'ibd-section-header-row';
      const archLabel = document.createElement('span');
      archLabel.className = 'ibd-section-count';
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
      const empty = document.createElement('div');
      empty.className = 'ibd-empty';
      empty.textContent = 'No tabs tracked yet.';
      resultsList.appendChild(empty);
      activeIdx = -1;
      return;
    }

    activeIdx = 0;
    highlightActive();
  }

  // ── Close suggested ─────────────────────────────────────────────────────────

  async function closeSuggestedTabs(suggested) {
    const tabIds = suggested.map((i) => i.tabId);

    // Remove stale rows from DOM immediately
    const rows = Array.from(resultsList.querySelectorAll('.ibd-row'));
    rows.forEach((r) => {
      const idx = parseInt(r.dataset.idx, 10);
      if (filtered[idx]?.isSuggested) r.remove();
    });

    // Remove the stale section header + first divider
    const staleHeader = resultsList.querySelector('.ibd-section-header-row');
    if (staleHeader) staleHeader.remove();
    const firstDivider = resultsList.querySelector('.ibd-section-divider');
    if (firstDivider) firstDivider.remove();

    filtered = filtered.filter((i) => !i.isSuggested);
    resultsList.querySelectorAll('.ibd-row').forEach((r, i) => { r.dataset.idx = String(i); });
    activeIdx = Math.min(Math.max(activeIdx, 0), filtered.length - 1);
    if (filtered.length > 0) highlightActive();

    // Insert "All caught up" after stale section removed
    const caughtUp = document.createElement('div');
    caughtUp.className = 'ibd-all-caught-up';
    const cDot = document.createElement('span');
    cDot.className = 'ibd-all-caught-up-dot';
    caughtUp.appendChild(cDot);
    caughtUp.appendChild(document.createTextNode('All caught up \u2014 no stale tabs'));
    resultsList.insertBefore(caughtUp, resultsList.firstChild);

    const divider = document.createElement('div');
    divider.className = 'ibd-section-divider';
    resultsList.insertBefore(divider, caughtUp.nextSibling);

    const result = await new Promise((r) =>
      chrome.runtime.sendMessage({ type: 'IBD_CLOSE_TABS', tabIds }, (res) => {
        void chrome.runtime.lastError;
        r(res ?? {});
      })
    );

    showUndoToast(tabIds.length, result.entryIds ?? [], result.tabs ?? []);
  }

  // Close a single open tab from the overlay
  async function closeSingleTab(item, rowEl) {
    rowEl.remove();
    const idx = parseInt(rowEl.dataset.idx, 10);
    filtered.splice(idx, 1);
    resultsList.querySelectorAll('.ibd-row').forEach((r, i) => { r.dataset.idx = String(i); });
    if (item.isSuggested) refreshCloseFooter();

    const result = await new Promise((r) =>
      chrome.runtime.sendMessage({ type: 'IBD_CLOSE_TABS', tabIds: [item.tabId] }, (res) => {
        void chrome.runtime.lastError;
        r(res ?? {});
      })
    );

    showUndoToast(1, result.entryIds ?? [], result.tabs ?? []);
  }

  // Recompute the inline close-all button label (only used in search mode footer)
  function refreshCloseFooter() {
    const stillSuggested = openItems.filter((i) => i.isSuggested);
    if (stillSuggested.length > 0) {
      closeFooterBtn.textContent =
        `Close ${stillSuggested.length} suggested tab${stillSuggested.length === 1 ? '' : 's'}`;
      closeFooter.classList.remove('ibd-hidden');
      closeFooterBtn.onclick = () => closeSuggestedTabs(stillSuggested);
    } else {
      closeFooter.classList.add('ibd-hidden');
    }
  }

  // ── Undo toast ──────────────────────────────────────────────────────────────

  const UNDO_TIMEOUT_MS = 5000;

  function showUndoToast(count, entryIds, tabs) {
    if (pendingUndo?.timerId) clearTimeout(pendingUndo.timerId);

    pendingUndo = {
      entryIds,
      tabs,
      timerId: setTimeout(() => {
        undoToast.classList.add('ibd-hidden');
        pendingUndo = null;
      }, UNDO_TIMEOUT_MS),
    };

    undoMsg.textContent = `Closed ${count} tab${count === 1 ? '' : 's'}.`;
    undoToast.classList.remove('ibd-hidden');

    undoBtn.onclick = async () => {
      if (!pendingUndo) return;
      clearTimeout(pendingUndo.timerId);
      const { entryIds: ids, tabs: reopenTabs } = pendingUndo;
      pendingUndo = null;
      undoToast.classList.add('ibd-hidden');

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

  // ── Row building ────────────────────────────────────────────────────────────
  // showCloseBtn: true in search mode for open-tab rows; false in management view

  function buildRow(item, idx, showCloseBtn = false) {
    const row = document.createElement('div');
    row.className = 'ibd-row';
    row.dataset.idx = String(idx);

    const dot = document.createElement('span');
    dot.className = `ibd-dot ibd-dot--${item.type}`;
    row.appendChild(dot);

    const fav = document.createElement('img');
    fav.className = 'ibd-favicon';
    fav.src = item.favicon_url || fallbackSvg();
    fav.addEventListener('error', () => { fav.src = fallbackSvg(); });
    row.appendChild(fav);

    const info = document.createElement('div');
    info.className = 'ibd-info';

    const titleEl = document.createElement('div');
    titleEl.className = 'ibd-title';
    titleEl.textContent = item.title;
    info.appendChild(titleEl);

    const urlEl = document.createElement('div');
    urlEl.className = 'ibd-url';
    urlEl.textContent = shortUrl(item.url);
    info.appendChild(urlEl);

    row.appendChild(info);

    const age = document.createElement('span');
    age.className = 'ibd-age';
    if (item.type === 'open') {
      age.textContent = item.daysInactive === 0 ? 'Just visited' : formatAge(item.age_ms);
    } else {
      age.textContent = formatAge(item.age_ms);
    }
    row.appendChild(age);

    // Keep button (stale open tabs in management view)
    if (item.type === 'open' && item.isSuggested) {
      const keepBtn = document.createElement('button');
      keepBtn.className = 'ibd-keep';
      keepBtn.textContent = 'Keep';
      keepBtn.title = 'Remove from suggestions for 30 days';
      keepBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ type: 'IBD_KEEP_TAB', tabId: item.tabId });
        item.isSuggested = false;
        row.classList.remove('ibd-row--suggested');
        keepBtn.remove();
        // Update the inline close-all count in the section header
        const staleLabel = resultsList.querySelector('.ibd-section-count--stale');
        const closeInline = resultsList.querySelector('.ibd-close-inline-btn');
        const remaining = openItems.filter((i) => i.isSuggested);
        if (remaining.length === 0) {
          // Transition to "all caught up"
          const staleHeaderRow = staleLabel?.closest('.ibd-section-header-row');
          if (staleHeaderRow) staleHeaderRow.remove();
          const firstDiv = resultsList.querySelector('.ibd-section-divider');
          if (firstDiv) firstDiv.remove();
          const caughtUp = document.createElement('div');
          caughtUp.className = 'ibd-all-caught-up';
          const cDot = document.createElement('span');
          cDot.className = 'ibd-all-caught-up-dot';
          caughtUp.appendChild(cDot);
          caughtUp.appendChild(document.createTextNode('All caught up \u2014 no stale tabs'));
          resultsList.insertBefore(caughtUp, resultsList.firstChild);
          const divider = document.createElement('div');
          divider.className = 'ibd-section-divider';
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

    // Close-tab button (stale rows in management view, or all open rows in search mode)
    if (item.type === 'open' && (item.isSuggested || showCloseBtn)) {
      const closeTabBtn = document.createElement('button');
      closeTabBtn.className = 'ibd-close-tab';
      closeTabBtn.textContent = '\u00d7';
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
      del.className = 'ibd-delete';
      del.textContent = '\u00d7';
      del.title = 'Remove from history';
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        const currentIdx = parseInt(row.dataset.idx, 10);
        await removeArchiveEntry(item, row, currentIdx);
      });
      row.appendChild(del);
    }

    row.addEventListener('click', () => activateItem(item));
    return row;
  }

  function highlightActive() {
    const rows = resultsList.querySelectorAll('.ibd-row');
    rows.forEach((r, i) => r.classList.toggle('ibd-row--active', i === activeIdx));
    if (activeIdx >= 0 && rows[activeIdx]) {
      rows[activeIdx].scrollIntoView({ block: 'nearest' });
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  function activateItem(item) {
    close();
    if (item.type === 'open') {
      chrome.runtime.sendMessage({ type: 'IBD_FOCUS_TAB', tabId: item.tabId, windowId: item.windowId });
    } else {
      chrome.runtime.sendMessage({ type: 'IBD_OPEN_URL', url: item.url });
    }
  }

  async function removeArchiveEntry(item, rowEl, idx) {
    const result = await new Promise((r) => chrome.storage.local.get('archive', r));
    const archive = result.archive ?? {};
    delete archive[item.id];
    await new Promise((r) => chrome.storage.local.set({ archive }, r));

    archivedItems = archivedItems.filter((i) => i.id !== item.id);
    allItems = allItems.filter((i) => !(i.type === 'archived' && i.id === item.id));
    filtered.splice(idx, 1);
    rowEl.remove();

    resultsList.querySelectorAll('.ibd-row').forEach((r, i) => { r.dataset.idx = String(i); });

    if (filtered.length === 0) activeIdx = -1;
    else if (activeIdx >= filtered.length) activeIdx = filtered.length - 1;
    highlightActive();
  }

  // ── Keyboard navigation ─────────────────────────────────────────────────────

  searchInput.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        close();
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
          const rows = resultsList.querySelectorAll('.ibd-row');
          if (rows[activeIdx]) removeArchiveEntry(item, rows[activeIdx], activeIdx);
        }
        break;
    }
  });

  searchInput.addEventListener('input', () => renderResults(searchInput.value));

  // ── Message listener ────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'TOGGLE_OVERLAY') toggle();
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────

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
})();
