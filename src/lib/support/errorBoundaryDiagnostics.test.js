// file location: src/lib/support/errorBoundaryDiagnostics.test.js
import { describe, expect, it } from "vitest";
import {
  BOUNDARY_EVENTS,
  errorMessage,
  topComponentFromStack,
  buildBoundaryReportPrefill,
  buildBoundaryEvent,
} from "@/lib/support/errorBoundaryDiagnostics";
import {
  createDiagnosticsStore,
  recordError,
  recordAction,
  captureDiagnostics,
} from "@/lib/support/diagnostics";

describe("errorMessage", () => {
  it("reads .message from Error instances", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });
  it("passes through strings", () => {
    expect(errorMessage("plain failure")).toBe("plain failure");
  });
  it("falls back for null/odd values", () => {
    expect(errorMessage(null)).toBe("Unknown error");
    expect(errorMessage({})).toBe("[object Object]");
  });
});

describe("topComponentFromStack", () => {
  it("extracts the first component name from a React stack", () => {
    const stack = "\n    in JobCardDetail (at [jobNumber].js:42)\n    in div";
    expect(topComponentFromStack(stack)).toBe("JobCardDetail");
  });
  it("returns null when no stack is given", () => {
    expect(topComponentFromStack(undefined)).toBeNull();
    expect(topComponentFromStack("")).toBeNull();
  });
});

describe("buildBoundaryReportPrefill", () => {
  it("uses the bug category and names the failing component", () => {
    const prefill = buildBoundaryReportPrefill({
      error: new Error("cannot read x"),
      componentStack: "\n    in WriteUpWorkspace (at x.js:1)",
    });
    expect(prefill.category).toBe("bug");
    expect(prefill.title).toContain("WriteUpWorkspace");
    expect(prefill.title).toContain("cannot read x");
    expect(prefill.description).toContain("cannot read x");
  });
  it("falls back to a generic title without a component stack", () => {
    const prefill = buildBoundaryReportPrefill({ error: "kaput" });
    expect(prefill.title).toBe("App error: kaput");
  });
  it("clamps an overlong title to 300 chars", () => {
    const prefill = buildBoundaryReportPrefill({ error: new Error("x".repeat(500)) });
    expect(prefill.title.length).toBe(300);
  });
});

describe("buildBoundaryEvent", () => {
  it("builds a clamped, typed timeline event", () => {
    const evt = buildBoundaryEvent(BOUNDARY_EVENTS.RETRY, { message: "y".repeat(200), sectionKey: "k" });
    expect(evt.type).toBe("boundary_retry");
    expect(evt.label.length).toBe(120);
    expect(evt.sectionKey).toBe("k");
  });
  it("defaults the type and omits an empty label", () => {
    const evt = buildBoundaryEvent();
    expect(evt.type).toBe("boundary_caught");
    expect(evt.label).toBeUndefined();
  });
});

// Integration: replay exactly what the boundary feeds into the shared store
// (recordError for the render error, recordAction for the recovery timeline) and
// prove it surfaces — scrubbed and without duplication — in the captured bundle.
describe("diagnostics integration", () => {
  it("captures the render error with component stack and scrubs secrets", () => {
    const store = createDiagnosticsStore();
    recordError(store, {
      message: "render failed",
      stack: "at f (sk_live_abcdef12)",
      componentStack: "\n    in WriteUpWorkspace",
      ts: 1,
    });
    const bundle = captureDiagnostics(store, { capturedAt: "t" });
    expect(bundle.unhandled_errors).toHaveLength(1);
    expect(bundle.unhandled_errors[0].message).toBe("render failed");
    expect(bundle.unhandled_errors[0].componentStack).toContain("WriteUpWorkspace");
    expect(bundle.unhandled_errors[0].stack).not.toContain("sk_live_abcdef12");
  });

  it("records recovery attempts as timeline events without duplication", () => {
    const store = createDiagnosticsStore();
    // One caught error → one error entry + one mirrored timeline event.
    recordError(store, { message: "boom", ts: 1 });
    recordAction(store, { ...buildBoundaryEvent(BOUNDARY_EVENTS.CAUGHT, { message: "boom" }), ts: 1 });
    recordAction(store, { ...buildBoundaryEvent(BOUNDARY_EVENTS.RETRY), ts: 2 });
    recordAction(store, { ...buildBoundaryEvent(BOUNDARY_EVENTS.REPORT), ts: 3 });

    const bundle = captureDiagnostics(store, { capturedAt: "t" });
    expect(bundle.unhandled_errors).toHaveLength(1); // not double-recorded
    const types = bundle.recent_actions.map((a) => a.type);
    expect(types).toEqual(["boundary_caught", "boundary_retry", "boundary_report"]);
  });
});
