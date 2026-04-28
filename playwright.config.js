// scoreplace.app — Playwright config
// Run: npm run test:e2e (or playwright test)
// First time: npm run test:e2e:install (instala chromium + system deps)

const { defineConfig, devices } = require('@playwright/test');

const PROD_URL = 'https://scoreplace.app';
const LOCAL_URL = process.env.SCOREPLACE_URL || PROD_URL;

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.js',
  // Beta-readiness: erro se um describe ficar sem assertion (pega test bug)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  timeout: 30000,
  expect: {
    timeout: 10000
  },
  use: {
    baseURL: LOCAL_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // App é lento em mobile slow-4G; aumenta timeout dos clicks/waits
    actionTimeout: 15000,
    navigationTimeout: 30000
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] }
    }
  ]
});
