// file location: src/lib/dev-platform/ownershipGraph.test.js
import { describe, expect, it } from "vitest";
import {
  moduleOf,
  featureOf,
  ownershipRows,
  moduleImpact,
  dependencyEdges,
  affectedFeatures,
  buildOwnershipMap,
} from "@/lib/dev-platform/ownershipGraph";

const NOW = Date.parse("2026-07-01T12:00:00.000Z");
const daysAgo = (n) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

const rows = [
  { id: "a", route: "/job-cards/1", source_file: "src/components/VHC/VhcDetailsPanel.js", source_line: 9983, section_key: "vhc-panel", status: "new", severity: "high", created_at: daysAgo(0), inv_regression: true },
  { id: "b", route: "/job-cards/2", source_file: "src/components/VHC/VhcDetailsPanel.js", source_line: 4000, section_key: "vhc-tab", status: "resolved", severity: "low", created_at: daysAgo(1) },
  { id: "c", route: "/sales", source_file: "src/components/Sales/SalesBoard.js", source_line: 12, status: "new", severity: "medium", created_at: daysAgo(2) },
  { id: "d", route: null, source_file: null, status: "new", created_at: daysAgo(3) },
];

describe("moduleOf / featureOf", () => {
  it("resolves a file's owning module directory", () => {
    expect(moduleOf("src/components/VHC/VhcDetailsPanel.js")).toBe("src/components/VHC");
    expect(moduleOf("index.js")).toBe("index.js");
    expect(moduleOf("")).toBeNull();
  });
  it("labels the feature from the module path", () => {
    expect(featureOf("src/components/VHC")).toBe("VHC");
    expect(featureOf("")).toBeNull();
  });
});

describe("ownershipRows", () => {
  it("groups reports by file, ranked by open then total", () => {
    const owners = ownershipRows(rows);
    expect(owners).toHaveLength(2); // the null-file row is skipped
    const vhc = owners.find((o) => o.file.includes("VhcDetailsPanel"));
    expect(vhc.total).toBe(2);
    expect(vhc.open).toBe(1);
    expect(vhc.regressions).toBe(1);
    expect(vhc.module).toBe("src/components/VHC");
    expect(vhc.feature).toBe("VHC");
    expect(vhc.routes.sort()).toEqual(["/job-cards/1", "/job-cards/2"]);
  });

  it("keeps the freshest line for the file", () => {
    const owners = ownershipRows(rows);
    const vhc = owners.find((o) => o.file.includes("VhcDetailsPanel"));
    expect(vhc.line).toBe(9983); // row a is the most recent
  });
});

describe("moduleImpact", () => {
  it("rolls files up to their module", () => {
    const mods = moduleImpact(rows);
    const vhc = mods.find((m) => m.module === "src/components/VHC");
    expect(vhc.total).toBe(2);
    expect(vhc.fileCount).toBe(1);
  });
});

describe("dependencyEdges", () => {
  it("builds weighted route → module edges, dropping null endpoints", () => {
    const edges = dependencyEdges(rows);
    expect(edges.every((e) => e.route && e.module)).toBe(true);
    const salesEdge = edges.find((e) => e.route === "/sales");
    expect(salesEdge.module).toBe("src/components/Sales");
    expect(salesEdge.weight).toBe(1);
  });
});

describe("affectedFeatures", () => {
  it("counts distinct feature areas including unknown", () => {
    const features = affectedFeatures(rows);
    const names = features.map((f) => f.feature);
    expect(names).toContain("VHC");
    expect(names).toContain("Sales");
    expect(names).toContain("unknown"); // the null-file row
  });
});

describe("buildOwnershipMap", () => {
  it("composes the full payload", () => {
    const out = buildOwnershipMap(rows, { now: NOW });
    expect(out.fileCount).toBe(2);
    expect(Array.isArray(out.modules)).toBe(true);
    expect(Array.isArray(out.edges)).toBe(true);
    expect(Array.isArray(out.features)).toBe(true);
  });
});
