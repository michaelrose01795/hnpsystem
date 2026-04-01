// file location: e2e/smoke/api-health.spec.js
// Smoke tests — verify key API endpoints respond (not 500).

const { test, expect } = require('../helpers/fixtures.js');

test.describe('Smoke — API health', () => {
  test('NextAuth session endpoint responds', async ({ request }) => {
    const res = await request.get('/api/auth/session');
    expect(res.status()).toBeLessThan(500);
  });

  test('NextAuth CSRF endpoint responds', async ({ request }) => {
    const res = await request.get('/api/auth/csrf');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('csrfToken');
  });
});
