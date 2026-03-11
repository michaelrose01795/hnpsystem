const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const base = 'http://127.0.0.1:3000';
  const outDir = path.join(process.cwd(), 'tmp', 'playwright-clickflow');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const log = [];

  page.on('pageerror', e => log.push({ type: 'pageerror', msg: e.message }));
  page.on('console', m => { if (m.type() === 'error') log.push({ type: 'console.error', msg: m.text() }); });

  await page.goto(base + '/appointments', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, '01-appointments.png'), fullPage: true });

  const clicks = ['News Feed', 'Messages', 'Profile', 'Archive Job'];
  const results = [];
  for (const text of clicks) {
    const link = page.getByRole('link', { name: text }).first();
    const exists = await link.count();
    if (!exists) {
      results.push({ link: text, clicked: false, finalPath: new URL(page.url()).pathname, reason: 'not found' });
      continue;
    }
    await link.click({ timeout: 5000 });
    await page.waitForTimeout(1200);
    const finalPath = new URL(page.url()).pathname;
    const file = `${results.length + 2}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    await page.screenshot({ path: path.join(outDir, file), fullPage: true });
    results.push({ link: text, clicked: true, finalPath });
  }

  await browser.close();
  const summary = { results, log };
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
})();
