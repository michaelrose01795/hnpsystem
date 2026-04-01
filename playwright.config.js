// @ts-check
// file location: playwright.config.js
// Playwright configuration for HNP System E2E tests.

const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

// Load env vars
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '.env.local'), override: true });

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

/** @see https://playwright.dev/docs/test-configuration */
module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Auth setup — runs once, saves auth state for other projects
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.js/,
    },

    // Smoke tests — fast, page-loads-correctly checks
    {
      name: 'smoke',
      testDir: './e2e/smoke',
      dependencies: ['auth-setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
    },

    // Linked workflow tests — cross-page data flow verification
    {
      name: 'workflows',
      testDir: './e2e/workflows',
      dependencies: ['auth-setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
    },

    // Visual/screenshot comparison tests
    {
      name: 'visual',
      testDir: './e2e/visual',
      dependencies: ['auth-setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
    },
  ],

  // Start dev server automatically for test runs
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
