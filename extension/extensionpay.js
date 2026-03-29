// extensionpay.js — PLACEHOLDER (no-op stub)
//
// This repository currently ships as free + optional tip jar.
// Keep this stub only as historical compatibility for old imports.

export default function ExtPay(_extensionId) {
  return {
    startBackground() {},
    getUser() {
      return Promise.resolve({ paid: false, email: undefined, installedAt: new Date() });
    },
    openPaymentPage() {
      chrome.tabs.create({ url: 'https://extensionpay.com' });
    },
    onPaid: { addListener(_fn) {} },
  };
}
