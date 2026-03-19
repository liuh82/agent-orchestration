import { defineConfig } from '@playwright/test';

export default defineConfig({
  baseURL: 'http://127.0.0.1:9443',
  timeout: 30000,
  screenshotDir: 'docs/screenshots',
  screenshot: { mode: 'only-on-failure' },
  video: 'retain-on-failure',
  fullyParallel: false,
  retries: 0,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {},
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
