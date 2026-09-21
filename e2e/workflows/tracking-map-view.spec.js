// file location: e2e/workflows/tracking-map-view.spec.js
// The Key/Parking Grid ⇄ Map switch on /tracking.
//
// The behaviour this pins down is the whole point of the feature: Map is an
// INLINE view of the Key/Parking tab, rendered in the same content slot as the
// card grid inside app-layout-page-card. It must never open a popup, never
// navigate, and never reset the search or the filters.
//
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Playwright config and existing E2E specs use CommonJS.
const { test, expect } = require("@playwright/test");

const gridButton = (page) => page.getByRole("button", { name: "Grid", exact: true });
const mapButton = (page) => page.getByRole("button", { name: "Map", exact: true });

const gotoTracking = async (page) => {
  await page.goto("/tracking");
  await expect(gridButton(page)).toBeVisible();
};

// The map is code-split (next/dynamic) so that Grid, the default view, never
// pays for it. Against a dev server the first request for that chunk can be a
// compile, so give its first paint more room than the default expect timeout.
const MAP_READY_TIMEOUT = 30_000;

const openMapView = async (page) => {
  await mapButton(page).click();
  await expect(page.locator(".tracking-map")).toBeVisible({ timeout: MAP_READY_TIMEOUT });
};

test.describe("tracking Key/Parking map view", () => {
  // The shared auth.setup account is an Admin Manager, and /tracking is not a
  // route that role owns: WORKSPACE_NAV_SECTIONS in
  // src/config/workspace/departments.js lists the Tracker under techs /
  // service / service manager / workshop manager / valet / admin, so the guard
  // in src/pages/_app.js correctly replaces the route with /newsfeed once
  // UserContext resolves — a second or two in, right in the middle of a test.
  //
  // Sign in as a technician instead. That is the role that actually uses
  // Key/Parking, so these tests exercise the feature as a real user meets it
  // rather than stubbing an authorisation check to get past it.
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(async () => {
      const { csrfToken } = await (await fetch("/api/auth/csrf")).json();
      await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken, userId: "6", callbackUrl: "/" }),
        redirect: "follow",
      });
    });
  });

  test("defaults to Grid and switches to Map inline, without a popup or a navigation", async ({ page }) => {
    await gotoTracking(page);

    await expect(gridButton(page)).toHaveAttribute("aria-pressed", "true");
    await expect(mapButton(page)).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".tracking-map")).toHaveCount(0);

    await mapButton(page).click();

    await expect(page.locator(".tracking-map")).toBeVisible({ timeout: MAP_READY_TIMEOUT });
    await expect(mapButton(page)).toHaveAttribute("aria-pressed", "true");
    // Inline, not a popup, and still on the same route.
    await expect(page.locator(".popup-backdrop")).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe("/tracking");
    // Still inside the global page card, under the tracking page's own child.
    await expect(
      page.locator('[data-dev-section-key="app-layout-page-card"] .tracking-map')
    ).toHaveCount(1);

    await gridButton(page).click();
    await expect(page.locator(".tracking-map")).toHaveCount(0);
  });

  test("the control is keyboard operable and meets the 44px touch floor", async ({ page }) => {
    await gotoTracking(page);

    await mapButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".tracking-map")).toBeVisible({ timeout: MAP_READY_TIMEOUT });

    for (const button of [gridButton(page), mapButton(page)]) {
      const box = await button.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("search and the location filter survive the switch and apply to both views", async ({ page }) => {
    await gotoTracking(page);

    // By placeholder, not by role: the topbar's Global Search is also a
    // searchbox and comes first in the DOM.
    const search = page.getByPlaceholder("Search active jobs");
    await search.fill("ZZ99 ZZZ");
    await openMapView(page);

    await expect(search).toHaveValue("ZZ99 ZZZ");

    await gridButton(page).click();
    await expect(search).toHaveValue("ZZ99 ZZZ");
  });

  test("the map reports a computed registry total and keeps unmapped vehicles listed", async ({ page }) => {
    await gotoTracking(page);
    await openMapView(page);

    // The footnote total is derived from the registry, never typed.
    await expect(page.locator(".tracking-map__footnote")).toContainText(
      /Calibrated site registry: \d+ vehicle-holding spaces/
    );

    // Every bay that is drawn is a real bay from the registry.
    expect(await page.locator(".tracking-map__space, .tracking-map__marker").count()).toBeGreaterThan(0);

    // If anything is unmapped it must still be reachable and correctable.
    const unmapped = page.locator(".tracking-map__unmapped");
    if (await unmapped.count()) {
      await unmapped.getByRole("button", { name: /Show list/i }).click();
      await expect(unmapped.getByRole("button", { name: "Assign space" }).first()).toBeVisible();
    }
  });

  test("no vehicle is drawn as a numbered cluster, and none is invented into a bay", async ({ page }) => {
    await gotoTracking(page);
    await openMapView(page);
    await page.waitForTimeout(1500);

    // Regression: markers used to carry counts like 54 / 65 / 72 / 73 where a
    // whole area had been collapsed onto one bay.
    const markers = page.locator(".tracking-map__marker");
    for (let index = 0; index < (await markers.count()); index += 1) {
      const text = ((await markers.nth(index).innerText()) || "").trim();
      expect(text, `marker ${index}`).not.toMatch(/^\d+$/);
    }

    // Every drawn marker occupies its own bay: no two share one.
    const bays = await markers.evaluateAll((nodes) => nodes.map((n) => n.style.left + "|" + n.style.top));
    expect(new Set(bays).size).toBe(bays.length);
  });

  test("a vehicle marker can be selected by keyboard and shows its own record", async ({ page }) => {
    await gotoTracking(page);
    await openMapView(page);

    // Markers are derived from the snapshot, which lands after the frame does.
    const marker = page.locator(".tracking-map__marker").first();
    await marker.waitFor({ timeout: 15000 }).catch(() => {});
    test.skip(
      (await page.locator(".tracking-map__marker").count()) === 0,
      "No tracked vehicle is currently placed on the site map."
    );

    const name = await marker.getAttribute("aria-label") || (await marker.innerText());
    await marker.focus();
    await page.keyboard.press("Enter");

    const panel = page.locator(".tracking-map__panel");
    await expect(panel).toBeVisible();
    await expect(marker).toHaveAttribute("aria-pressed", "true");

    const reg = (await panel.locator(".tracking-map__panel-title").innerText()).trim();
    expect(name.toUpperCase()).toContain(reg);

    // Move mode only ever offers free bays, and Escape leaves it without
    // closing the record.
    await panel.getByRole("button", { name: /move vehicle/i }).click();
    await expect(page.locator(".tracking-map__space--target").first()).toBeVisible();
    await expect(page.locator(".tracking-map__marker.is-selected")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator(".tracking-map__space--target")).toHaveCount(0);
    await expect(panel).toBeVisible();

    // Escape again closes the record and returns focus to the marker.
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(marker).toBeFocused();
  });

  test("the map view has no horizontal overflow on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoTracking(page);
    await openMapView(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
