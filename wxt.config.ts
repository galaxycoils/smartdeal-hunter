import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'SmartDeal Hunter',
    description:
      'Privacy-first Amazon shopping assistant. On-device True Value + Personal Fit scoring. No tracking.',
    version: '0.0.1',
    permissions: ['activeTab', 'scripting', 'storage', 'alarms', 'offscreen'],
    host_permissions: ['https://*.amazon.com/*'],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    minimum_chrome_version: '116',
  },
});
