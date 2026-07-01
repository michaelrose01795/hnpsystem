// file location: src/lib/support/investigationCache.test.js
import { afterEach, describe, expect, it } from "vitest";
import {
  investigationKey,
  getOrBuildInvestigation,
  clearInvestigationCache,
} from "@/lib/support/investigationCache";

afterEach(() => clearInvestigationCache());

const snap = {
  route: { asPath: "/vhc/1" },
  unhandled_errors: [{ message: "boom" }],
  failed_requests: [{ method: "POST", url: "/api/vhc/save", status: 500 }],
};

describe("investigationKey", () => {
  it("is stable for the same snapshot and changes with the prior-report set", () => {
    const k1 = investigationKey(snap, []);
    const k2 = investigationKey(snap, []);
    const k3 = investigationKey(snap, [{ id: "r1" }]);
    expect(k1).toBe(k2);
    expect(k1).not.toBe(k3);
  });

  it("changes when the diagnostics change", () => {
    const k1 = investigationKey(snap);
    const k2 = investigationKey({ ...snap, unhandled_errors: [{ message: "different" }] });
    expect(k1).not.toBe(k2);
  });
});

describe("getOrBuildInvestigation", () => {
  it("builds once then serves the cached (identical) result", () => {
    const store = new Map();
    const first = getOrBuildInvestigation(snap, { store });
    const second = getOrBuildInvestigation(snap, { store });
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.investigation).toBe(first.investigation); // same object reference
  });

  it("evicts the oldest entry when the store is full", () => {
    const store = new Map();
    getOrBuildInvestigation(snap, { store, maxEntries: 1 });
    getOrBuildInvestigation({ ...snap, route: { asPath: "/other" } }, { store, maxEntries: 1 });
    expect(store.size).toBe(1);
  });
});
