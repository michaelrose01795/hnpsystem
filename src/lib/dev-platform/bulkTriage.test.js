// file location: src/lib/dev-platform/bulkTriage.test.js
import { describe, expect, it } from "vitest";
import { validateBulkTriage, summariseBulkResult, BULK_MAX_IDS } from "@/lib/dev-platform/bulkTriage";

describe("validateBulkTriage", () => {
  it("accepts a valid status sweep and de-duplicates ids", () => {
    const out = validateBulkTriage({ ids: ["a", "a", "b"], updates: { status: "triaged" } });
    expect(out.ok).toBe(true);
    expect(out.ids).toEqual(["a", "b"]);
    expect(out.patch).toEqual({ status: "triaged" });
  });

  it("accepts assignee changes", () => {
    const out = validateBulkTriage({ ids: ["a"], updates: { assignedTo: 7 } });
    expect(out.ok).toBe(true);
    expect(out.patch).toEqual({ assigned_to: 7 });
  });

  it("rejects an empty id set", () => {
    expect(validateBulkTriage({ ids: [], updates: { status: "triaged" } }).ok).toBe(false);
  });

  it("rejects an invalid enum via the shared validator", () => {
    const out = validateBulkTriage({ ids: ["a"], updates: { status: "nope" } });
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/Invalid status/);
  });

  it("rejects an empty patch (no valid fields)", () => {
    expect(validateBulkTriage({ ids: ["a"], updates: { duplicateOf: "x" } }).ok).toBe(false);
  });

  it("rejects more than the id cap", () => {
    const ids = Array.from({ length: BULK_MAX_IDS + 1 }, (_, i) => `id-${i}`);
    expect(validateBulkTriage({ ids, updates: { status: "triaged" } }).ok).toBe(false);
  });
});

describe("summariseBulkResult", () => {
  it("counts updated vs failed and lists failed ids", () => {
    const s = summariseBulkResult([
      { id: "a", ok: true },
      { id: "b", ok: false },
      { id: "c", ok: true },
    ]);
    expect(s).toEqual({ total: 3, updated: 2, failed: 1, failedIds: ["b"] });
  });
});
