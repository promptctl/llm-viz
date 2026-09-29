import { defineConfig } from '@playwright/test';

// Headless Chromium exposes a real Metal adapter only through the full `chromium` channel
// with these flags; the default headless shell offers SwiftShader, which would make every
// later frame-time measurement a lie. Measured 2026-09-29 on an Apple-silicon Mac.
export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'chromium',
    launchOptions: {
      args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=WebGPU'],
    },
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
