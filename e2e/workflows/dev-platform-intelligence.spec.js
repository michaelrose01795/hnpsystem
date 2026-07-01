// file location: e2e/workflows/dev-platform-intelligence.spec.js
// Phase 9 — Developer Platform intelligence: permission gating + the intelligence
// / bulk-triage APIs + the four dashboards.
//
// Runs under the `workflows` project (authenticated as a dev-access user via
// e2e/.auth/user.json). Permission tests use a fresh, UNauthenticated context to
// prove the strict `dev` gate. Data-shape tests are defensive: the bulk mutation
// only runs when at least one report exists (E2E may run against a stub DB), and
// the auto-reopen path is exercised only through the validated no-op guard.
//
// NOTE (shared with the Support Centre spec): the authenticated-developer tests
// require e2e/.auth/user.json to be a `dev`-role session (the devPlatform:"1"
// credential mint). Until that fixture is switched, only the permission-gate
// tests are guaranteed to pass — tracked in Manual actions.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { test, expect, waitForAppReady } = require('../helpers/fixtures.js');

test.describe('Developer Platform intelligence — permissions', () => {
  test('intelligence API rejects an unauthenticated request', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const res = await ctx.request.get('/api/support/intelligence');
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('bulk triage API rejects an unauthenticated request', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const res = await ctx.request.post('/api/support/reports/bulk', {
      data: { ids: ['00000000-0000-0000-0000-000000000000'], updates: { status: 'triaged' } },
    });
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('intelligence dashboards are not shown to a logged-out visitor', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    for (const path of ['/dev/intelligence', '/dev/releases', '/dev/ownership', '/dev/performance']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      // ProtectedRoute redirects away — no dashboard heading renders.
      await expect(page.getByText('Problem areas', { exact: false })).toHaveCount(0);
    }
    await ctx.close();
  });
});

test.describe('Developer Platform intelligence — authenticated developer', () => {
  test('intelligence API returns the aggregated shape', async ({ request }) => {
    const res = await request.get('/api/support/intelligence?view=all&window=200');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('intelligence');
    expect(body.intelligence).toHaveProperty('rollup');
    expect(Array.isArray(body.intelligence.problemAreas)).toBeTruthy();
    expect(body).toHaveProperty('releases');
    expect(body).toHaveProperty('ownership');
    expect(Array.isArray(body.directory)).toBeTruthy();
  });

  test('intelligence dashboard renders for a dev-access user', async ({ page }) => {
    await page.goto('/dev/intelligence');
    await waitForAppReady(page);
    await expect(page.getByText('Intelligence', { exact: false }).first()).toBeVisible();
  });

  test('releases dashboard renders for a dev-access user', async ({ page }) => {
    await page.goto('/dev/releases');
    await waitForAppReady(page);
    await expect(page.getByText('Releases', { exact: false }).first()).toBeVisible();
  });

  test('bulk triage validates an empty selection', async ({ request }) => {
    // No ids → 400 from the pure validator, regardless of DB state.
    const res = await request.post('/api/support/reports/bulk', {
      data: { ids: [], updates: { status: 'triaged' } },
    });
    expect(res.status()).toBe(400);
  });

  test('bulk triage rejects an invalid status enum', async ({ request }) => {
    const res = await request.post('/api/support/reports/bulk', {
      data: { ids: ['00000000-0000-0000-0000-000000000000'], updates: { status: 'not-a-status' } },
    });
    expect(res.status()).toBe(400);
  });

  test('bulk triage applies a status to a real report (if any exist)', async ({ request }) => {
    const list = await request.get('/api/support/reports?limit=1');
    const body = await list.json();
    test.skip(!body?.data?.length, 'No reports available in this environment');
    const id = body.data[0].id;
    const res = await request.post('/api/support/reports/bulk', {
      data: { ids: [id], updates: { status: 'triaged' } },
    });
    expect(res.ok()).toBeTruthy();
    const result = await res.json();
    expect(result).toHaveProperty('success', true);
    expect(result.updated).toBeGreaterThanOrEqual(1);
  });
});
