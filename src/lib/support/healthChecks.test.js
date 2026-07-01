// file location: src/lib/support/healthChecks.test.js
// Phase 7 — tests for the pure support health self-test + aggregator.

import { describe, it, expect } from "vitest";
import {
  sanitiserSelfTest,
  summariseHealth,
  HEALTH_OK,
  HEALTH_WARN,
  HEALTH_FAIL,
} from "./healthChecks";

describe("sanitiserSelfTest", () => {
  it("passes with the real sanitiser (canary secrets are stripped)", () => {
    const r = sanitiserSelfTest();
    expect(r.status).toBe(HEALTH_OK);
  });
});

describe("summariseHealth", () => {
  it("is ok when every check is ok", () => {
    const r = summariseHealth({ a: { status: HEALTH_OK }, b: { status: HEALTH_OK } });
    expect(r.status).toBe(HEALTH_OK);
    expect(r.failing).toEqual([]);
  });

  it("warns when any check warns and none fail", () => {
    const r = summariseHealth({ a: { status: HEALTH_OK }, b: { status: HEALTH_WARN } });
    expect(r.status).toBe(HEALTH_WARN);
    expect(r.warning).toEqual(["b"]);
  });

  it("fails when any check fails, even alongside warnings", () => {
    const r = summariseHealth({
      a: { status: HEALTH_WARN },
      b: { status: HEALTH_FAIL },
    });
    expect(r.status).toBe(HEALTH_FAIL);
    expect(r.failing).toEqual(["b"]);
  });

  it("fails closed on an unrecognised/missing status", () => {
    const r = summariseHealth({ a: { status: "weird" }, b: {} });
    expect(r.status).toBe(HEALTH_FAIL);
    expect(r.failing).toContain("a");
    expect(r.failing).toContain("b");
  });

  it("handles an empty check set as ok", () => {
    expect(summariseHealth({}).status).toBe(HEALTH_OK);
  });
});
