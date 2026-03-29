import {
  getTabsMetadata,
  setTabsMetadata,
  getSettings,
  getOnboarding,
  setOnboarding,
} from './utils/storage.js';
import {
  archiveTab,
  bulkWrite,
  consumePopupClosingFlag,
  markPopupClosing,
  writeArchiveEntry,
} from './utils/archive.js';
const ALARM_DAILY = 'daily-check';
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const TIP_JAR_URL = 'https://buymeacoffee.com/your-handle';

// ── Access level ────────────────────────────────────────────────────────────

async function isAccessActive() {
  return true;
}

// ── Metadata lock ───────────────────────────────────────────────────────────

let _metadataLock = Promise.resolve();
function withMetadataLock(fn) {
  const next = _metadataLock.then(fn);
  _metadataLock = next.catch(() => {});
  return next;
}

// ── Install / startup ───────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  await syncOpenTabs();
  scheduleAlarms();
  await updateBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await syncOpenTabs();
  scheduleAlarms();
  await updateBadge();
});

async function syncOpenTabs() {
  const metadata = await getTabsMetadata();
  const openTabs = await chrome.tabs.query({});
  const now = Date.now();

  for (const tab of openTabs) {
    const existing = metadata[tab.id];
    metadata[tab.id] = {
      url: tab.url ?? '',
      title: tab.title ?? '',
      favicon_url: tab.favIconUrl ?? '',
      opened_at: existing?.opened_at ?? now,
      last_visited: tab.lastAccessed ?? existing?.last_visited ?? (tab.active ? now : null),
      days_inactive: existing?.days_inactive ?? 0,
      kept_until: existing?.kept_until ?? null,
    };
  }

  const openTabIds = new Set(openTabs.map((t) => String(t.id)));
  for (const id of Object.keys(metadata)) {
    if (!openTabIds.has(id)) delete metadata[id];
  }

  await setTabsMetadata(metadata);
}

function scheduleAlarms() {
  chrome.alarms.get(ALARM_DAILY, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(ALARM_DAILY, { delayInMinutes: 1, periodInMinutes: 1440 });
    }
  });
}

// ── Badge ────────────────────────────────────────────────────────────────────

async function updateBadge() {
  if (!(await isAccessActive())) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  const [metadata, settings, openTabs] = await Promise.all([
    getTabsMetadata(),
    getSettings(),
    chrome.tabs.query({}),
  ]);

  const now = Date.now();
  const count = openTabs.filter((tab) => {
    const meta = metadata[tab.id];
    if (!meta) return false;
    if (meta.kept_until && meta.kept_until > now) return false;
    const since = meta.last_visited ?? meta.opened_at ?? now;
    const days = Math.floor((now - since) / MS_PER_DAY);
    return days >= settings.notification_threshold && !tab.pinned && !tab.audible;
  }).length;

  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// ── Tab event listeners ─────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  if (!(await isAccessActive())) return;
  const metadata = await getTabsMetadata();
  if (metadata[tabId]) {
    metadata[tabId].last_visited = Date.now();
  } else {
    try {
      const tab = await chrome.tabs.get(tabId);
      metadata[tabId] = {
        url: tab.url ?? '',
        title: tab.title ?? '',
        favicon_url: tab.favIconUrl ?? '',
        opened_at: Date.now(),
        last_visited: Date.now(),
        days_inactive: 0,
        kept_until: null,
      };
    } catch {
      // Tab already gone
    }
  }
  await setTabsMetadata(metadata);
});

chrome.tabs.onCreated.addListener(async (tab) => {
  if (!(await isAccessActive())) return;
  const metadata = await getTabsMetadata();
  metadata[tab.id] = {
    url: tab.url ?? '',
    title: tab.title ?? '',
    favicon_url: tab.favIconUrl ?? '',
    opened_at: Date.now(),
    last_visited: null,
    days_inactive: 0,
    kept_until: null,
  };
  await setTabsMetadata(metadata);
  await updateBadge();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  withMetadataLock(async () => {
    const isPopupClose = await consumePopupClosingFlag(tabId);
    const metadata = await getTabsMetadata();
    const tabMeta = metadata[tabId];
    if (tabMeta) {
      if (!isPopupClose) {
        await archiveTab({ id: tabId, ...tabMeta }, tabMeta);
      }
      delete metadata[tabId];
      await setTabsMetadata(metadata);
      await updateBadge();
    }
  });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!changeInfo.url && !changeInfo.title && !changeInfo.favIconUrl) return;
  if (!(await isAccessActive())) return;
  const metadata = await getTabsMetadata();
  if (!metadata[tabId]) return;
  if (changeInfo.url) metadata[tabId].url = changeInfo.url;
  if (changeInfo.title) metadata[tabId].title = changeInfo.title;
  if (changeInfo.favIconUrl) metadata[tabId].favicon_url = changeInfo.favIconUrl;
  await setTabsMetadata(metadata);
});

// ── Daily alarm ─────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async ({ name }) => {
  if (name !== ALARM_DAILY) return;
  await recalculateInactivity();
  await checkNotificationThreshold();
  await updateBadge();
});

async function recalculateInactivity() {
  const metadata = await getTabsMetadata();
  const now = Date.now();
  for (const tab of Object.values(metadata)) {
    const since = tab.last_visited ?? tab.opened_at;
    tab.days_inactive = since ? Math.floor((now - since) / MS_PER_DAY) : 0;
    if (tab.kept_until && tab.kept_until <= now) {
      tab.kept_until = null;
    }
  }
  await setTabsMetadata(metadata);
}

async function checkNotificationThreshold() {
  const [metadata, settings] = await Promise.all([getTabsMetadata(), getSettings()]);
  if (!settings.notifications_enabled) return;
  if (!(await isAccessActive())) return;

  const now = Date.now();
  const overThreshold = Object.values(metadata).filter(
    (t) => t.days_inactive >= settings.notification_threshold &&
           !(t.kept_until && t.kept_until > now)
  );
  if (overThreshold.length === 0) return;

  const n = overThreshold.length;
  const days = settings.notification_threshold;
  await new Promise((r) => chrome.notifications.clear('daily-summary', r));
  await chrome.notifications.create('daily-summary', {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: "It's Been Days 👀",
    message: `You have ${n} tab${n === 1 ? '' : 's'} that ${n === 1 ? "hasn't" : "haven't"} been visited in over ${days} day${days === 1 ? '' : 's'}. Want to clean up?`,
    buttons: [{ title: 'Open extension' }],
  });
}

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId === 'daily-summary' && buttonIndex === 0) {
    chrome.action.openPopup?.();
  }
});

// ── Message handlers ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  if (msg.type === 'IBD_GET_TABS') {
    chrome.tabs.query({}).then((tabs) => sendResponse(tabs));
    return true;
  }

  if (msg.type === 'IBD_GET_ACCESS_LEVEL') {
    sendResponse('active');
    return true;
  }

  if (msg.type === 'IBD_FOCUS_TAB') {
    chrome.tabs.update(msg.tabId, { active: true });
    chrome.windows.update(msg.windowId, { focused: true });
    sendResponse({});
  }

  if (msg.type === 'IBD_OPEN_URL') {
    chrome.tabs.create({ url: msg.url });
    sendResponse({});
  }

  if (msg.type === 'IBD_CLOSE_TABS') {
    (async () => {
      const { tabIds } = msg;
      const metadata = await getTabsMetadata();
      const now = Date.now();

      const toArchive = tabIds.map((id) => {
        const meta = metadata[id] ?? {};
        return {
          tabId: id,
          url: meta.url ?? '',
          title: meta.title ?? '',
          favicon_url: meta.favicon_url ?? '',
          last_visited: meta.last_visited ?? meta.opened_at ?? now,
          days_inactive: meta.days_inactive ?? 0,
        };
      });

      await markPopupClosing(tabIds);

      const entryIds = await Promise.all(
        toArchive.map((e) =>
          writeArchiveEntry({
            url: e.url,
            title: e.title,
            favicon_url: e.favicon_url,
            last_visited: e.last_visited,
            days_inactive: e.days_inactive,
          })
        )
      );

      try { await chrome.tabs.remove(tabIds); } catch { /* already gone */ }

      sendResponse({
        entryIds,
        tabs: toArchive.map((e) => ({ url: e.url, title: e.title })),
      });
    })();
    return true;
  }

  if (msg.type === 'IBD_KEEP_TAB') {
    withMetadataLock(async () => {
      const metadata = await getTabsMetadata();
      if (metadata[msg.tabId]) {
        metadata[msg.tabId].kept_until = Date.now() + 30 * MS_PER_DAY;
        await setTabsMetadata(metadata);
        await updateBadge();
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'IBD_IMPORT_HISTORY') {
    (async () => {
      try {
        const histItems = await chrome.history.search({
          text: '',
          maxResults: 1000,
          startTime: 0,
        });
        const items = histItems.map((h) => ({
          url: h.url ?? '',
          title: h.title || h.url || '',
          favicon_url: '',
          archived_at: h.lastVisitTime ? Math.round(h.lastVisitTime) : Date.now(),
          last_visited: h.lastVisitTime ? Math.round(h.lastVisitTime) : Date.now(),
          days_inactive: 0,
        }));
        items.sort((a, b) => b.last_visited - a.last_visited);
        const count = await bulkWrite(items.slice(0, 500));
        await setOnboarding({ history_import_completed: true });
        sendResponse({ ok: true, count });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.type === 'IBD_GET_ONBOARDING') {
    getOnboarding().then((data) => sendResponse(data));
    return true;
  }

  if (msg.type === 'IBD_SET_ONBOARDING') {
    setOnboarding(msg.data).then(() => sendResponse({ ok: true }));
    return true;
  }

  // ── Support ──────────────────────────────────────────────────────────────

  if (msg.type === 'IBD_GET_PAYMENT_STATUS') {
    sendResponse({ isPaid: true, email: null, trialDaysLeft: 0, isFree: true });
    return true;
  }

  if (msg.type === 'IBD_OPEN_TIP_JAR') {
    chrome.tabs.create({ url: TIP_JAR_URL });
    sendResponse({ ok: true });
  }

  // Settings data
  if (msg.type === 'IBD_GET_SETTINGS_DATA') {
    sendResponse({ isPaid: true, email: null, trial: null, isFree: true });
    return;
  }
});

// ── Overlay trigger (toolbar click + keyboard shortcut) ─────────────────────

async function toggleOverlay() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? '';
  const isInjectable =
    url &&
    !url.startsWith('chrome://') &&
    !url.startsWith('chrome-extension://') &&
    !url.startsWith('about:') &&
    !url.endsWith('.pdf');

  if (isInjectable) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['overlay/overlay.js'],
      });
      await new Promise((r) => setTimeout(r, 50));
      await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
    }
  } else {
    const W = 560;
    const H = 560;
    // Center the popup over the current Chrome window
    const currentWin = await chrome.windows.getLastFocused({ populate: false });
    const left = currentWin
      ? Math.round(currentWin.left + (currentWin.width  - W) / 2)
      : Math.round((1440 - W) / 2); // sane fallback
    const top = currentWin
      ? Math.round(currentWin.top  + (currentWin.height - H) / 2)
      : Math.round((900  - H) / 2);
    chrome.windows.create({
      url: chrome.runtime.getURL('overlay/overlay-standalone.html'),
      type: 'popup',
      width: W,
      height: H,
      left: Math.max(0, left),
      top:  Math.max(0, top),
    });
  }
}

chrome.action.onClicked.addListener(() => toggleOverlay());

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-overlay') toggleOverlay();
});
