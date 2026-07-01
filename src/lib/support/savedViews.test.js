// file location: src/lib/support/savedViews.test.js
import { describe, expect, it, beforeEach } from "vitest";
import {
  loadSavedViews,
  saveSavedViews,
  addSavedView,
  removeSavedView,
  normaliseView,
  SAVED_VIEWS_KEY,
} from "@/lib/support/savedViews";

// Minimal injectable localStorage stand-in.
function makeStore(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

describe("normaliseView", () => {
  it("keeps only known filter keys and clamps the name", () => {
    const v = normaliseView({ name: "x".repeat(200), filters: { status: "new", evil: "drop", q: 5, unassigned: true } });
    expect(v.name.length).toBeLessThanOrEqual(60);
    expect(v.filters).toEqual({ status: "new", q: "5", unassigned: true });
    expect(v.id).toBeTruthy();
  });
});

describe("saved views persistence", () => {
  let store;
  beforeEach(() => {
    store = makeStore();
  });

  it("returns [] on empty / corrupt storage", () => {
    expect(loadSavedViews(store)).toEqual([]);
    store.setItem(SAVED_VIEWS_KEY, "{not json");
    expect(loadSavedViews(store)).toEqual([]);
  });

  it("adds, loads, replaces by id, and removes", () => {
    let list = addSavedView({ id: "v1", name: "Open", filters: { status: "new" } }, store);
    expect(list).toHaveLength(1);
    list = addSavedView({ id: "v2", name: "Critical", filters: { severity: "critical" } }, store);
    expect(loadSavedViews(store)).toHaveLength(2);
    // replace v1
    list = addSavedView({ id: "v1", name: "Open (edited)", filters: { status: "triaged" } }, store);
    expect(list.find((v) => v.id === "v1").name).toBe("Open (edited)");
    expect(list).toHaveLength(2);
    // remove
    list = removeSavedView("v1", store);
    expect(list.map((v) => v.id)).toEqual(["v2"]);
  });

  it("caps the number of saved views", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `v${i}`, name: `View ${i}`, filters: {} }));
    saveSavedViews(many, store);
    expect(loadSavedViews(store).length).toBeLessThanOrEqual(20);
  });

  it("no-ops safely with no storage available", () => {
    expect(loadSavedViews(null)).toEqual([]);
    expect(saveSavedViews([{ name: "x" }], null)).toBe(false);
  });
});
