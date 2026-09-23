// file location: src/features/workspaces/workspaceModel.test.js
import { describe, it, expect } from "vitest";
import {
  PRIMARY_WORKSPACE_ID,
  MAX_WORKSPACES,
  MIN_PANE_WIDTH,
  createInitialState,
  workspaceReducer,
  fitCapacity,
  suggestCapacity,
  shouldOfferWorkspace,
  computeLayout,
  toWorkspaceHref,
  labelForHref,
  resizePair,
  applyPreset,
  activePresetId,
  pickOtherWorkspace,
  serializeState,
  deserializeState,
  weightOf,
} from "./workspaceModel";

const ORIGIN = "https://dms.example";
const add = (state, href, id) => workspaceReducer(state, { type: "add", href, id });

describe("capacity", () => {
  it("never offers a workspace on an ordinary 1920px screen", () => {
    // 1920 window − 260 sidebar − chrome padding/gap ≈ 1612px of area.
    expect(suggestCapacity(1612)).toBe(1);
    expect(shouldOfferWorkspace(createInitialState(), 1612)).toBe(false);
  });

  it("offers a second workspace on a QHD window and a third on a 4K/dual window", () => {
    expect(suggestCapacity(2250)).toBe(2);
    expect(suggestCapacity(3520)).toBe(3);
    expect(shouldOfferWorkspace(createInitialState(), 2250)).toBe(true);
  });

  it("caps at MAX_WORKSPACES", () => {
    expect(fitCapacity(20000)).toBe(MAX_WORKSPACES);
  });

  it("stops offering once the user dismissed that capacity", () => {
    const state = workspaceReducer(createInitialState(), { type: "dismissPrompt", capacity: 2 });
    expect(shouldOfferWorkspace(state, 2250)).toBe(false);
    // …but asks again if even more room appears.
    expect(shouldOfferWorkspace(state, 3520)).toBe(true);
  });
});

describe("layout", () => {
  it("shows every workspace when they fit", () => {
    const state = add(createInitialState(), "/messages", "a");
    const layout = computeLayout(state, 2 * MIN_PANE_WIDTH + 12);
    expect(layout.visibleIds).toEqual([PRIMARY_WORKSPACE_ID, "a"]);
    expect(layout.tabIds).toEqual([]);
  });

  it("collapses the overflow into tabs instead of dropping workspaces", () => {
    let state = add(createInitialState(), "/messages", "a");
    state = add(state, "/parts", "b");
    const layout = computeLayout(state, 1200); // fits one pane
    expect(layout.slots).toBe(1);
    expect(layout.tabIds).toEqual([PRIMARY_WORKSPACE_ID, "a", "b"]);
    expect(layout.visibleIds).toHaveLength(1);
    const twoUp = computeLayout(state, 1400); // fits two
    expect(twoUp.visibleIds[0]).toBe(PRIMARY_WORKSPACE_ID);
    expect(twoUp.tabIds).toEqual(["a", "b"]);
  });

  it("shows the chosen tab in the tabbed slot", () => {
    let state = add(createInitialState(), "/messages", "a");
    state = add(state, "/parts", "b");
    state = workspaceReducer(state, { type: "showTab", id: "a" });
    expect(computeLayout(state, 1400).visibleIds).toEqual([PRIMARY_WORKSPACE_ID, "a"]);
  });
});

describe("reducer", () => {
  it("adds at most MAX_WORKSPACES and focuses the new one", () => {
    let state = createInitialState();
    for (let i = 0; i < 5; i += 1) state = add(state, `/page-${i}`);
    expect(state.workspaces).toHaveLength(MAX_WORKSPACES);
    expect(state.focusedId).toBe(state.workspaces[state.workspaces.length - 1].id);
  });

  it("never closes the primary workspace", () => {
    const state = workspaceReducer(createInitialState(), { type: "close", id: PRIMARY_WORKSPACE_ID });
    expect(state.workspaces).toHaveLength(1);
  });

  it("returns focus to the previously focused workspace on close", () => {
    let state = add(createInitialState(), "/messages", "a");
    state = add(state, "/parts", "b");
    state = workspaceReducer(state, { type: "focus", id: "a" });
    state = workspaceReducer(state, { type: "close", id: "a" });
    expect(state.focusedId).toBe("b");
    expect(state.weights.a).toBeUndefined();
  });

  it("swaps order without touching hrefs", () => {
    let state = add(createInitialState(), "/messages", "a");
    state = add(state, "/parts", "b");
    state = workspaceReducer(state, { type: "swapOrder", a: "a", b: "b" });
    expect(state.workspaces.map((w) => w.id)).toEqual([PRIMARY_WORKSPACE_ID, "b", "a"]);
    expect(state.workspaces.find((w) => w.id === "a").href).toBe("/messages");
  });

  it("records route changes and is a no-op for the same href", () => {
    const state = add(createInitialState(), "/messages", "a");
    const same = workspaceReducer(state, { type: "route", id: "a", href: "/messages" });
    expect(same).toBe(state);
    const moved = workspaceReducer(state, { type: "route", id: "a", href: "/job-cards/1" });
    expect(moved.workspaces[1].href).toBe("/job-cards/1");
  });

  it("picks the most recently focused other workspace for links", () => {
    let state = add(createInitialState(), "/messages", "a");
    state = add(state, "/parts", "b");
    state = workspaceReducer(state, { type: "focus", id: PRIMARY_WORKSPACE_ID });
    expect(pickOtherWorkspace(state, PRIMARY_WORKSPACE_ID)).toBe("b");
    expect(pickOtherWorkspace(state, "b")).toBe(PRIMARY_WORKSPACE_ID);
    expect(pickOtherWorkspace(createInitialState(), PRIMARY_WORKSPACE_ID)).toBeNull();
  });
});

describe("sizing", () => {
  it("clamps a drag so neither pane drops under the minimum", () => {
    const state = add(createInitialState(), "/messages", "a");
    const next = resizePair(state, PRIMARY_WORKSPACE_ID, "a", 0.05, 2000);
    const left = weightOf(next, PRIMARY_WORKSPACE_ID);
    const right = weightOf(next, "a");
    expect((left / (left + right)) * 2000).toBeCloseTo(MIN_PANE_WIDTH, 5);
    // Pair total preserved.
    expect(left + right).toBeCloseTo(weightOf(state, PRIMARY_WORKSPACE_ID) + weightOf(state, "a"), 5);
  });

  it("applies and recognises presets", () => {
    let state = add(createInitialState(), "/messages", "a");
    const ids = [PRIMARY_WORKSPACE_ID, "a"];
    expect(activePresetId(state, ids)).toBe("50-50");
    state = applyPreset(state, ids, 0.7);
    expect(activePresetId(state, ids)).toBe("70-30");
    state = add(state, "/parts", "b");
    state = applyPreset(state, [PRIMARY_WORKSPACE_ID, "a", "b"], 0.6);
    expect(weightOf(state, "a")).toBeCloseTo(0.2, 5);
    expect(activePresetId(state, [PRIMARY_WORKSPACE_ID, "a", "b"])).toBe("60-40");
  });
});

describe("hrefs", () => {
  it("accepts same-origin staff pages", () => {
    expect(toWorkspaceHref("/job-cards/123?tab=vhc", ORIGIN)).toBe("/job-cards/123?tab=vhc");
    expect(toWorkspaceHref(`${ORIGIN}/messages`, ORIGIN)).toBe("/messages");
  });

  it("rejects external, non-page and non-staff links", () => {
    ["https://other.example/x", "/api/jobs", "/login", "/website/about", "/customer/portal", "#top", "mailto:a@b", "/"].forEach(
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
  it("round-trips extra workspaces, order and weights but not the primary page", () => {
    let state = add(createInitialState(), "/messages", "a");
    state = add(state, "/parts", "b");
    state = workspaceReducer(state, { type: "swapOrder", a: PRIMARY_WORKSPACE_ID, b: "b" });
    state = applyPreset(state, ["b", "a", PRIMARY_WORKSPACE_ID], 0.5);
    const restored = deserializeState(JSON.parse(JSON.stringify(serializeState(state))));
    expect(restored.workspaces.map((w) => w.id)).toEqual(["b", "a", PRIMARY_WORKSPACE_ID]);
    expect(restored.workspaces.find((w) => w.primary).href).toBeNull();
    expect(weightOf(restored, "b")).toBeCloseTo(0.5, 5);
  });

  it("keeps the primary's current page when restoring saved state", () => {
    const live = workspaceReducer(createInitialState(), { type: "route", id: PRIMARY_WORKSPACE_ID, href: "/newsfeed" });
    const saved = deserializeState(serializeState(add(createInitialState(), "/messages", "a")));
    const restored = workspaceReducer(live, { type: "restore", state: saved });
    expect(restored.workspaces.find((w) => w.primary).href).toBe("/newsfeed");
    expect(restored.workspaces).toHaveLength(2);
  });

  it("drops empty or invalid workspaces and tolerates junk", () => {
    let state = add(createInitialState(), null, "empty");
    state = add(state, "/api/secret", "bad");
    const restored = deserializeState(serializeState(state), { isValidHref: (h) => !h.startsWith("/api") });
    expect(restored.workspaces.map((w) => w.id)).toEqual([PRIMARY_WORKSPACE_ID]);
    expect(deserializeState("nonsense").workspaces).toHaveLength(1);
    expect(deserializeState({ version: 99 }).workspaces).toHaveLength(1);
  });
});
