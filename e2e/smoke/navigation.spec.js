// file location: e2e/smoke/navigation.spec.js
// Smoke tests — verify sidebar navigation renders and key links exist.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { test, expect } = require('../helpers/fixtures.js');

test.describe('Smoke — Navigation', () => {
  test.describe.configure({ timeout: 90_000 });

  const selectFirstDropdownOption = async (page, label) => {
    await page.getByRole('button', { name: label }).click();
    const options = page.locator('[role="option"]');
    await expect(options.first()).toBeVisible();
    await options.first().click();
  };

  test('sidebar renders with navigation links', async ({ page }) => {
    const realtimeSubscriptionErrors = [];
    page.on('pageerror', (error) => {
      if (String(error?.message || error).includes('cannot add `postgres_changes` callbacks')) {
        realtimeSubscriptionErrors.push(String(error.message || error));
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check that navigation structure is present
    const navElements = page.locator('nav, [role="navigation"], aside');
    await expect(navElements.first()).toBeVisible({ timeout: 30_000 });
    expect(realtimeSubscriptionErrors).toEqual([]);
  });

  test('login page is accessible when logged out', async ({ browser }) => {
    test.skip(
      process.env.PLAYWRIGHT_TEST_AUTH === '1',
      'The CI auth bypass intentionally redirects logged-out requests to its synthetic user.'
    );

    // Fresh context without auth state
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test('dev login redirects selected user to newsfeed', async ({ browser }) => {
    test.skip(
      process.env.PLAYWRIGHT_TEST_AUTH === '1',
      'The CI auth bypass intentionally auto-authenticates fresh browser contexts.'
    );

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
