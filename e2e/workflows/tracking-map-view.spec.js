// file location: e2e/workflows/tracking-map-view.spec.js
// The Grid ⇄ Map switch on /tracking/Key-Parking.
//
// The behaviour this pins down is the whole point of the feature: Map is an
// INLINE view of the Key/Parking page, rendered in the same content slot as the
// card grid inside app-layout-page-card. It must never open a popup, never
// navigate, and never reset the search or the filters.
//
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Playwright config and existing E2E specs use CommonJS.
const { test, expect } = require("@playwright/test");

const gridButton = (page) => page.getByRole("button", { name: "Grid", exact: true });
const mapButton = (page) => page.getByRole("button", { name: "Map", exact: true });

const gotoTracking = async (page) => {
  await page.goto("/tracking/Key-Parking");
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
  // The shared auth.setup account is an Admin Manager, and /tracking/Key-Parking
  // is not a route that role owns: WORKSPACE_NAV_SECTIONS in
  // src/config/workspace/departments.js lists Key/Parking under techs /
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
    expect(new URL(page.url()).pathname).toBe("/tracking/Key-Parking");
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

  // The overlay is drawn once the plan image has loaded and reported its size.
  const section = (page, id) => page.locator(`.parking-map__section[data-area-id="${id}"]`);
  const panel = (page) => page.locator(".tracking-panel");

  test("every physical section, including the new buildings and Off Site, is labelled on the plan", async ({ page }) => {
    await gotoTracking(page);
    await openMapView(page);

    for (const id of ["service", "sales-1", "staff", "trade", "paint", "valet", "workshop", "showroom", "off-site"]) {
      await expect(section(page, id), id).toHaveCount(1, { timeout: MAP_READY_TIMEOUT });
    }
    // N/A is logical, never a place on the plan.
    await expect(section(page, "na")).toHaveCount(0);
  });

  test("clicking a map label opens that section, and Escape closes it", async ({ page }) => {
    await gotoTracking(page);
    await openMapView(page);

    const paint = section(page, "paint");
    await paint.locator(".parking-map__label-pill").click();
    await expect(paint).toHaveAttribute("aria-pressed", "true");
    await expect(panel(page)).toHaveAttribute("data-section-id", "paint");
    await expect(panel(page).locator(".tracking-panel__title")).toHaveText("Paint");
    await expect(panel(page)).toContainText("Capacity");
    await expect(panel(page)).toContainText("Occupied");
    await expect(panel(page)).toContainText("Available");

    await page.keyboard.press("Escape");
    await expect(paint).toHaveAttribute("aria-pressed", "false");
    await expect(panel(page)).not.toHaveAttribute("data-section-id", "paint");
  });

  test("a section can be selected by keyboard", async ({ page }) => {
    await gotoTracking(page);
    await openMapView(page);

    const workshop = section(page, "workshop");
    await workshop.focus();
    await page.keyboard.press("Enter");
    await expect(workshop).toHaveAttribute("aria-pressed", "true");
    await expect(panel(page).locator(".tracking-panel__title")).toHaveText("Workshop");
  });

  test("the overview reaches every section, including N/A and Off Site, and they are different", async ({ page }) => {
    await gotoTracking(page);
    await openMapView(page);

    const rows = panel(page).locator(".tracking-panel__row-button");
    const labels = (await rows.allInnerTexts()).map((text) => text.trim());
    expect(labels).toEqual([
      "N/A", "Service", "Sales 1", "Sales 2", "Sales 3", "Sales 4", "Sales 5", "Sales 6", "Sales 7",
      "Sales 8", "Sales 9", "Sales 10", "Staff", "Trade", "Paint", "Valet", "Workshop", "Showroom", "Off Site",
    ]);

    await panel(page).locator('tr[data-section-id="na"] .tracking-panel__row-button').click();
    await expect(panel(page).locator(".tracking-panel__title")).toHaveText("N/A");
    await panel(page).getByRole("button", { name: "Close section" }).click();
    await panel(page).locator('tr[data-section-id="off-site"] .tracking-panel__row-button').click();
    await expect(panel(page).locator(".tracking-panel__title")).toHaveText("Off Site");
    await expect(section(page, "off-site")).toHaveAttribute("aria-pressed", "true");
  });

  test("panning across a section does not select it", async ({ page }) => {
    await gotoTracking(page);
    await openMapView(page);

    const box = await section(page, "workshop").locator(".parking-map__region").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30, { steps: 5 });
    await page.mouse.up();
    await expect(section(page, "workshop")).toHaveAttribute("aria-pressed", "false");
  });

  test("the move destinations are the full canonical list", async ({ page }) => {
    await gotoTracking(page);
    await openMapView(page);

    // Pick the busiest section so there is a vehicle to move, if any exist.
    const counts = await panel(page).locator("tr[data-section-id]").evaluateAll((nodes) =>
      nodes.map((node) => ({ id: node.dataset.sectionId, count: Number(node.cells[1]?.textContent || 0) }))
    );
    const busiest = counts.sort((a, b) => b.count - a.count)[0];
    test.skip(!busiest || busiest.count === 0, "No live tracked vehicle to move.");

    await panel(page).locator(`tr[data-section-id="${busiest.id}"] .tracking-panel__row-button`).click();
    const row = panel(page).locator(".tracking-panel__vehicle").first();
    await row.locator('[aria-haspopup="listbox"]').click();
    for (const label of ["Paint", "Valet", "Workshop", "Showroom", "Off Site"]) {
      await expect(page.getByRole("option", { name: label, exact: true })).toBeVisible();
    }
    await page.keyboard.press("Escape");
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
