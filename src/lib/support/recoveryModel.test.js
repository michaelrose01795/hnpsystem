// file location: src/lib/support/recoveryModel.test.js
import { describe, expect, it } from "vitest";
import {
  RECOVERY_LEVELS,
  RECOVERY_VARIANTS,
  RECOVERY_ACTIONS,
  CRASH_LOOP_WINDOW_MS,
  CRASH_LOOP_THRESHOLD,
  classifyError,
  nextCrashState,
  isCrashLoop,
  resolveHomeHref,
  resolveRecovery,
} from "@/lib/support/recoveryModel";

const idsOf = (plan) => plan.actions.map((a) => a.id);

describe("classifyError", () => {
  it("flags stale dynamic-import chunk errors as retry-useless / reload-suggested", () => {
    const chunk = classifyError(Object.assign(new Error("Loading chunk 42 failed"), { name: "ChunkLoadError" }));
    expect(chunk.kind).toBe("chunk");
    expect(chunk.retryUseless).toBe(true);
    expect(chunk.suggestReload).toBe(true);
    expect(classifyError(new Error("error loading dynamically imported module")).kind).toBe("chunk");
  });

  it("treats fetch/offline throws as network and keeps retry useful", () => {
    const net = classifyError(new TypeError("Failed to fetch"));
    expect(net.kind).toBe("network");
    expect(net.retryUseless).toBe(false);
  });

  it("defaults unknown throws to a recoverable render error", () => {
    const render = classifyError(new Error("Cannot read properties of undefined"));
    expect(render.kind).toBe("render");
    expect(render.recoverable).toBe(true);
    expect(render.retryUseless).toBe(false);
  });

  it("never throws on odd values", () => {
    expect(classifyError(null).kind).toBe("render");
    expect(classifyError("boom").kind).toBe("render");
    expect(classifyError({}).kind).toBe("render");
  });
});

describe("nextCrashState / isCrashLoop", () => {
  it("accumulates crashes inside the window and detects a loop at threshold", () => {
    let state;
    for (let i = 0; i < CRASH_LOOP_THRESHOLD; i += 1) {
      state = nextCrashState(state, { now: 1000 + i * 100 });
    }
    expect(state.count).toBe(CRASH_LOOP_THRESHOLD);
    expect(isCrashLoop(state)).toBe(true);
  });

  it("prunes crashes older than the window so a lull resets the loop", () => {
    const first = nextCrashState(undefined, { now: 0 });
    const later = nextCrashState(first, { now: CRASH_LOOP_WINDOW_MS + 1 });
    // The stale first timestamp is dropped — only the recent crash survives.
    expect(later.count).toBe(1);
    expect(isCrashLoop(later)).toBe(false);
  });

  it("does not loop below threshold", () => {
    const state = nextCrashState(nextCrashState(undefined, { now: 10 }), { now: 20 });
    expect(state.count).toBe(2);
    expect(isCrashLoop(state)).toBe(false);
  });
});

describe("resolveHomeHref", () => {
  it("routes staff home to the dashboard and customers to the landing page", () => {
    expect(resolveHomeHref(RECOVERY_VARIANTS.STAFF)).toBe("/newsfeed");
    expect(resolveHomeHref(RECOVERY_VARIANTS.CUSTOMER)).toBe("/");
  });
  it("honours an explicit override", () => {
    expect(resolveHomeHref(RECOVERY_VARIANTS.CUSTOMER, "/website")).toBe("/website");
  });
});

describe("resolveRecovery — action sets per level", () => {
  it("APP: retry, reload, home, report — retry primary", () => {
    const plan = resolveRecovery({ level: RECOVERY_LEVELS.APP, error: new Error("x") });
    expect(idsOf(plan)).toEqual([
      RECOVERY_ACTIONS.RETRY,
      RECOVERY_ACTIONS.RELOAD,
      RECOVERY_ACTIONS.HOME,
      RECOVERY_ACTIONS.REPORT,
    ]);
    expect(plan.primaryActionId).toBe(RECOVERY_ACTIONS.RETRY);
  });

  it("ROUTE: retry, reload, back, home, report", () => {
    const plan = resolveRecovery({ level: RECOVERY_LEVELS.ROUTE, error: new Error("x") });
    expect(idsOf(plan)).toEqual([
      RECOVERY_ACTIONS.RETRY,
      RECOVERY_ACTIONS.RELOAD,
      RECOVERY_ACTIONS.BACK,
      RECOVERY_ACTIONS.HOME,
      RECOVERY_ACTIONS.REPORT,
    ]);
  });

  it("SECTION stays local: just retry + report when healthy", () => {
    const plan = resolveRecovery({ level: RECOVERY_LEVELS.SECTION, error: new Error("x"), sectionLabel: "Parts" });
    expect(idsOf(plan)).toEqual([RECOVERY_ACTIONS.RETRY, RECOVERY_ACTIONS.REPORT]);
    expect(plan.headline).toContain("Parts");
  });
});

describe("resolveRecovery — unrecoverable / loop handling", () => {
  it("drops retry and makes reload primary in a crash loop", () => {
    const plan = resolveRecovery({ level: RECOVERY_LEVELS.ROUTE, error: new Error("x"), loopDetected: true });
    expect(idsOf(plan)).not.toContain(RECOVERY_ACTIONS.RETRY);
    expect(plan.primaryActionId).toBe(RECOVERY_ACTIONS.RELOAD);
    expect(plan.loop).toBe(true);
  });

  it("escalates a looping SECTION to a page reload", () => {
    const plan = resolveRecovery({ level: RECOVERY_LEVELS.SECTION, error: new Error("x"), loopDetected: true });
    expect(idsOf(plan)).toEqual([RECOVERY_ACTIONS.RELOAD, RECOVERY_ACTIONS.REPORT]);
  });

  it("drops retry for a stale chunk error even without a loop", () => {
    const plan = resolveRecovery({
      level: RECOVERY_LEVELS.ROUTE,
      error: Object.assign(new Error("Loading chunk 3 failed"), { name: "ChunkLoadError" }),
    });
    expect(idsOf(plan)).not.toContain(RECOVERY_ACTIONS.RETRY);
    expect(plan.primaryActionId).toBe(RECOVERY_ACTIONS.RELOAD);
  });
});

describe("resolveRecovery — variant behaviour", () => {
  it("customer variant hides diagnostics and routes home to the landing page", () => {
    const plan = resolveRecovery({ variant: RECOVERY_VARIANTS.CUSTOMER, error: new Error("x") });
    expect(plan.allowDiagnostics).toBe(false);
    expect(plan.homeHref).toBe("/");
    expect(plan.actions.find((a) => a.id === RECOVERY_ACTIONS.HOME)?.label).toBe("Return home");
  });

  it("staff variant allows diagnostics and a dashboard home label", () => {
    const plan = resolveRecovery({ variant: RECOVERY_VARIANTS.STAFF, error: new Error("x") });
    expect(plan.allowDiagnostics).toBe(true);
    expect(plan.actions.find((a) => a.id === RECOVERY_ACTIONS.HOME)?.label).toBe("Return to dashboard");
  });

  it("exactly one primary action and report is always ghost", () => {
    const plan = resolveRecovery({ level: RECOVERY_LEVELS.ROUTE, error: new Error("x") });
    expect(plan.actions.filter((a) => a.tone === "primary")).toHaveLength(1);
    expect(plan.actions.find((a) => a.id === RECOVERY_ACTIONS.REPORT)?.tone).toBe("ghost");
  });
});
