// utils/auth.js — Compatibility shim
//
// Legacy auth/paywall code has been removed in the free + tip-jar build.
// This shim is kept to avoid breaking stale imports.
// New code should import from utils/pay.js directly when needed.

export { computeAccessLevel } from './pay.js';
