// file location: e2e/smoke/navigation.spec.js
// Smoke tests — verify sidebar navigation renders and key links exist.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { test, expect, waitForAppReady } = require('../helpers/fixtures.js');

test.describe('Smoke — Navigation', () => {
  const selectFirstDropdownOption = async (page, label) => {
    await page.getByRole('button', { name: label }).click();
    const options = page.locator('[role="option"]');
    await expect(options.first()).toBeVisible();
    await options.first().click();
  };

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

  test('dev login redirects selected user to newsfeed', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await selectFirstDropdownOption(page, 'Select Area');
    await selectFirstDropdownOption(page, 'Select Department');
    await selectFirstDropdownOption(page, 'Select User');

    await page.getByRole('button', { name: 'Dev Login' }).click();

    await page.waitForURL('**/newsfeed', { timeout: 15000 });
    await expect(page).toHaveURL(/\/newsfeed$/);

    await context.close();
  });
});
