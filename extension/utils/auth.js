// utils/auth.js — Compatibility shim
//
// Supabase auth has been replaced with ExtensionPay (one-time $10).
// This file is kept to avoid breaking any stale imports.
// New code should import from utils/pay.js directly.

export { computeAccessLevel } from './pay.js';
