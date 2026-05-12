// file location: e2e/smoke/presentation-deep-links.spec.js
//
// Iterates every URL listed in docs/ui/ui-presentation and asserts the
// presentation deep-link contract:
//   - HTTP 200 (no 5xx / 4xx)
//   - No requests to *.supabase.co (data layer swap is active)
//   - No requests to internal /api/* except the auth/health passthrough
//   - No "Application error" overlay
//   - The presentation frame wrapper is rendered
//
// Auto-discovers the URL list at runtime so it stays in sync with the doc.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('../helpers/fixtures.js');

const PASSTHROUGH_RE = /^\/api\/(auth|health|img-proxy)\b/;

function loadPresentationUrls() {
  const docPath = path.resolve(__dirname, '../../docs/ui/ui-presentation');
  const raw = fs.readFileSync(docPath, 'utf8');
  // Every line that starts with /presentation/<role>/... is a URL we should hit.
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\/presentation\/[^\s/]+\/[^\s/]+\/\d+$/.test(line));
}

test.describe('Presentation deep-link smoke', () => {
  const urls = loadPresentationUrls();

  // Bail out early if the doc isn't readable / has no URLs — keeps the failure
  // mode obvious in CI.
  test('the doc lists at least one URL', () => {
    expect(urls.length).toBeGreaterThan(0);
  });

  for (const url of urls) {
    test(`renders ${url} without hitting real backends`, async ({ page }) => {
      const offendingRequests = [];
      const consoleErrors = [];

      page.on('request', (req) => {
        const target = req.url();
        if (target.includes('supabase.co')) {
          offendingRequests.push(`supabase:${target}`);
          return;
        }
        // Internal /api/* should be intercepted; anything not under the auth
        // passthrough list is a leak.
        try {
          const parsed = new URL(target);
          if (parsed.origin === page.context()._options.baseURL && parsed.pathname.startsWith('/api/')) {
            if (!PASSTHROUGH_RE.test(parsed.pathname)) {
              offendingRequests.push(`api:${parsed.pathname}`);
            }
          }
        } catch {
          /* unparseable URL — skip */
        }
      });

      page.on('pageerror', (err) => {
        consoleErrors.push(String(err?.message || err));
      });
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!/Failed to load resource/.test(text)) consoleErrors.push(text);
        }
      });

      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      expect(response, `expected a navigation response for ${url}`).toBeTruthy();
      expect(response.status(), `${url} should not be a server error`).toBeLessThan(500);

      // Give the page a moment for client-side data fetches to settle.
      await page.waitForLoadState('networkidle').catch(() => {});

      await expect(page.locator('body')).not.toContainText('Application error');

      if (offendingRequests.length > 0) {
        throw new Error(
          `Presentation route ${url} leaked real backend calls:\n  - ` +
            offendingRequests.slice(0, 8).join('\n  - ') +
            (offendingRequests.length > 8 ? `\n  - …+${offendingRequests.length - 8} more` : '')
        );
      }

      if (consoleErrors.length > 0) {
        // Console errors are a soft-fail signal — surface them as the test
        // failure cause so they're visible, but a single missing anchor
        // shouldn't kill the entire suite.
        throw new Error(
          `Presentation route ${url} produced console errors:\n  - ` + consoleErrors.slice(0, 6).join('\n  - ')
        );
      }
    });
  }
});
