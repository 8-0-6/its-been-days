// chrome.storage.local wrapper — single source of truth for all key names and defaults

export const KEYS = {
  TABS_METADATA: 'tabs_metadata',
  ARCHIVE: 'archive',
  SETTINGS: 'settings',
  TRIAL: 'trial',
  SUBSCRIPTION_STATUS: 'subscription_status',
  AUTH_SESSION: 'auth_session',
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

// ── Trial ─────────────────────────────────────────────────────────────────

export async function getTrial() {
  const result = await storageGet(KEYS.TRIAL);
  return result[KEYS.TRIAL] ?? null;
}

export async function setTrial(data) {
  await storageSet({ [KEYS.TRIAL]: data });
}

// ── Subscription status (local cache, ExtensionPay-backed) ───────────────
// Shape: { isPaid: boolean, email: string|null, cached_at: number|null }

export async function getSubscriptionStatus() {
  const result = await storageGet(KEYS.SUBSCRIPTION_STATUS);
  return result[KEYS.SUBSCRIPTION_STATUS] ?? { isPaid: false, email: null, cached_at: null };
}

export async function setSubscriptionStatus(data) {
  await storageSet({ [KEYS.SUBSCRIPTION_STATUS]: data });
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

// ── Auth session ──────────────────────────────────────────────────────────────

export async function getAuthSession() {
  const result = await storageGet(KEYS.AUTH_SESSION);
  return result[KEYS.AUTH_SESSION] ?? null;
}

export async function setAuthSession(data) {
  await storageSet({ [KEYS.AUTH_SESSION]: data });
}
