// file location: src/lib/dev-platform/pluginRegistry.test.js
import { beforeEach, describe, expect, it } from "vitest";
import {
  registerTool,
  getTools,
  clearTools,
  registerPlugin,
  getPluginInventory,
  groupPluginsByKind,
} from "@/lib/dev-platform/pluginRegistry";
import {
  registerDiagnosticProvider,
  clearDiagnosticProviders,
} from "@/lib/support/diagnosticRegistry";
import {
  registerInvestigationProvider,
  clearInvestigationProviders,
} from "@/lib/support/investigationRegistry";

// Isolate all three registries the facade reads from.
beforeEach(() => {
  clearTools();
  clearDiagnosticProviders();
  clearInvestigationProviders();
});

describe("registerTool", () => {
  it("requires a non-empty string id", () => {
    expect(() => registerTool()).toThrow(/id/);
    expect(() => registerTool({})).toThrow(/id/);
    expect(() => registerTool({ id: "" })).toThrow(/id/);
    expect(() => registerTool({ id: 42 })).toThrow(/id/);
  });

  it("stores the tool with default label/category", () => {
    registerTool({ id: "codegen" });
    expect(getTools()).toEqual([{ id: "codegen", label: "codegen", category: "tool" }]);
  });

  it("lets explicit fields override the defaults", () => {
    registerTool({ id: "codegen", label: "Code Gen", category: "build", href: "/dev/codegen" });
    const [tool] = getTools();
    expect(tool).toMatchObject({ id: "codegen", label: "Code Gen", category: "build", href: "/dev/codegen" });
  });

  it("getTools lists every registered tool", () => {
    registerTool({ id: "a" });
    registerTool({ id: "b" });
    expect(getTools().map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("replaces by id (last registration wins)", () => {
    registerTool({ id: "a", label: "first" });
    registerTool({ id: "a", label: "second" });
    expect(getTools()).toHaveLength(1);
    expect(getTools()[0].label).toBe("second");
  });

  it("returns an unregister that removes the tool", () => {
    const off = registerTool({ id: "a" });
    off();
    expect(getTools()).toHaveLength(0);
  });

  it("stale unregister does not delete a re-registered id", () => {
    const offOld = registerTool({ id: "a", label: "old" });
    registerTool({ id: "a", label: "new" }); // supersedes the first registration
    offOld(); // MUST be a no-op — it only owns the superseded registration
    expect(getTools()).toHaveLength(1);
    expect(getTools()[0].label).toBe("new");
  });
});

describe("registerPlugin", () => {
  it("throws on a non-object plugin", () => {
    expect(() => registerPlugin()).toThrow(/plugin object/);
    expect(() => registerPlugin("nope")).toThrow(/plugin object/);
  });

  it("dispatches kind 'tool' into the tool registry", () => {
    registerPlugin({ kind: "tool", id: "t1" });
    expect(getTools().map((t) => t.id)).toEqual(["t1"]);
  });

  it("dispatches kind 'diagnostic' into the diagnostic registry", () => {
    registerPlugin({ kind: "diagnostic", id: "d1", collect: () => ({ v: 1 }) });
    expect(getPluginInventory().filter((p) => p.kind === "diagnostic").map((p) => p.id)).toEqual(["d1"]);
    expect(getTools()).toHaveLength(0);
  });

  it("dispatches kind 'investigation' into the investigation registry", () => {
    registerPlugin({ kind: "investigation", id: "i1", investigate: () => ({ v: 1 }) });
    expect(getPluginInventory().filter((p) => p.kind === "investigation").map((p) => p.id)).toEqual(["i1"]);
    expect(getTools()).toHaveLength(0);
  });

  it("throws on an unknown kind", () => {
    expect(() => registerPlugin({ kind: "wat", id: "x" })).toThrow(/Unknown plugin kind/);
    expect(() => registerPlugin({ id: "x" })).toThrow(/Unknown plugin kind/);
  });

  it("returns a working unregister from the delegated registry", () => {
    const off = registerPlugin({ kind: "tool", id: "t1" });
    off();
    expect(getTools()).toHaveLength(0);
  });
});

describe("getPluginInventory", () => {
  it("includes tools plus diagnostic and investigation providers", () => {
    registerTool({ id: "tool-a", label: "Tool A", description: "does a thing", href: "/x" });
    registerDiagnosticProvider({ id: "diag-a", label: "Diag A", collect: () => ({}) });
    registerInvestigationProvider({ id: "inv-a", label: "Inv A", investigate: () => ({}) });

    const inventory = getPluginInventory();
    expect(inventory).toHaveLength(3);

    const byKind = Object.fromEntries(inventory.map((p) => [p.kind, p]));
    expect(byKind.diagnostic).toMatchObject({ id: "diag-a", kind: "diagnostic", label: "Diag A", devOnly: false });
    expect(byKind.investigation).toMatchObject({ id: "inv-a", kind: "investigation", label: "Inv A", devOnly: true });
    expect(byKind.tool).toMatchObject({ id: "tool-a", kind: "tool", label: "Tool A", description: "does a thing", href: "/x" });
  });

  it("falls back to id for label and empty string for description", () => {
    registerTool({ id: "bare" });
    const [row] = getPluginInventory();
    expect(row).toMatchObject({ id: "bare", label: "bare", description: "", href: null });
  });

  it("reports diagnostic devOnly flag from the provider", () => {
    registerDiagnosticProvider({ id: "secret", devOnly: true, collect: () => ({}) });
    const [row] = getPluginInventory();
    expect(row).toMatchObject({ id: "secret", kind: "diagnostic", devOnly: true });
  });

  it("is empty when nothing is registered", () => {
    expect(getPluginInventory()).toEqual([]);
  });
});

describe("groupPluginsByKind", () => {
  it("buckets the inventory into diagnostic / investigation / tool", () => {
    registerTool({ id: "tool-a" });
    registerDiagnosticProvider({ id: "diag-a", collect: () => ({}) });
    registerInvestigationProvider({ id: "inv-a", investigate: () => ({}) });

    const groups = groupPluginsByKind();
    expect(Object.keys(groups)).toEqual(["diagnostic", "investigation", "tool"]);
    expect(groups.diagnostic.map((p) => p.id)).toEqual(["diag-a"]);
    expect(groups.investigation.map((p) => p.id)).toEqual(["inv-a"]);
    expect(groups.tool.map((p) => p.id)).toEqual(["tool-a"]);
  });

  it("returns empty buckets when the inventory is empty", () => {
    expect(groupPluginsByKind()).toEqual({ diagnostic: [], investigation: [], tool: [] });
  });

  it("accepts an explicit inventory argument", () => {
    const groups = groupPluginsByKind([
      { id: "t", kind: "tool" },
      { id: "d", kind: "diagnostic" },
    ]);
    expect(groups.tool.map((p) => p.id)).toEqual(["t"]);
    expect(groups.diagnostic.map((p) => p.id)).toEqual(["d"]);
    expect(groups.investigation).toEqual([]);
  });
});
