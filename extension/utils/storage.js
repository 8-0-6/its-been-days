// chrome.storage.local wrapper — single source of truth for all key names and defaults

export const KEYS = {
  TABS_METADATA: 'tabs_metadata',
  ARCHIVE: 'archive',
  SETTINGS: 'settings',
  ONBOARDING: 'onboarding',
};

const DEFAULT_SETTINGS = {
  notifications_enabled: true,
  notification_threshold: 10, // days
};

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(items) {
  return new Promise((resolve) => chrome.storage.local.set(items, resolve));
}

// ── Tab metadata ──────────────────────────────────────────────────────────

export async function getTabsMetadata() {
  const result = await storageGet(KEYS.TABS_METADATA);
  return result[KEYS.TABS_METADATA] ?? {};
}

export async function setTabsMetadata(data) {
  await storageSet({ [KEYS.TABS_METADATA]: data });
}

// ── Settings ──────────────────────────────────────────────────────────────

export async function getSettings() {
  const result = await storageGet(KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(result[KEYS.SETTINGS] ?? {}) };
}

export async function setSettings(patch) {
  const current = await getSettings();
  await storageSet({ [KEYS.SETTINGS]: { ...current, ...patch } });
}

// ── Onboarding ────────────────────────────────────────────────────────────────

const DEFAULT_ONBOARDING = {
  history_import_offered: false,
  history_import_completed: false,
};

export async function getOnboarding() {
  const result = await storageGet(KEYS.ONBOARDING);
  return { ...DEFAULT_ONBOARDING, ...(result[KEYS.ONBOARDING] ?? {}) };
}

export async function setOnboarding(data) {
  const current = await getOnboarding();
  await storageSet({ [KEYS.ONBOARDING]: { ...current, ...data } });
}
