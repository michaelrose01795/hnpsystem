// file location: e2e/workflows/dev-layout-overlay.spec.js
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Playwright config and existing E2E specs use CommonJS.
const { test, expect } = require("@playwright/test");

const OVERLAY_MODES = ["labels", "details", "inspect", "trace"];

test.describe("dev layout overlay section selection", () => {
  for (const mode of OVERLAY_MODES) {
    test(`${mode} mode selects a section without activating controls underneath`, async ({ page, context }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.addInitScript((overlayMode) => {
        window.localStorage.setItem("hnp-dev-layout-overlay-enabled", "1");
        window.localStorage.setItem("hnp-dev-layout-overlay-mode", overlayMode);
        window.localStorage.setItem("hnp-dev-layout-overlay-panel-open", "0");
      }, mode);

      await page.goto("/jobs");
      await expect(page.locator('[data-dev-overlay-internal="1"][class*="rootInspect"]')).toHaveCount(1);
      await expect(page.locator("html")).toHaveAttribute("data-dev-overlay-mode", mode);

      const target = await page.evaluate(() => {
        const control = Array.from(document.querySelectorAll("button, a[href]")).find((element) => {
          if (element.closest("[data-dev-overlay-internal='1']")) return false;
          if (!element.closest("[data-dev-section-key]")) return false;
          const rect = element.getBoundingClientRect();
          return rect.width > 20 && rect.height > 20 && rect.top >= 0 && rect.bottom <= window.innerHeight;
        });

        if (!control) return null;
        const rect = control.getBoundingClientRect();
        window.__devOverlayUnderlyingActivations = 0;
        control.addEventListener("click", () => {
          window.__devOverlayUnderlyingActivations += 1;
        });

        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      });

      expect(target).not.toBeNull();
      await page.mouse.click(target.x, target.y);

      await expect.poll(() => page.evaluate(() => window.__devOverlayUnderlyingActivations)).toBe(0);
      await expect(page.locator('[class*="boxSelected"]')).toHaveCount(1);
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).not.toBe("");

      const overlayToggle = page.getByRole("switch", { name: /^(overlay|toggle dev layout overlay)$/i });
      await expect(overlayToggle).toBeChecked();
      await overlayToggle.click();
      await expect(page.locator('[data-dev-overlay-internal="1"][class*="rootInspect"]')).toHaveCount(0);
      await expect(page.locator("html")).not.toHaveAttribute("data-dev-overlay-enabled", "true");
    });
  }
});
