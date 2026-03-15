import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    trace: 'off',
    baseURL: 'http://127.0.0.1:9443',
  },
  outputDir: './docs/screenshots',
  reporter: [['list']],
});
