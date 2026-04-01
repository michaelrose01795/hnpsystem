// file location: e2e/helpers/fixtures.js
// Shared Playwright fixtures for HNP System tests.

const { test: base, expect } = require('@playwright/test');
const dbHelpers = require('./db.js');

/**
 * Extended test fixture with DB access and common actions.
 *
 * Usage in tests:
 *   const { test, expect } = require('../helpers/fixtures.js');
 *   test('my test', async ({ page, db }) => { ... });
 */
const test = base.extend({
  /** Supabase service client + query helpers */
  db: async ({}, use) => {
    await use(dbHelpers);
  },

  /** Navigate to a job card by job number */
  openJobCard: async ({ page }, use) => {
    const open = async (jobNumber) => {
      await page.goto(`/job-cards/${jobNumber}`);
      await page.waitForLoadState('networkidle');
    };
    await use(open);
  },

  /** Navigate to job cards list */
  openJobList: async ({ page }, use) => {
    const open = async () => {
      await page.goto('/job-cards/view');
      await page.waitForLoadState('networkidle');
    };
    await use(open);
  },
});

module.exports = { test, expect };
