// file location: src/lib/support/supportDraft.test.js
import { describe, expect, it } from "vitest";
import {
  SUPPORT_DRAFT_STORAGE_KEY,
  MAX_DRAFT_SCREENSHOTS,
  normaliseDraft,
  isDraftEmpty,
  loadDraft,
  saveDraft,
  clearDraft,
} from "@/lib/support/supportDraft";

// Minimal in-memory Storage stub. `failAfter` lets a test simulate a quota error.
function makeStorage({ failOnBytes = Infinity } = {}) {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (String(v).length > failOnBytes) {
        const err = new Error("QuotaExceededError");
        err.name = "QuotaExceededError";
        throw err;
      }
      map.set(k, String(v));
    },
    removeItem: (k) => map.delete(k),
  };
}

const PNG = "data:image/png;base64,AAAA";

describe("normaliseDraft", () => {
  it("drops non-image screenshots, coerces to {src, annotation}, and caps the count", () => {
    const d = normaliseDraft({
      description: "hi",
      screenshots: [PNG, "not-an-image", { src: PNG, annotation: "the broken button" }, ...Array(20).fill(PNG)],
    });
    expect(d.screenshots.every((s) => s.src.startsWith("data:image/") && typeof s.annotation === "string")).toBe(true);
    expect(d.screenshots.length).toBe(MAX_DRAFT_SCREENSHOTS);
    expect(d.screenshots[1]).toEqual({ src: PNG, annotation: "the broken button" });
  });
  it("clamps an overlong description", () => {
    expect(normaliseDraft({ description: "x".repeat(9000) }).description.length).toBe(5000);
  });
});

describe("isDraftEmpty", () => {
  it("is true for a blank draft and false once there is content", () => {
    expect(isDraftEmpty({})).toBe(true);
    expect(isDraftEmpty({ description: "  " })).toBe(true);
    expect(isDraftEmpty({ description: "something" })).toBe(false);
    expect(isDraftEmpty({ screenshots: [{ src: PNG, annotation: "" }] })).toBe(false);
  });
});

describe("save / load / clear round-trip", () => {
  it("persists and restores a draft", () => {
    const storage = makeStorage();
    saveDraft(storage, { category: "bug", description: "broken", descriptionEdited: true, screenshots: [PNG] });
    const loaded = loadDraft(storage);
    expect(loaded).toEqual({
      category: "bug",
      description: "broken",
      descriptionEdited: true,
      screenshots: [{ src: PNG, annotation: "" }],
    });
  });

  it("returns null for missing or corrupt data", () => {
    const storage = makeStorage();
    expect(loadDraft(storage)).toBeNull();
    storage.setItem(SUPPORT_DRAFT_STORAGE_KEY, "{not json");
    expect(loadDraft(storage)).toBeNull();
  });

  it("clear removes the draft", () => {
    const storage = makeStorage();
    saveDraft(storage, { description: "x" });
    clearDraft(storage);
    expect(loadDraft(storage)).toBeNull();
  });

  it("drops screenshots rather than failing when over the storage quota", () => {
    // Force the first (with-screenshots) write to exceed quota, the slim one to fit.
    // Full payload (~112 chars incl. the PNG) is rejected; the slim, screenshot-
    // free payload (~83 chars) fits under the threshold.
    const storage = makeStorage({ failOnBytes: 100 });
    const res = saveDraft(storage, { description: "keep me", screenshots: [PNG] });
    expect(res.ok).toBe(true);
    expect(res.trimmed).toBe(true);
    const loaded = loadDraft(storage);
    expect(loaded.description).toBe("keep me");
    expect(loaded.screenshots).toEqual([]);
  });
});
