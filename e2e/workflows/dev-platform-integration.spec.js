// file location: e2e/workflows/dev-platform-integration.spec.js
// Phase 10 — Developer Platform integration/extensibility/hardening: permission
// gating + the new APIs (platform aggregation, activity/audit, knowledge,
// notifications + rules, release approvals, two-way GitHub) + the new dashboards
// (readiness, productivity, knowledge, notifications, activity, plugins).
//
// Runs under the `workflows` project (authenticated via e2e/.auth/user.json).
// Permission tests use a fresh, UNauthenticated context to prove the strict
// `dev` gate. Data-shape tests are defensive: mutations that need a real report
// self-skip when the DB has none (E2E may run against a stub DB).
//
// NOTE (shared with the Phase 8/9 specs): the authenticated-developer tests
// require e2e/.auth/user.json to be a `dev`-role session (the devPlatform:"1"
// credential mint). Until that fixture is switched, only the permission-gate
// tests are guaranteed to pass — tracked in Manual actions.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { test, expect, waitForAppReady } = require('../helpers/fixtures.js');

const ZERO_ID = '00000000-0000-0000-0000-000000000000';

test.describe('Developer Platform integration — permissions', () => {
  const GET_ROUTES = [
    '/api/support/platform?view=all',
    '/api/support/activity',
    '/api/support/knowledge',
    '/api/support/notifications',
    '/api/support/notifications/rules',
    '/api/support/releases/approvals',
  ];

  for (const route of GET_ROUTES) {
    test(`GET ${route} rejects an unauthenticated request`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: undefined });
      const res = await ctx.request.get(route);
      expect([401, 403]).toContain(res.status());
      await ctx.close();
    });
  }

  test('the two-way GitHub route rejects an unauthenticated request', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const res = await ctx.request.post(`/api/support/reports/${ZERO_ID}/github`, { data: { action: 'link', url: 'x' } });
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('the new dashboards are not shown to a logged-out visitor', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    for (const path of ['/dev/readiness', '/dev/productivity', '/dev/knowledge', '/dev/notifications', '/dev/activity', '/dev/plugins']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      // ProtectedRoute redirects away — the platform nav ("Developer Platform") never renders.
      await expect(page.getByText('Deployment Readiness', { exact: false })).toHaveCount(0);
    }
    await ctx.close();
  });
});

test.describe('Developer Platform integration — authenticated developer', () => {
  test('platform aggregation returns readiness + productivity + knowledge', async ({ request }) => {
    const res = await request.get('/api/support/platform?view=all&window=200');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('success', true);
    expect(Array.isArray(body.readiness)).toBeTruthy();
    expect(body).toHaveProperty('productivity');
    expect(body.productivity).toHaveProperty('totals');
    expect(Array.isArray(body.productivity.throughput)).toBeTruthy();
    expect(body).toHaveProperty('knowledge');
    expect(Array.isArray(body.knowledge.suggestions)).toBeTruthy();
  });

  test('activity feed returns shaped rows + coverage', async ({ request }) => {
    const res = await request.get('/api/support/activity?limit=50');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('success', true);
    expect(Array.isArray(body.activity)).toBeTruthy();
    expect(body).toHaveProperty('coverage');
    expect(Array.isArray(body.coverage.covered)).toBeTruthy();
    expect(Array.isArray(body.coverage.missing)).toBeTruthy();
  });

  test('knowledge list returns an array and create validates a missing title', async ({ request }) => {
    const list = await request.get('/api/support/knowledge');
    expect(list.ok()).toBeTruthy();
    expect(Array.isArray((await list.json()).data)).toBeTruthy();
    const bad = await request.post('/api/support/knowledge', { data: {} });
    expect(bad.status()).toBe(400); // title required
  });

  test('notifications + rules list, and a rule requires an event', async ({ request }) => {
    const notifs = await request.get('/api/support/notifications');
    expect(notifs.ok()).toBeTruthy();
    const nb = await notifs.json();
    expect(Array.isArray(nb.data)).toBeTruthy();
    expect(typeof nb.unread).toBe('number');

    const rules = await request.get('/api/support/notifications/rules');
    expect(rules.ok()).toBeTruthy();
    expect(Array.isArray((await rules.json()).data)).toBeTruthy();

    const bad = await request.post('/api/support/notifications/rules', { data: {} });
    expect(bad.status()).toBe(400); // event required
  });

  test('release approvals list, and an approval requires a release key', async ({ request }) => {
    const list = await request.get('/api/support/releases/approvals');
    expect(list.ok()).toBeTruthy();
    expect(Array.isArray((await list.json()).data)).toBeTruthy();
    const bad = await request.post('/api/support/releases/approvals', { data: { status: 'approved' } });
    expect(bad.status()).toBe(400); // releaseKey required
  });

  test('the GitHub route lists links + validates a bad link URL', async ({ request }) => {
    const list = await request.get('/api/support/reports?limit=1');
    const body = await list.json();
    test.skip(!body?.data?.length, 'No reports available in this environment');
    const id = body.data[0].id;
    const links = await request.get(`/api/support/reports/${id}/github`);
    expect(links.ok()).toBeTruthy();
    const lb = await links.json();
    expect(Array.isArray(lb.data)).toBeTruthy();
    expect(lb).toHaveProperty('configured');
    // A non-github URL is rejected by the pure parser before any DB/network work.
    const bad = await request.post(`/api/support/reports/${id}/github`, { data: { action: 'link', url: 'https://example.com/not-github' } });
    expect(bad.status()).toBe(400);
  });

  test('deployment readiness dashboard renders', async ({ page }) => {
    await page.goto('/dev/readiness');
    await waitForAppReady(page);
    await expect(page.getByText('Deployment Readiness', { exact: false }).first()).toBeVisible();
  });

  test('plugins dashboard renders the extension registry', async ({ page }) => {
    await page.goto('/dev/plugins');
    await waitForAppReady(page);
    await expect(page.getByText('Plugins', { exact: false }).first()).toBeVisible();
  });
});
