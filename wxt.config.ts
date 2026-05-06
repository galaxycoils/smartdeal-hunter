import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'SmartDeal Hunter',
    short_name: 'SmartDeal',
    description:
      'Privacy-first Amazon shopping assistant. On-device True Value + Personal Fit scoring. No tracking.',
    version: '0.0.1',
    author: { email: 'tahamtandariush@gmail.com' },
    homepage_url: 'https://github.com/tahamtandariush/smartdeal-hunter',
    permissions: ['activeTab', 'scripting', 'storage', 'alarms', 'offscreen'],
    host_permissions: [
      'https://*.amazon.com/*',
      'https://*.amazon.co.uk/*',
      'https://*.amazon.de/*',
      'https://*.amazon.co.jp/*',
      'https://*.amazon.ca/*',
      'https://*.amazon.fr/*',
      'https://*.amazon.it/*',
      'https://*.amazon.es/*',
    ],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    minimum_chrome_version: '116',
  },
  // Basic global error listener (no external tracking, robust local logging)
  hooks: {
    'build:manifestGenerated': (wxt, manifest) => {
      console.log('Manifest generated with version:', manifest.version);
    },
  },
});
