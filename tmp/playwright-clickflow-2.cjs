const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const base = 'http://127.0.0.1:3000';
  const outDir = path.join(process.cwd(), 'tmp', 'playwright-clickflow-2');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));

  const navLinks = ['News Feed', 'Messages', 'Archive Job', 'Profile'];
  const results = [];

  for (let i = 0; i < navLinks.length; i += 1) {
    const label = navLinks[i];
    await page.goto(base + '/appointments', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const link = page.getByRole('link', { name: label }).first();
    const exists = await link.count();
    if (!exists) {
      results.push({ link: label, clicked: false, reason: 'not found on /appointments' });
      continue;
    }

    await link.click({ timeout: 5000 });
    await page.waitForTimeout(1200);
    const pathNow = new URL(page.url()).pathname;
    const shot = `${String(i + 1).padStart(2, '0')}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    await page.screenshot({ path: path.join(outDir, shot), fullPage: true });
    results.push({ link: label, clicked: true, finalPath: pathNow });
  }

  await browser.close();
  const summary = { results, errors };
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
})();
