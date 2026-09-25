// file location: src/features/workspaces/workspaceModel.test.js
import { describe, it, expect } from "vitest";
import {
  MAX_WORKSPACES,
  MIN_PANE_WIDTH,
  STORAGE_VERSION,
  createInitialState,
  workspaceReducer,
  isMulti,
  fitCapacity,
  suggestCapacity,
  shouldOfferWorkspace,
  computeLayout,
  focusedHref,
  findWorkspaceShowing,
  toWorkspaceHref,
  labelForHref,
  resizePair,
  applyPreset,
  activePresetId,
  pickOtherWorkspace,
  serializeState,
  deserializeState,
  weightOf,
  multiViewHref,
  parseMultiViewPath,
  isMultiViewPath,
} from "./workspaceModel";

const ORIGIN = "https://dms.example";
const reduce = workspaceReducer;
// Multi mode with cards "a" and "b" showing the given pages; "b" focused.
const enter = (hrefs = ["/messages", null], extra = {}) =>
  reduce(createInitialState(), { type: "enter", hrefs, ids: ["a", "b", "c"], ...extra });
const add = (state, href, id) => reduce(state, { type: "add", href, id });

describe("capacity", () => {
  it("never offers multi workspace on an ordinary 1920px screen", () => {
    // 1920 window − 260 sidebar − chrome padding/gap ≈ 1612px of area.
    expect(suggestCapacity(1612)).toBe(1);
    expect(shouldOfferWorkspace(createInitialState(), 1612)).toBe(false);
  });

  it("offers a second card on a QHD window and a third on a 4K/dual window", () => {
    expect(suggestCapacity(2250)).toBe(2);
    expect(suggestCapacity(3520)).toBe(3);
    expect(shouldOfferWorkspace(createInitialState(), 2250)).toBe(true);
    // Already split in two: only a third is worth offering.
    expect(shouldOfferWorkspace(enter(), 2250)).toBe(false);
    expect(shouldOfferWorkspace(enter(), 3520)).toBe(true);
  });

  it("caps at MAX_WORKSPACES", () => {
    expect(fitCapacity(20000)).toBe(MAX_WORKSPACES);
  });

  it("stops offering once the user dismissed that capacity", () => {
    const state = reduce(createInitialState(), { type: "dismissPrompt", capacity: 2 });
    expect(shouldOfferWorkspace(state, 2250)).toBe(false);
    // …but asks again if even more room appears.
    expect(shouldOfferWorkspace(state, 3520)).toBe(true);
  });
});

describe("entering and leaving", () => {
  it("starts in single mode with no cards", () => {
    const state = createInitialState();
    expect(isMulti(state)).toBe(false);
    expect(computeLayout(state, 4000).visibleIds).toEqual([]);
    expect(focusedHref(state)).toBeNull();
  });

  it("splits into the current page plus an empty card, focusing the empty one", () => {
    const state = enter(["/messages"], { hostHref: "/messages" });
    expect(isMulti(state)).toBe(true);
    expect(state.workspaces).toEqual([
      { id: "a", href: "/messages" },
      { id: "b", href: null },
    ]);
    expect(state.focusedId).toBe("b");
    expect(state.hostHref).toBe("/messages");
  });

  it("keeps focus on the current page when a link opens beside it", () => {
    const state = enter(["/messages", "/job-cards/7"], { focusIndex: 0 });
    expect(state.focusedId).toBe("a");
    expect(focusedHref(state)).toBe("/messages");
  });

  it("ignores enter when already split, and caps the starting cards", () => {
    const state = enter();
    expect(reduce(state, { type: "enter", hrefs: ["/x", "/y"] })).toBe(state);
    const many = reduce(createInitialState(), { type: "enter", hrefs: ["/a", "/b", "/c", "/d"] });
    expect(many.workspaces).toHaveLength(MAX_WORKSPACES);
  });

  it("exits back to single mode but keeps the prompt dismissal", () => {
    let state = reduce(enter(), { type: "dismissPrompt", capacity: 2 });
    state = reduce(state, { type: "exit" });
    expect(isMulti(state)).toBe(false);
    expect(state.workspaces).toEqual([]);
    expect(state.promptDismissedCapacity).toBe(2);
  });

  it("does not add cards in single mode (the host enters instead)", () => {
    const state = createInitialState();
    expect(add(state, "/parts")).toBe(state);
  });
});

describe("layout", () => {
  it("shows every card when they fit", () => {
    const layout = computeLayout(enter(), 2 * MIN_PANE_WIDTH + 12);
    expect(layout.visibleIds).toEqual(["a", "b"]);
    expect(layout.tabIds).toEqual([]);
  });

  it("collapses the overflow into tabs instead of dropping cards", () => {
    const state = add(enter(), "/parts", "c");
    const layout = computeLayout(state, 1200); // fits one card
    expect(layout.slots).toBe(1);
    expect(layout.tabIds).toEqual(["a", "b", "c"]);
    expect(layout.visibleIds).toHaveLength(1);
    const twoUp = computeLayout(state, 1400); // fits two
    expect(twoUp.visibleIds[0]).toBe("a");
    expect(twoUp.tabIds).toEqual(["b", "c"]);
  });

  it("shows the chosen tab in the tabbed slot", () => {
    let state = add(enter(), "/parts", "c");
    state = reduce(state, { type: "showTab", id: "b" });
    expect(computeLayout(state, 1400).visibleIds).toEqual(["a", "b"]);
  });
});

describe("reducer", () => {
  it("adds at most MAX_WORKSPACES and focuses the new one", () => {
    let state = enter();
    for (let i = 0; i < 5; i += 1) state = add(state, `/page-${i}`);
    expect(state.workspaces).toHaveLength(MAX_WORKSPACES);
    expect(state.focusedId).toBe(state.workspaces[state.workspaces.length - 1].id);
  });

  it("can add beside the user without taking focus", () => {
    const state = reduce(enter(), { type: "add", href: "/parts", id: "c", focus: false });
    expect(state.focusedId).toBe("b");
    expect(state.tabbedId).toBe("c");
  });

  it("returns focus to the previously focused card on close", () => {
    let state = add(enter(), "/parts", "c");
    state = reduce(state, { type: "focus", id: "a" });
    state = reduce(state, { type: "close", id: "a" });
    expect(state.focusedId).toBe("c");
    expect(state.weights.a).toBeUndefined();
  });

  it("falls back to single mode if the last card closes", () => {
    let state = reduce(enter(), { type: "close", id: "a" });
    state = reduce(state, { type: "close", id: "b" });
    expect(isMulti(state)).toBe(false);
  });

  it("swaps order without touching hrefs", () => {
    const state = reduce(enter(), { type: "swapOrder", a: "a", b: "b" });
    expect(state.workspaces.map((w) => w.id)).toEqual(["b", "a"]);
    expect(state.workspaces.find((w) => w.id === "a").href).toBe("/messages");
  });

  it("records route changes and is a no-op for the same href", () => {
    const state = enter();
    const same = reduce(state, { type: "route", id: "a", href: "/messages" });
    expect(same).toBe(state);
    const moved = reduce(state, { type: "route", id: "b", href: "/job-cards/1" });
    expect(moved.workspaces[1].href).toBe("/job-cards/1");
    expect(focusedHref(moved)).toBe("/job-cards/1");
  });

  it("tracks the host route it is in step with", () => {
    const state = enter();
    const synced = reduce(state, { type: "syncHost", href: "/parts" });
    expect(synced.hostHref).toBe("/parts");
    expect(reduce(synced, { type: "syncHost", href: "/parts" })).toBe(synced);
  });

  it("picks the most recently focused other card for links", () => {
    let state = add(enter(), "/parts", "c");
    state = reduce(state, { type: "focus", id: "a" });
    expect(pickOtherWorkspace(state, "a")).toBe("c");
    expect(pickOtherWorkspace(state, "c")).toBe("a");
    expect(pickOtherWorkspace(createInitialState(), "a")).toBeNull();
  });

  it("finds the card already showing a page", () => {
    const state = enter(["/messages?thread=4", "/parts"]);
    expect(findWorkspaceShowing(state, "/parts")).toBe("b");
    expect(findWorkspaceShowing(state, "/messages")).toBe("a");
    expect(findWorkspaceShowing(state, "/newsfeed")).toBeNull();
  });
});

describe("sizing", () => {
  it("clamps a drag so neither card drops under the minimum", () => {
    const state = enter();
    const next = resizePair(state, "a", "b", 0.05, 2000);
    const left = weightOf(next, "a");
    const right = weightOf(next, "b");
    expect((left / (left + right)) * 2000).toBeCloseTo(MIN_PANE_WIDTH, 5);
    // Pair total preserved.
    expect(left + right).toBeCloseTo(weightOf(state, "a") + weightOf(state, "b"), 5);
  });

  it("applies and recognises presets", () => {
    let state = enter();
    expect(activePresetId(state, ["a", "b"])).toBe("50-50");
    state = applyPreset(state, ["a", "b"], 0.7);
    expect(activePresetId(state, ["a", "b"])).toBe("70-30");
    state = add(state, "/parts", "c");
    state = applyPreset(state, ["a", "b", "c"], 0.6);
    expect(weightOf(state, "b")).toBeCloseTo(0.2, 5);
    expect(activePresetId(state, ["a", "b", "c"])).toBe("60-40");
  });
});

describe("hrefs", () => {
  it("accepts same-origin staff pages", () => {
    expect(toWorkspaceHref("/job-cards/123?tab=vhc", ORIGIN)).toBe("/job-cards/123?tab=vhc");
    expect(toWorkspaceHref(`${ORIGIN}/messages`, ORIGIN)).toBe("/messages");
  });

  it("rejects external, non-page and non-staff links", () => {
    ["https://other.example/x", "/multi-view/messages-empty", "/api/jobs", "/login", "/website/about", "/customer/portal", "#top", "mailto:a@b", "/"].forEach(
      (href) => expect(toWorkspaceHref(href, ORIGIN)).toBeNull()
    );
    // /customers (plural) is a staff page and must NOT be caught by /customer.
    expect(toWorkspaceHref("/customers/abc", ORIGIN)).toBe("/customers/abc");
    expect(toWorkspaceHref("/vhc/share/1", ORIGIN, (p) => p.startsWith("/vhc/share"))).toBeNull();
  });

  it("labels hrefs from navigation items first", () => {
    const nav = [{ label: "Job Cards", href: "/job-cards" }];
    expect(labelForHref("/job-cards/12345", nav)).toBe("Job Cards · 12345");
    expect(labelForHref("/parking-tracker")).toBe("Parking Tracker");
    expect(labelForHref(null)).toBe("New workspace");
  });
});

describe("persistence", () => {
  it("round-trips mode, cards, order, weights, focus and host route", () => {
    let state = add(enter(["/messages", null], { hostHref: "/messages" }), "/parts", "c");
    state = reduce(state, { type: "swapOrder", a: "a", b: "c" });
    state = applyPreset(state, ["c", "b", "a"], 0.5);
    state = reduce(state, { type: "focus", id: "a" });
    const restored = deserializeState(JSON.parse(JSON.stringify(serializeState(state))));
    expect(isMulti(restored)).toBe(true);
    expect(restored.workspaces.map((w) => w.id)).toEqual(["c", "b", "a"]);
    expect(restored.workspaces.find((w) => w.id === "b").href).toBeNull();
    expect(weightOf(restored, "c")).toBeCloseTo(0.5, 5);
    expect(restored.focusedId).toBe("a");
    expect(restored.hostHref).toBe("/messages");
  });

  it("stores nothing but the prompt dismissal in single mode", () => {
    const state = reduce(createInitialState(), { type: "dismissPrompt", capacity: 3 });
    const saved = serializeState(state);
    expect(saved.mode).toBe("single");
    expect(saved.workspaces).toEqual([]);
    expect(deserializeState(saved).promptDismissedCapacity).toBe(3);
  });

  it("turns pages that can no longer be shown into start panels", () => {
    const state = enter(["/messages", "/api/secret"]);
    const restored = deserializeState(serializeState(state), { isValidHref: (h) => !h.startsWith("/api") });
    expect(restored.workspaces.map((w) => w.href)).toEqual(["/messages", null]);
  });

  it("falls back to single mode on junk, too few cards or an old version", () => {
    expect(isMulti(deserializeState("nonsense"))).toBe(false);
    expect(isMulti(deserializeState({ version: STORAGE_VERSION, mode: "multi", workspaces: [{ id: "a" }] }))).toBe(false);
    // v1 (host-rendered primary + extras) is discarded, dismissal carried over.
    const v1 = deserializeState({ version: 1, workspaces: [{ id: "x", href: "/parts" }], promptDismissedCapacity: 2 });
    expect(isMulti(v1)).toBe(false);
    expect(v1.promptDismissedCapacity).toBe(2);
  });

  it("drops duplicate ids and repairs a missing focus", () => {
    const restored = deserializeState({
      version: STORAGE_VERSION,
      mode: "multi",
      workspaces: [{ id: "a", href: "/x" }, { id: "a", href: "/y" }, { id: "b", href: "/z" }],
      focusedId: "gone",
    });
    expect(restored.workspaces.map((w) => w.id)).toEqual(["a", "b"]);
    expect(restored.focusedId).toBe("a");
    expect(restored.focusHistory).toEqual(["a", "b"]);
  });
});

describe("per-card width", () => {
  it("offers equal / wider / widest for two and three cards, nothing for one", async () => {
    const { cardWidthChoices } = await import("./workspaceModel");
    expect(cardWidthChoices(1)).toEqual([]);
    expect(cardWidthChoices(2).map((c) => c.share)).toEqual([0.5, 0.6, 0.7]);
    expect(cardWidthChoices(3)[0].share).toBeCloseTo(1 / 3);
  });

  it("gives the chosen card its share and splits the rest evenly", async () => {
    const { applyCardWidth, weightOf } = await import("./workspaceModel");
    const state = { weights: {} };
    const next = applyCardWidth(state, ["a", "b", "c"], "b", 0.5);
    expect(weightOf(next, "b")).toBeCloseTo(0.5);
    expect(weightOf(next, "a")).toBeCloseTo(0.25);
    expect(weightOf(next, "c")).toBeCloseTo(0.25);
    expect(applyCardWidth(state, ["a", "b"], "z", 0.7)).toBe(state);
  });

  it("caps a card's share so the others keep the minimum card width", async () => {
    const { maxCardShare } = await import("./workspaceModel");
    const width = 2 * MIN_PANE_WIDTH + 12 + 200;
    const max = maxCardShare(2, width);
    expect(max).toBeGreaterThan(0.5);
    expect((1 - max) * (width - 12)).toBeCloseTo(MIN_PANE_WIDTH);
  });
});

describe("multi-view URL", () => {
  const known = ["/messages", "/job-cards", "/hr/employees", "/key-parking"];

  it("names every card, in on-screen order", () => {
    expect(multiViewHref([{ href: "/messages" }, { href: null }])).toBe("/multi-view/messages-empty");
    expect(multiViewHref([{ href: "/job-cards/123?tab=vhc" }, { href: "/hr/employees" }])).toBe(
      "/multi-view/job-cards.123-hr.employees"
    );
  });

  it("round-trips through the known page paths, hyphenated names included", () => {
    const hrefs = ["/key-parking", "/job-cards/123", null];
    const url = multiViewHref(hrefs.map((href) => ({ href })));
    expect(parseMultiViewPath(url, known)).toEqual(hrefs);
  });

  it("reads unknown pages up to the next separator and caps the card count", () => {
    expect(parseMultiViewPath("/multi-view/foo-bar-baz-qux", [])).toEqual(["/foo", "/bar", "/baz"]);
    expect(parseMultiViewPath("/multi-view", known)).toEqual([]);
    expect(parseMultiViewPath("/messages", known)).toEqual([]);
  });

  it("recognises multi-view paths only", () => {
    expect(isMultiViewPath("/multi-view/messages-empty")).toBe(true);
    expect(isMultiViewPath("/multi-viewer")).toBe(false);
  });
});
