const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
  const outDir = path.join(process.cwd(), 'tmp', 'playwright-smoke');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const issues = [];
  const currentPath = () => {
    try { return new URL(page.url()).pathname; } catch { return page.url(); }
  };

  page.on('pageerror', (err) => {
    issues.push({ type: 'pageerror', path: currentPath(), message: String(err.message || err) });
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      issues.push({ type: 'console.error', path: currentPath(), message: msg.text() });
    }
  });
  page.on('requestfailed', (req) => {
    issues.push({ type: 'requestfailed', path: currentPath(), message: `${req.method()} ${req.url()} -> ${req.failure()?.errorText || 'failed'}` });
  });
  page.on('response', (res) => {
    const status = res.status();
    if (status >= 500) {
      issues.push({ type: 'http5xx', path: currentPath(), message: `${status} ${res.url()}` });
    }
  });

  const visited = [];

  async function visit(urlPath, label) {
    const url = new URL(urlPath, base).toString();
    let status = null;
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      status = resp ? resp.status() : null;
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(outDir, `${label}.png`), fullPage: true });
      const title = await page.title();
      visited.push({ path: new URL(page.url()).pathname, status, title });
    } catch (e) {
      issues.push({ type: 'navigation', path: urlPath, message: String(e.message || e) });
      visited.push({ path: urlPath, status, title: 'NAVIGATION_FAILED' });
    }
  }

  await visit('/', '00-home');

  const links = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('header a[href], nav a[href], main a[href], a[href]'));
    const out = [];
    for (const a of nodes) {
      const href = a.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;
      let p;
      try { p = new URL(href, location.origin).pathname; } catch { continue; }
      if (!p.startsWith('/')) continue;
      if (p === '/_next' || p.startsWith('/_next/')) continue;
      const rect = a.getBoundingClientRect();
      const style = window.getComputedStyle(a);
      const visible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      if (!visible) continue;
      const text = (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
      out.push({ path: p, text });
    }
    const seen = new Set();
    const uniq = [];
    for (const l of out) {
      if (seen.has(l.path)) continue;
      seen.add(l.path);
      uniq.push(l);
    }
    return uniq.slice(0, 12);
  });

  let i = 1;
  for (const l of links) {
    if (l.path === '/') continue;
    const label = String(i).padStart(2, '0') + '-' + l.path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    await visit(l.path, label || `page-${i}`);
    i += 1;
  }

  await browser.close();

  const summary = { base, visited, linkCandidates: links, issues };
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log(JSON.stringify({
    base,
    pagesVisited: visited.length,
    visited,
    issuesCount: issues.length,
    issues
  }, null, 2));
})();
