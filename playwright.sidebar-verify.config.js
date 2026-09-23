const { defineConfig, devices } = require('@playwright/test');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.local'), override: true });
module.exports = defineConfig({
  testDir: './e2e/sidebar-verify',
  timeout: 150_000,
  expect: { timeout: 60_000 },
  reporter: [['list']],
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3100', ...devices['Desktop Chrome'] },
});
