import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logFailure, normaliseFailure, resetFailureLog } from "@/lib/utils/logFailure";

describe("normaliseFailure", () => {
  it("reads the message off an Error and keeps only informative extras", () => {
    const err = new TypeError("boom");
    err.code = "E_BOOM";
    expect(normaliseFailure(err)).toMatchObject({
      message: "boom",
      extras: { name: "TypeError", code: "E_BOOM" },
    });
  });

  it("unpacks a Supabase PostgrestError without repeating the message", () => {
    const result = normaliseFailure({
      message: "column does not exist",
      code: "42703",
      details: null,
      hint: "check the schema",
    });
    expect(result.message).toBe("column does not exist");
    expect(result.extras).toEqual({ code: "42703", hint: "check the schema" });
  });

  it("survives a null failure rather than printing 'null'", () => {
    expect(normaliseFailure(null).message).toBe("(no error detail)");
  });
});

describe("logFailure", () => {
  let spy;

  beforeEach(() => {
    resetFailureLog();
    vi.useFakeTimers();
    spy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    spy.mockRestore();
    vi.useRealTimers();
  });

  it("strips the emoji prefix and trailing colon from the label", () => {
    logFailure("❌ getAllJobs error:", new Error("nope"));
    expect(spy).toHaveBeenCalledWith("getAllJobs error: nope");
  });

  it("keeps a bracketed namespace on the label", () => {
    logFailure("[reporting] snapshot failed", "timeout");
    expect(spy).toHaveBeenCalledWith("[reporting] snapshot failed: timeout");
  });

  it("prints context alongside the headline", () => {
    logFailure("upload failed", new Error("413"), { jobNumber: "J1" });
    expect(spy).toHaveBeenCalledWith("upload failed: 413", { jobNumber: "J1" });
  });

  it("collapses a burst of the same failure into one line", () => {
    for (let i = 0; i < 20; i += 1) logFailure("poll failed", "offline");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("reports the suppressed count on the next line outside the window", () => {
    for (let i = 0; i < 20; i += 1) logFailure("poll failed", "offline");
    vi.advanceTimersByTime(5000);
    logFailure("poll failed", "offline");
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith("poll failed: offline (x20)");
  });

  it("does not collapse two different failures together", () => {
    logFailure("poll failed", "offline");
    logFailure("poll failed", "timeout");
    logFailure("save failed", "offline");
    expect(spy).toHaveBeenCalledTimes(3);
  });
});
