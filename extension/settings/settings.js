// settings.js — Standalone settings page (chrome-extension:// URL)
// Free + open-source build with optional tip jar link.

// ── Elements ─────────────────────────────────────────────────────────────────

const notifEnabled = /** @type {HTMLInputElement} */ (document.getElementById('notif-enabled'));
const thresholdSlider = /** @type {HTMLInputElement} */ (document.getElementById('threshold'));
const thresholdDisplay = document.getElementById('threshold-display');

const tipBtn = document.getElementById('tip-btn');

const archiveCount = document.getElementById('archive-count');
const clearArchiveBtn = document.getElementById('clear-archive-btn');
const clearConfirm = document.getElementById('clear-confirm');
const clearConfirmYes = document.getElementById('clear-confirm-yes');
const clearConfirmNo = document.getElementById('clear-confirm-no');

const remapLink = document.getElementById('remap-link');

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  await loadSettings();
  await loadArchiveCount();
}

init();

// ── Settings (notifications + threshold) ──────────────────────────────────────

async function loadSettings() {
  const result = await new Promise((r) => chrome.storage.local.get('settings', r));
  const settings = result.settings ?? {};

  notifEnabled.checked = settings.notifications_enabled !== false;
  thresholdSlider.value = String(settings.notification_threshold ?? 10);
  thresholdDisplay.textContent = thresholdSlider.value;
}

notifEnabled.addEventListener('change', () => {
  chrome.storage.local.get('settings', (r) => {
    const s = r.settings ?? {};
    chrome.storage.local.set({ settings: { ...s, notifications_enabled: notifEnabled.checked } });
  });
});

thresholdSlider.addEventListener('input', () => {
  thresholdDisplay.textContent = thresholdSlider.value;
});

thresholdSlider.addEventListener('change', () => {
  chrome.storage.local.get('settings', (r) => {
    const s = r.settings ?? {};
    chrome.storage.local.set({ settings: { ...s, notification_threshold: Number(thresholdSlider.value) } });
  });
});

// ── Archive ───────────────────────────────────────────────────────────────────

async function loadArchiveCount() {
  const result = await new Promise((r) => chrome.storage.local.get('archive', r));
  const count = Object.keys(result.archive ?? {}).length;
  archiveCount.textContent = `${count.toLocaleString()} archived tab${count === 1 ? '' : 's'}`;
}

clearArchiveBtn.addEventListener('click', () => {
  clearArchiveBtn.classList.add('hidden');
  clearConfirm.classList.remove('hidden');
});

clearConfirmNo.addEventListener('click', () => {
  clearConfirm.classList.add('hidden');
  clearArchiveBtn.classList.remove('hidden');
});

clearConfirmYes.addEventListener('click', async () => {
  await new Promise((r) => chrome.storage.local.set({ archive: {} }, r));
  archiveCount.textContent = '0 archived tabs';
  clearConfirm.classList.add('hidden');
  clearArchiveBtn.classList.remove('hidden');
});

tipBtn?.addEventListener('click', () => {
  tipBtn.disabled = true;
  tipBtn.textContent = 'Opening…';
  chrome.runtime.sendMessage({ type: 'IBD_OPEN_TIP_JAR' }, () => {
    void chrome.runtime.lastError;
    tipBtn.disabled = false;
    tipBtn.textContent = 'Buy Me a Coffee →';
  });
});

// ── Keyboard shortcut remap link ──────────────────────────────────────────────

remapLink?.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});
