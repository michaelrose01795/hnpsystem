import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildVhcSectionDraftKey,
  clearVhcSectionDraft,
  persistVhcSectionDraft,
  readVhcSectionDraft,
} from "./useVhcSectionDraft";

const createMemoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
};

describe("VHC section draft storage", () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("isolates drafts by user, job, and section", () => {
    const wheelsKey = buildVhcSectionDraftKey({
      userId: 7,
      jobId: 42,
      jobNumber: "03969",
      sectionKey: "wheelsTyres",
    });
    const brakesKey = buildVhcSectionDraftKey({
      userId: 7,
      jobId: 42,
      jobNumber: "03969",
      sectionKey: "brakesHubs",
    });

    expect(wheelsKey).not.toBe(brakesKey);
    expect(wheelsKey).toContain("id-42");
  });

  it("persists, restores, and clears a section payload", () => {
    const key = buildVhcSectionDraftKey({
      userId: 7,
      jobNumber: "03969",
      sectionKey: "serviceIndicator",
    });
    const payload = {
      serviceChoice: "reset",
      oilStatus: "good",
      concerns: [{ text: "Oil low", status: "Amber" }],
    };

    expect(persistVhcSectionDraft(key, payload)).toBe(true);
    expect(readVhcSectionDraft(key)).toEqual(payload);
    expect(clearVhcSectionDraft(key)).toBe(true);
    expect(readVhcSectionDraft(key, "fallback")).toBe("fallback");
  });

  it("falls back safely when stored data is invalid", () => {
    const key = buildVhcSectionDraftKey({
      userId: 7,
      jobId: 42,
      sectionKey: "underside",
    });
    storage.setItem(key, "{invalid-json");

    expect(readVhcSectionDraft(key, { safe: true })).toEqual({ safe: true });
  });
});
