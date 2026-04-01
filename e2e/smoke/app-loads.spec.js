// file location: e2e/smoke/app-loads.spec.js
// Smoke tests — verify key pages load without errors.

const { test, expect } = require('../helpers/fixtures.js');

test.describe('Smoke — App loads', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('dashboard loads', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('job cards list page loads', async ({ page }) => {
    await page.goto('/job-cards/view');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('parts page loads', async ({ page }) => {
    await page.goto('/parts/goods-in');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('messages page loads', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('clocking page loads', async ({ page }) => {
    await page.goto('/clocking');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('appointments page loads', async ({ page }) => {
    await page.goto('/appointments');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});
