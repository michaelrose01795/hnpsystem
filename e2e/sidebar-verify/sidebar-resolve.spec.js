// Scratch verification spec: the authenticated staff sidebar must leave
// SidebarNavSkeleton and render real navigation for every representative role,
// in both light and dark mode. Logs in through the SAME dev credentials path
// (userId-based, isDevLogin: true) that was leaving the sidebar stuck.
const { test, expect } = require('@playwright/test');

const ROLES = [
  { label: 'Admin Manager', userId: '1' },
  { label: 'General Manager', userId: '2' },
  { label: 'Admin', userId: '17' },
  { label: 'Workshop Manager', userId: '45' },
  { label: 'Techs Workshop', userId: '6' },
  { label: 'Parts Manager', userId: '5' },
  { label: 'Parts', userId: '15' },
  { label: 'Sales', userId: '11' },
];

for (const mode of ['light', 'dark']) {
  for (const role of ROLES) {
    test(`${mode} - sidebar resolves for ${role.label} (user ${role.userId})`, async ({ page }) => {
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

      await page.addInitScript((m) => {
        try { window.localStorage.setItem('hp-dms-theme', m); } catch (e) {}
      }, mode);

      await page.goto('/login');
      await page.evaluate(async (id) => {
        const res = await fetch('/api/auth/csrf');
        const { csrfToken } = await res.json();
        await fetch('/api/auth/callback/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ csrfToken, userId: id, callbackUrl: '/' }),
          redirect: 'follow',
        });
      }, role.userId);

      await page.goto('/newsfeed');

      const navLinks = page.locator('aside a[href^="/"]');
      await expect
        .poll(async () => navLinks.count(), {
          timeout: 90_000,
          message: 'sidebar never rendered navigation links',
        })
        .toBeGreaterThan(0);

      const skeletons = page.locator('aside [class*="skeleton" i]');
      await expect
        .poll(async () => skeletons.count(), { timeout: 30_000, message: 'nav skeleton still present' })
        .toBe(0);

      const bootstrap = await page.evaluate(async () => {
        const r = await fetch('/api/shell/bootstrap', { credentials: 'include' });
        const j = await r.json();
        return {
          userId: j && j.data ? j.data.userId : null,
          identity: j && j.data ? j.data.identity : null,
          hasAccess: !!(j && j.data && j.data.sidebarAccess),
        };
      });
      const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      const hrefs = await navLinks.evaluateAll((els) => els.map((e) => e.getAttribute('href')));

      console.log(
        `${mode}/${role.label}: theme=${theme} identity=${bootstrap.identity} userId=${bootstrap.userId} ` +
          `snapshot=${bootstrap.hasAccess} navLinks=${hrefs.length} :: ${hrefs.slice(0, 12).join(',')}`
      );

      expect(bootstrap.identity).toBe('linked');
      expect(bootstrap.userId).toBe(Number(role.userId));
      expect(theme).toBe(mode);
      expect(errors.filter((e) => /sidebar|user id/i.test(e))).toEqual([]);

      await page.screenshot({ path: `.sidebar-verify/${mode}-${role.label.replace(/[^a-z0-9]+/gi, '-')}.png` });
    });
  }
}
