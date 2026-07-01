// file location: src/lib/support/savedViewValidation.test.js
import { describe, expect, it } from "vitest";
import {
  validateSavedViewInput,
  normaliseFilters,
  normaliseScope,
  normaliseSurface,
  normalisePreferences,
  PREFERENCE_DEFAULTS,
} from "@/lib/support/savedViewValidation";

describe("normaliseFilters", () => {
  it("keeps only known keys and drops unknown / empty ones", () => {
    const out = normaliseFilters({ status: "new", evil: "drop", q: "  ", severity: "high" });
    expect(out).toEqual({ status: "new", severity: "high" });
  });

  it("coerces boolean flags and ignores non-true values", () => {
    expect(normaliseFilters({ openOnly: "true", unassigned: false, regressionsOnly: 1 })).toEqual({
      openOnly: true,
      regressionsOnly: true,
    });
  });

  it("clamps long filter strings", () => {
    const out = normaliseFilters({ q: "x".repeat(500) });
    expect(out.q.length).toBeLessThanOrEqual(120);
  });
});

describe("normaliseScope / normaliseSurface", () => {
  it("falls back to safe defaults for unknown values", () => {
    expect(normaliseScope("shared")).toBe("shared");
    expect(normaliseScope("world")).toBe("personal");
    expect(normaliseSurface("support")).toBe("support");
    expect(normaliseSurface("hacker")).toBe("support");
  });
});

describe("validateSavedViewInput", () => {
  it("requires a name by default", () => {
    expect(validateSavedViewInput({ name: "  " }).ok).toBe(false);
  });

  it("normalises a full payload", () => {
    const res = validateSavedViewInput({
      name: "n".repeat(200),
      scope: "shared",
      surface: "support",
      filters: { status: "new", junk: 1 },
    });
    expect(res.ok).toBe(true);
    expect(res.value.name.length).toBeLessThanOrEqual(60);
    expect(res.value.scope).toBe("shared");
    expect(res.value.filters).toEqual({ status: "new" });
  });

  it("allows an empty name when requireName is false (patch)", () => {
    expect(validateSavedViewInput({ scope: "personal" }, { requireName: false }).ok).toBe(true);
  });
});

describe("normalisePreferences", () => {
  it("returns defaults for an empty object", () => {
    expect(normalisePreferences({})).toEqual(PREFERENCE_DEFAULTS);
  });

  it("clamps the poll interval and coerces booleans", () => {
    const out = normalisePreferences({ liveOpsPollSeconds: 999, notifyOnCritical: 0 });
    expect(out.liveOpsPollSeconds).toBe(60);
    expect(out.notifyOnCritical).toBe(false);
  });

  it("rejects an unknown density and drops unknown keys", () => {
    const out = normalisePreferences({ density: "spacious", hacker: "yes" });
    expect(out.density).toBe("comfortable");
    expect(out.hacker).toBeUndefined();
  });
});
