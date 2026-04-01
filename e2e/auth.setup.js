// file location: e2e/auth.setup.js
// Auth setup — logs in via dev credentials provider and saves session state.
// Runs once before smoke/workflow/visual projects.

const { test: setup, expect } = require('@playwright/test');
const path = require('path');

const authFile = path.join(__dirname, '.auth', 'user.json');

setup('authenticate as dev user', async ({ page }) => {
  // Use the credentials provider dev login (userId-based, non-production only)
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Use NextAuth signIn API directly for reliable auth
  await page.evaluate(async () => {
    const res = await fetch('/api/auth/csrf');
    const { csrfToken } = await res.json();

    await fetch('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        csrfToken,
        userId: '1',
        callbackUrl: '/',
      }),
      redirect: 'follow',
    });
  });

  // Navigate to verify we are logged in
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Verify we are not on the login page
  const url = page.url();
  expect(url).not.toContain('/login');

  // Save auth state for reuse across test projects
  await page.context().storageState({ path: authFile });
});
