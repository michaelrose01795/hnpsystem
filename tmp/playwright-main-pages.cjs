const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
  const outDir = path.join(process.cwd(), 'tmp', 'playwright-smoke-main');
  fs.mkdirSync(outDir, { recursive: true });

  const routes = [
    '/',
    '/login',
    '/dashboard',
    '/appointments',
    '/clocking',
    '/customers',
    '/job-cards',
    '/messages',
    '/parts',
    '/profile',
    '/tracking',
    '/vhc',
    '/workshop',
    '/newsfeed',
    '/stock-catalogue',
    '/unauthorized'
  ];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const issues = [];
  const pagePath = () => {
    try { return new URL(page.url()).pathname; } catch { return page.url(); }
  };

  page.on('pageerror', (err) => issues.push({ type: 'pageerror', at: pagePath(), message: String(err.message || err) }));
  page.on('console', (msg) => { if (msg.type() === 'error') issues.push({ type: 'console.error', at: pagePath(), message: msg.text() }); });
  page.on('requestfailed', (req) => issues.push({ type: 'requestfailed', at: pagePath(), message: `${req.method()} ${req.url()} -> ${req.failure()?.errorText || 'failed'}` }));
  page.on('response', (res) => { if (res.status() >= 500) issues.push({ type: 'http5xx', at: pagePath(), message: `${res.status()} ${res.url()}` }); });

  const results = [];
  let idx = 0;

  for (const route of routes) {
    idx += 1;
    const label = `${String(idx).padStart(2, '0')}-${route.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'root'}`;
    const url = new URL(route, base).toString();
    let status = null;
    let finalPath = null;
    let title = '';
    let h1 = '';
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      status = resp ? resp.status() : null;
      await page.waitForTimeout(1200);
      finalPath = new URL(page.url()).pathname;
      title = await page.title();
      h1 = await page.locator('h1').first().textContent({ timeout: 1000 }).catch(() => '');
      await page.screenshot({ path: path.join(outDir, `${label}.png`), fullPage: true });
    } catch (e) {
      issues.push({ type: 'navigation', at: route, message: String(e.message || e) });
    }
    results.push({ route, status, finalPath, title, h1: (h1 || '').trim().slice(0, 120) });
  }

  await browser.close();

  const redirectedToLogin = results.filter(r => r.finalPath === '/login' && r.route !== '/login').map(r => r.route);
  const summary = { base, testedRoutes: routes, results, redirectedToLogin, issues };
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log(JSON.stringify({
    base,
    routesTested: routes.length,
    redirectedToLoginCount: redirectedToLogin.length,
    issueCount: issues.length,
    results,
    issues
  }, null, 2));
})();
