// file location: e2e/smoke/navigation.spec.js
// Smoke tests — verify sidebar navigation renders and key links exist.

const { test, expect } = require('../helpers/fixtures.js');

test.describe('Smoke — Navigation', () => {
  test('sidebar renders with navigation links', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check that navigation structure is present
    const navElements = page.locator('nav, [role="navigation"], aside');
    const count = await navElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test('login page is accessible when logged out', async ({ browser }) => {
    // Fresh context without auth state
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });
});
