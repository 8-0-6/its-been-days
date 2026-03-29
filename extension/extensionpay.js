// extensionpay.js — PLACEHOLDER (no-op stub)
//
// Replace this file with the real extensionpay.js before publishing:
//   1. Create an account at https://extensionpay.com
//   2. Register your extension and set the price to $10 (one-time)
//   3. Download extensionpay.js from your dashboard
//   4. Paste it here, replacing this entire file
//   5. Set your Extension ID in background.js:  ExtPay('your-id-here')
//
// While this stub is in place the extension works fully — it just treats
// everyone as "not yet paid" (trial period applies as normal).

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
