// file location: e2e/responsive/website-phone-floor.spec.js
//
// The customer-site phone-floor gate (responsive sweep, 2026-09).
//
// Sibling of phone-floor.spec.js, which covers staff UI. The two are kept
// separate on purpose: /website is a wholly separate design system
// (src/styles/custglobal.css, gated by html.website-scope) with its own
// baseline, and CLAUDE.md §3.0b rule 6 makes that isolation a hard rule. A
// shared spec would blur which system a failure belongs to.
//
// custglobal.css passes its static gate (npm run check:website), but a static
// gate cannot see a rendered layout: it cannot tell that a nav row is clipped
// at 375px, or that a quantity stepper renders 28px tall. Those only show up
// by measuring a real browser, which is what this does.
//
// WHAT IT CHECKS
//   1. clipped — content wider than its box, where the overflow is hidden,
//      nothing signals the truncation, and the box does not scroll. Content
//      the user can neither see nor reach.
//   2. touch   — an interactive control under the 44px touch floor.
//   3. scope   — the page really is running the customer design system
//      (html.website-scope) and has not leaked staff classes.
//
// Ratcheted against website-phone-floor-baseline.json. Counts may only fall.
// Refresh with UPDATE_RESPONSIVE_BASELINE=1.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('../helpers/fixtures.js');
const { measurePhoneFloor } = require('./measure.js');

const FLOOR = 375;
const TOUCH_FLOOR = 44;
const BASELINE_PATH = path.join(__dirname, 'website-phone-floor-baseline.json');
const UPDATING = process.env.UPDATE_RESPONSIVE_BASELINE === '1';

// Public customer routes. /website/profile and the shop success/cancel
// callbacks need session or gateway state and are covered separately.
//
// Every customer-facing route below is at ZERO on both counts. /website/dev is
// the internal design showcase rather than a customer journey, and carries a
// baseline of 18: cross-reference links in its documentation TABLE, which are
// reference text in a dense table (giving each a 44px box would double the
// table's height for no reader benefit). It stays in the gate so the count can
// only fall - the showcase renders every customer component, which makes it the
// broadest early-warning surface available.
const ROUTES = [
  '/website',
  '/website/available-stock',
  '/website/parts-catalog',
  '/website/valuation',
  '/website/login',
  '/website/shop/cart',
  '/website/dev',
];

const readBaseline = () => {
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    return {};
  }
};


test.describe(`Responsive — customer site, ${FLOOR}px phone floor`, () => {
  const collected = {};

  for (const route of ROUTES) {
    test(`${route}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: FLOOR, height: 812 });
      await page.goto(route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(900);

      const { clipped, touch, websiteScope, staffScope } = await measurePhoneFloor(page, TOUCH_FLOOR);
      collected[route] = { clipped: clipped.length, touch: touch.length };

      // The customer design system must actually be the one in force, and the
      // staff one must not be layered on top of it.
      expect(websiteScope, `${route} is not running the customer design system (html.website-scope)`).toBe(true);
      expect(staffScope, `${route} has staff-scope on <html> — the two systems must stay isolated`).toBe(false);

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
    console.log(`Customer responsive baseline written to ${BASELINE_PATH}`);
  });
});
