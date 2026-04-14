import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.YAMLS_NGINX_PORT || 8443);
const baseURL = process.env.YAMLS_TEST_BASE_URL || `https://localhost:${port}`;

export default defineConfig({
  testDir: './specs',
  timeout: 45_000,
  expect: {
    timeout: 8_000
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    actionTimeout: 12_000,
    navigationTimeout: 20_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow'
  },
  projects: [
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    }
  ]
});
