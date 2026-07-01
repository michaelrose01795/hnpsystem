// file location: src/lib/dev-platform/knowledgeCentre.test.js
import { describe, expect, it } from "vitest";
import {
  clusterByFingerprint,
  buildKnowledgeCentre,
  matchEntryForReport,
} from "@/lib/dev-platform/knowledgeCentre";

const NOW = "2026-07-01T12:00:00.000Z";

// Light-row shape: { id, fingerprint, route, status, created_at }
const reports = [
  // Cluster FP-A — 3 reports, routes /a + /b, 2 still open.
  { id: "a1", fingerprint: "FP-A", route: "/a", status: "new", created_at: "2026-06-20T00:00:00.000Z" },
  { id: "a2", fingerprint: "FP-A", route: "/b", status: "resolved", created_at: "2026-06-10T00:00:00.000Z" },
  { id: "a3", fingerprint: "FP-A", route: "/a", status: "in_progress", created_at: "2026-06-25T00:00:00.000Z" },
  // Cluster FP-B — 2 reports, single route /c, all closed.
  { id: "b1", fingerprint: "FP-B", route: "/c", status: "resolved", created_at: "2026-06-05T00:00:00.000Z" },
  { id: "b2", fingerprint: "FP-B", route: "/c", status: "wont_fix", created_at: "2026-06-06T00:00:00.000Z" },
  // FP-C — single occurrence, below minOccurrences → excluded.
  { id: "c1", fingerprint: "FP-C", route: "/d", status: "new", created_at: "2026-06-01T00:00:00.000Z" },
  // No fingerprint → skipped entirely.
  { id: "z1", fingerprint: null, route: "/e", status: "new", created_at: "2026-06-02T00:00:00.000Z" },
];

// Curated entry shape: { id, fingerprint, title, status, updated_at }
const entries = [
  { id: "e1", fingerprint: "FP-A", title: "VHC panel crash", status: "published", updated_at: "2026-06-28T00:00:00.000Z" },
  { id: "e2", fingerprint: "FP-Z", title: "Unrelated write-up", status: "draft", updated_at: "2026-06-29T00:00:00.000Z" },
];

describe("clusterByFingerprint", () => {
  it("keeps only clusters with >= minOccurrences and sorts by occurrences desc", () => {
    const clusters = clusterByFingerprint(reports, { minOccurrences: 2 });
    expect(clusters.map((c) => c.fingerprint)).toEqual(["FP-A", "FP-B"]); // FP-C (1) and null dropped
    expect(clusters[0].occurrences).toBe(3);
    expect(clusters[1].occurrences).toBe(2);
  });

  it("computes occurrences / routes / open per cluster", () => {
    const [a] = clusterByFingerprint(reports, { minOccurrences: 2 });
    expect(a.occurrences).toBe(3);
    expect(a.reportIds.sort()).toEqual(["a1", "a2", "a3"]);
    expect(a.routes.sort()).toEqual(["/a", "/b"]); // deduped
    expect(a.open).toBe(2); // a1 (new) + a3 (in_progress); a2 resolved
  });

  it("tracks firstSeen (earliest) and lastSeen (latest) created_at", () => {
    const [a] = clusterByFingerprint(reports, { minOccurrences: 2 });
    expect(a.firstSeen).toBe("2026-06-10T00:00:00.000Z"); // a2
    expect(a.lastSeen).toBe("2026-06-25T00:00:00.000Z"); // a3
  });

  it("marks a fully-closed cluster with open: 0", () => {
    const clusters = clusterByFingerprint(reports, { minOccurrences: 2 });
    const b = clusters.find((c) => c.fingerprint === "FP-B");
    expect(b.open).toBe(0);
  });

  it("honours a higher minOccurrences threshold", () => {
    const clusters = clusterByFingerprint(reports, { minOccurrences: 3 });
    expect(clusters.map((c) => c.fingerprint)).toEqual(["FP-A"]); // only the 3-report cluster
  });

  it("is safe on empty / missing input", () => {
    expect(clusterByFingerprint()).toEqual([]);
    expect(clusterByFingerprint([])).toEqual([]);
  });
});

describe("buildKnowledgeCentre", () => {
  const out = buildKnowledgeCentre(reports, entries, { now: NOW, minOccurrences: 2 });

  it("marks a recurring incident as documented when a curated entry shares its fingerprint", () => {
    const a = out.recurringIncidents.find((c) => c.fingerprint === "FP-A");
    expect(a.documented).toBe(true);
    expect(a.entryId).toBe("e1");
    expect(a.entryTitle).toBe("VHC panel crash");
  });

  it("leaves an undocumented recurring incident undocumented", () => {
    const b = out.recurringIncidents.find((c) => c.fingerprint === "FP-B");
    expect(b.documented).toBe(false);
    expect(b.entryId).toBeNull();
    expect(b.entryTitle).toBeNull();
  });

  it("produces suggestions only for undocumented recurring clusters", () => {
    expect(out.suggestions).toHaveLength(1);
    const [s] = out.suggestions;
    expect(s.fingerprint).toBe("FP-B");
    expect(s.occurrences).toBe(2);
    expect(s.suggestedTitle).toBe("Recurring incident on /c");
    expect(typeof s.reason).toBe("string");
  });

  it("computes stats correctly", () => {
    expect(out.stats).toEqual({
      totalEntries: 2,
      publishedEntries: 1, // only e1 is published (e2 is draft)
      recurringCount: 2, // FP-A + FP-B
      undocumentedRecurring: 1, // FP-B
    });
  });

  it("returns entries sorted by updated_at descending", () => {
    expect(out.entries.map((e) => e.id)).toEqual(["e2", "e1"]); // 06-29 before 06-28
  });

  it("does not mutate the caller's entries array while sorting", () => {
    const input = [
      { id: "m1", fingerprint: "FP-A", title: "old", status: "published", updated_at: "2026-01-01T00:00:00.000Z" },
      { id: "m2", fingerprint: "FP-B", title: "new", status: "published", updated_at: "2026-12-01T00:00:00.000Z" },
    ];
    const before = input.map((e) => e.id);
    buildKnowledgeCentre([], input, { now: NOW });
    expect(input.map((e) => e.id)).toEqual(before); // input order preserved
  });

  it("is safe with no reports or entries", () => {
    const empty = buildKnowledgeCentre([], [], { now: NOW });
    expect(empty.recurringIncidents).toEqual([]);
    expect(empty.suggestions).toEqual([]);
    expect(empty.entries).toEqual([]);
    expect(empty.stats).toEqual({
      totalEntries: 0,
      publishedEntries: 0,
      recurringCount: 0,
      undocumentedRecurring: 0,
    });
  });
});

describe("matchEntryForReport", () => {
  it("matches by report.diagnostics.fingerprint first", () => {
    const report = { id: "x", diagnostics: { fingerprint: "FP-A" }, fingerprint: "FP-B" };
    expect(matchEntryForReport(report, entries)?.id).toBe("e1"); // FP-A wins over FP-B
  });

  it("falls back to report.fingerprint when diagnostics has none", () => {
    const report = { id: "x", fingerprint: "FP-A" };
    expect(matchEntryForReport(report, entries)?.id).toBe("e1");
  });

  it("returns null when no entry documents the fingerprint", () => {
    expect(matchEntryForReport({ fingerprint: "FP-NONE" }, entries)).toBeNull();
  });

  it("returns null when the report has no fingerprint at all", () => {
    expect(matchEntryForReport({ id: "x" }, entries)).toBeNull();
    expect(matchEntryForReport(null, entries)).toBeNull();
  });

  it("is safe with no entries argument", () => {
    expect(matchEntryForReport({ fingerprint: "FP-A" })).toBeNull();
  });
});
