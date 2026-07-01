// file location: e2e/workflows/support-centre.spec.js
// Phase 6 — developer Support Centre: permission gating + triage workflow.
//
// Runs under the `workflows` project, which is authenticated as a dev-access
// user (e2e/.auth/user.json). Permission tests use a fresh, UNauthenticated
// context to prove the gate. The triage workflow is defensive: it only runs the
// mutation when at least one report exists (E2E may run against a stub DB).

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { test, expect, waitForAppReady } = require('../helpers/fixtures.js');

test.describe('Support Centre — permissions', () => {
  test('list API rejects an unauthenticated request', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const res = await ctx.request.get('/api/support/reports');
    // Unauthenticated → 401 (never 200 with data).
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('detail + comments APIs are developer-gated', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const detail = await ctx.request.get('/api/support/reports/00000000-0000-0000-0000-000000000000');
    expect([401, 403]).toContain(detail.status());
    const comments = await ctx.request.get('/api/support/reports/00000000-0000-0000-0000-000000000000/comments');
    expect([401, 403]).toContain(comments.status());
    await ctx.close();
  });

  test('workspace is not shown to a logged-out visitor', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto('/dev/support-reports');
    await page.waitForLoadState('networkidle');
    // ProtectedRoute redirects away (login/unauthorized) — the heading must not render.
    await expect(page.getByText('Support Centre', { exact: false })).toHaveCount(0);
    await ctx.close();
  });
});

test.describe('Support Centre — authenticated developer', () => {
  test('workspace loads for a dev-access user', async ({ page }) => {
    await page.goto('/dev/support-reports');
    await waitForAppReady(page);
    await expect(page.getByText('Support Centre', { exact: false }).first()).toBeVisible();
    // Dashboard + queue panels render.
    await expect(page.getByText('Dashboard', { exact: false }).first()).toBeVisible();
  });

  test('list API returns the success shape', async ({ request }) => {
    const res = await request.get('/api/support/reports?withStats=1&limit=5');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('success', true);
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('triage workflow: view a report and change its status (if any exist)', async ({ request }) => {
    const list = await request.get('/api/support/reports?limit=1');
    const body = await list.json();
    test.skip(!body?.data?.length, 'No reports available in this environment');

    const id = body.data[0].id;

    // Viewing the private bundle succeeds and returns diagnostics + thread.
    const detail = await request.get(`/api/support/reports/${id}`);
    expect(detail.ok()).toBeTruthy();
    const detailBody = await detail.json();
    expect(detailBody).toHaveProperty('success', true);
    expect(detailBody).toHaveProperty('comments');

    // Triage: move it to "triaged".
    const patch = await request.patch(`/api/support/reports/${id}`, {
      data: { status: 'triaged' },
    });
    expect(patch.ok()).toBeTruthy();
    const patched = await patch.json();
    expect(patched.data.status).toBe('triaged');

    // Add a developer note.
    const comment = await request.post(`/api/support/reports/${id}/comments`, {
      data: { body: 'E2E triage note' },
    });
    expect(comment.ok()).toBeTruthy();
  });

  test('an invalid triage value is rejected', async ({ request }) => {
    const list = await request.get('/api/support/reports?limit=1');
    const body = await list.json();
    test.skip(!body?.data?.length, 'No reports available in this environment');
    const id = body.data[0].id;
    const res = await request.patch(`/api/support/reports/${id}`, { data: { status: 'not-a-status' } });
    expect(res.status()).toBe(400);
  });
});

// Phase 7 (hardening) — health endpoint + end-to-end privacy regression.
test.describe('Support hardening — health check', () => {
  test('health endpoint is developer-gated', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const res = await ctx.request.get('/api/support/health');
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('health endpoint returns a status roll-up for a dev', async ({ request }) => {
    const res = await request.get('/api/support/health');
    // 200 when ok/warn, 503 when a subsystem fails — both return the shape.
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('checks');
    // The privacy canary must never be failing in a healthy deploy.
    expect(body.checks.sanitiser.status).toBe('ok');
  });
});

test.describe('Support hardening — privacy regression (end to end)', () => {
  test('a planted secret submitted in a report is scrubbed before storage', async ({ request }) => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJlMmUifQ.plantedsig_e2e_abcdef';
    const submit = await request.post('/api/support/reports', {
      data: {
        description: `E2E privacy probe with token ${jwt}`,
        category: 'bug',
        diagnostics: {
          captured_at: new Date().toISOString(),
          console_errors: [`Authorization: Bearer ${jwt}`],
          session: { roles: ['dev'], token: jwt },
        },
      },
    });
    // Stub DBs may reject the insert — skip rather than fail in that environment.
    test.skip(!submit.ok(), 'Submit unavailable in this environment');
    const created = await submit.json();
    const id = created?.data?.id;
    test.skip(!id, 'No report id returned');

    const detail = await request.get(`/api/support/reports/${id}`);
    expect(detail.ok()).toBeTruthy();
    const raw = await detail.text();
    // The planted JWT must appear nowhere in the persisted, admin-visible payload.
    expect(raw).not.toContain(jwt);
  });
});
