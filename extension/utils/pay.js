// utils/pay.js — Payment status cache wrapper
//
// background.js is the SOLE caller of extpay directly.
// Everything else (overlay, settings) sends IBD_GET_PAYMENT_STATUS to background.
//
// Cache TTL: 24 hours. On cache miss / network failure → optimistic allow.

import { getSubscriptionStatus, setSubscriptionStatus } from './storage.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Cache read ─────────────────────────────────────────────────────────────

export async function getCachedPaymentStatus() {
  const cached = await getSubscriptionStatus();
  // Optimistic allow if no cache exists yet (new install, pre-purchase)
  if (!cached?.cached_at) return { isPaid: false, email: null, fresh: false };
  const isStale = Date.now() - cached.cached_at > CACHE_TTL_MS;
  return {
    isPaid: cached.isPaid ?? false,
    email: cached.email ?? null,
    fresh: !isStale,
  };
}

// ── Cache write ────────────────────────────────────────────────────────────

export async function cachePaymentStatus(isPaid, email = null) {
  await setSubscriptionStatus({ isPaid, email, cached_at: Date.now() });
}

// ── Access level ───────────────────────────────────────────────────────────
// Pure helper — pass values already read from storage to avoid extra async calls.
// Returns: 'active' | 'expired'

export function computeAccessLevel(trial, isPaid) {
  if (isPaid) return 'active';
  if (trial && Date.now() < trial.trial_ends_at) return 'active';
  return 'expired';
}
