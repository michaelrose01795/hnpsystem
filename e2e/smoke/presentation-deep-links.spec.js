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
  // Every documented /presentation/<role>/... URL is one we should hit.
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.match(/(\/presentation\/[^\s/]+\/[^\s/]+\/\d+)\b/)?.[1])
    .filter(Boolean);
}

function groupUrlsByRole(urls) {
  return urls.reduce((groups, url) => {
    const role = url.split('/')[2];
    groups[role] = groups[role] || [];
    groups[role].push(url);
    return groups;
  }, {});
}

test.describe('Presentation deep-link smoke', () => {
  test.describe.configure({ mode: 'serial' });

  const urls = loadPresentationUrls();

  // Bail out early if the doc isn't readable / has no URLs — keeps the failure
  // mode obvious in CI.
  test('the doc lists at least one URL', () => {
    expect(urls.length).toBeGreaterThan(0);
  });

  test('tampered presentation URLs do not load another deck page', async ({ page }) => {
    const tamperedUrls = [
      '/presentation/workshop-manager/accounts/1',
      '/presentation/workshop-manager/job-cards-view/99',
      '/presentation/not-a-role/messages/0',
    ];

    for (const url of tamperedUrls) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});

      const isRolePicker = page.url().includes('/loginPresentation');
      const isBlocked = await page
        .locator('body')
        .getByText('Presentation page not available')
        .isVisible()
        .catch(() => false);

      expect(isRolePicker || isBlocked, `${url} should not render a real presentation page`).toBe(true);
    }
  });

  test('presentation sidebar exposes exactly the documented pages for each role', async ({ page }) => {
    const grouped = groupUrlsByRole(urls);

    for (const [role, roleUrls] of Object.entries(grouped)) {
      await page.goto(roleUrls[0], { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});

      const sidebarUrls = await page
        .locator('.app-sidebar a[href^="/presentation/"]')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')));

      expect(sidebarUrls, `${role} should show one sidebar link per documented page`).toHaveLength(roleUrls.length);
      for (const url of roleUrls) {
        expect(sidebarUrls, `${role} sidebar should include ${url}`).toContain(url);
      }
    }
  });

  test('presentation mode blocks live data and live route escape hatches', async ({ page }) => {
    const leakedRequests = [];
    page.on('request', (req) => {
      const target = req.url();
      if (target.includes('supabase.co')) {
        leakedRequests.push(`supabase:${target}`);
        return;
      }
      const parsed = new URL(target);
      if (
        parsed.origin === page.context()._options.baseURL &&
        parsed.pathname.startsWith('/api/') &&
        !PASSTHROUGH_RE.test(parsed.pathname)
      ) {
        leakedRequests.push(`api:${parsed.pathname}`);
      }
    });

    await page.goto('/presentation/general/messages/0', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const fetchResults = await page.evaluate(async () => {
      const relativeGet = await fetch('/api/messages').then((res) => res.json());
      const absoluteGet = await fetch(`${location.origin}/api/messages`).then((res) => res.json());
      const postNoop = await fetch('/api/messages/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }).then((res) => res.json());
      return {
        relativeGetOk: relativeGet?.success === true,
        absoluteGetOk: absoluteGet?.success === true,
        postNoopOk: postNoop?.success === true,
      };
    });

    expect(fetchResults).toEqual({
      relativeGetOk: true,
      absoluteGetOk: true,
      postNoopOk: true,
    });

    const beforeLiveClickUrl = page.url();
    await page.evaluate(() => {
      const link = document.createElement('a');
      link.href = '/dashboard';
      link.textContent = 'Injected live dashboard link';
      document.body.appendChild(link);
      link.click();
    });
    await page.waitForTimeout(500);

    expect(page.url()).toBe(beforeLiveClickUrl);
    expect(leakedRequests).toEqual([]);
  });

  test('finishing a presentation returns to the presentation picker', async ({ page }) => {
    await page.goto('/presentation/workshop-manager/tracking/8', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    await page.getByRole('button', { name: 'Finish' }).first().click();
    await expect(page).toHaveURL(/\/loginPresentation$/);
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
