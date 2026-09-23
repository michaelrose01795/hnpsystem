// file location: e2e/responsive/phone-floor.spec.js
//
// The phone-floor gate (responsive sweep, 2026-09).
//
// CLAUDE.md §3.6 requires every page to work on a phone, but nothing enforced
// it, so regressions were only ever found by someone opening the app on their
// phone. PHONE_FLOOR (375px, iPhone SE) is the contracted hard minimum — see
// src/styles/breakpoints.js.
//
// WHAT THIS CHECKS, AND WHY IT IS NOT "DOES THE PAGE SCROLL SIDEWAYS"
// ------------------------------------------------------------------
// The obvious test — assert document.scrollWidth <= clientWidth — cannot fail
// in this app and would be a gate that only ever passes. staffglobal.css sets
// `overflow-x: clip` on html, `overflow-x: hidden` on body, and caps every
// div at `max-width: 100%`. Horizontal panning is therefore impossible by
// construction.
//
// That is not the same as content fitting. It means over-wide content is
// silently CLIPPED instead: a button past the right edge is not merely awkward
// to reach, it cannot be reached at all, and nothing on screen indicates it
// exists. That — not scrolling — is the real phone failure mode here, so it is
// what this gate measures:
//
//   1. clipped   — an element whose content is wider than its box, where the
//                  overflow is hidden/clipped, there is no ellipsis to signal
//                  the truncation, and the box is not scrollable. Content the
//                  user can neither see nor get to.
//   2. touch     — an interactive control below the 44px touch floor.
//
// Both are ratcheted against e2e/responsive/phone-floor-baseline.json in the
// same style as tools/design-baselines: existing debt is recorded per route so
// new drift fails the build, while known offenders keep passing until they are
// migrated. Counts may only fall. Refresh with UPDATE_RESPONSIVE_BASELINE=1.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('../helpers/fixtures.js');
const { measurePhoneFloor } = require('./measure.js');

const FLOOR = 375;
const TOUCH_FLOOR = 44;
const BASELINE_PATH = path.join(__dirname, 'phone-floor-baseline.json');
const UPDATING = process.env.UPDATE_RESPONSIVE_BASELINE === '1';

// Routes that render real staff content for the E2E user. Several other routes
// role-redirect to /newsfeed for this account and are deliberately not listed:
// a redirect would make the gate assert against the wrong page and pass.
const ROUTES = [
  '/newsfeed',
  '/messages',
  '/customers',
  '/company-accounts',
  '/archive',
  '/profile',
  '/reports/overview',
  '/dashboard/workshop',
];

const readBaseline = () => {
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    return {};
  }
};


test.describe(`Responsive — ${FLOOR}px phone floor`, () => {
  const collected = {};

  for (const route of ROUTES) {
    test(`${route}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: FLOOR, height: 812 });
      await page.goto(route, { waitUntil: 'networkidle' });
      // Stacked-card tables are applied by GlobalTableShells after hydration,
      // so measuring too early races the layout being checked.
      await page.waitForTimeout(900);

      const landed = await page.evaluate(() => location.pathname);
      expect(landed, `${route} redirected to ${landed} — the gate would assert against the wrong page`).toBe(route);

      const { clipped, touch } = await measurePhoneFloor(page, TOUCH_FLOOR);
      collected[route] = { clipped: clipped.length, touch: touch.length };

      if (UPDATING) return;

      const baseline = readBaseline()[route] || { clipped: 0, touch: 0 };

      expect(
        clipped.length,
        `${route}: ${clipped.length} element(s) with unreachable clipped content ` +
          `(baseline ${baseline.clipped}). Offenders:\n  ${clipped.slice(0, 10).join('\n  ')}`
      ).toBeLessThanOrEqual(baseline.clipped);

      expect(
        touch.length,
        `${route}: ${touch.length} control(s) under the ${TOUCH_FLOOR}px touch floor ` +
          `(baseline ${baseline.touch}). Offenders:\n  ${touch.slice(0, 10).join('\n  ')}`
      ).toBeLessThanOrEqual(baseline.touch);
    });
  }

  test.afterAll(() => {
    if (!UPDATING) return;
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(collected, null, 2)}\n`);
    console.log(`Responsive baseline written to ${BASELINE_PATH}`);
  });
});
