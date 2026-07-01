// file location: src/lib/dev-platform/supportSectionTabs.test.js
//
// Phase 11 — the Support hub tab grouping is the whole point of the restructure
// (scattered nav rail → grouped top-left tabs), so lock the model in a test.

import { describe, it, expect } from "vitest";
import {
  SUPPORT_SECTION_TABS,
  DEFAULT_SUPPORT_TAB,
  isSupportSectionTab,
  getSupportSectionTab,
  resolveSupportTab,
} from "@/lib/dev-platform/supportSectionTabs";

describe("supportSectionTabs", () => {
  it("groups the support areas into the expected ordered tabs", () => {
    expect(SUPPORT_SECTION_TABS.map((t) => t.key)).toEqual([
      "overview",
      "reports",
      "investigations",
      "health",
      "notifications",
      "activity",
      "settings",
    ]);
  });

  it("gives every tab a unique key, a label and an icon", () => {
    const keys = SUPPORT_SECTION_TABS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const tab of SUPPORT_SECTION_TABS) {
      expect(tab.label).toBeTruthy();
      expect(tab.icon).toBeTruthy();
      expect(typeof tab.description).toBe("string");
    }
  });

  it("defaults to the overview tab", () => {
    expect(DEFAULT_SUPPORT_TAB).toBe("overview");
    expect(SUPPORT_SECTION_TABS[0].key).toBe("overview");
  });

  it("validates and looks up tab keys", () => {
    expect(isSupportSectionTab("reports")).toBe(true);
    expect(isSupportSectionTab("nope")).toBe(false);
    expect(getSupportSectionTab("health")?.label).toBe("Health");
    expect(getSupportSectionTab("nope")).toBeNull();
  });

  it("coerces untrusted tab values to a valid key", () => {
    expect(resolveSupportTab("activity")).toBe("activity");
    expect(resolveSupportTab("../../etc")).toBe(DEFAULT_SUPPORT_TAB);
    expect(resolveSupportTab(undefined)).toBe(DEFAULT_SUPPORT_TAB);
  });
});
