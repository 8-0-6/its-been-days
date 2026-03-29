// utils/pay.js — Legacy paywall helpers kept for compatibility.
// The current shipping build is free + optional tip jar.

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
