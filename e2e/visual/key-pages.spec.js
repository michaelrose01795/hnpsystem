// file location: e2e/visual/key-pages.spec.js
// Visual regression tests — screenshot comparison for key pages.
// First run creates baseline screenshots. Subsequent runs compare against them.
// Update baselines: npx playwright test --project=visual --update-snapshots

const { test, expect } = require('../helpers/fixtures.js');

test.describe('Visual — Key pages', () => {
  test('login page visual', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('login-page.png', {
      maxDiffPixelRatio: 0.05,
      fullPage: true,
    });
    await context.close();
  });

  test('dashboard visual', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('dashboard.png', {
      maxDiffPixelRatio: 0.05,
      fullPage: false,
    });
  });

  test('job cards list visual', async ({ page }) => {
    await page.goto('/job-cards/view');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('job-cards-list.png', {
      maxDiffPixelRatio: 0.05,
      fullPage: false,
    });
  });
});
