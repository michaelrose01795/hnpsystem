// file location: src/lib/dev-platform/pluginRegistry.js
//
// Phase 10 — the Developer Platform PLUGIN ARCHITECTURE. A single, documented
// entry point that lets any future HNPSystem module contribute to the platform
// WITHOUT editing the core:
//
//   • kind "diagnostic"     → a capture-time provider (routes to diagnosticRegistry)
//   • kind "investigation"  → a dev-only analysis provider (routes to investigationRegistry)
//   • kind "tool"           → an engineering tool surfaced in the platform (its own registry here)
//
// The first two registries already exist and are battle-tested; this facade
// unifies registration + gives an inventory the /dev plugin page can render, and
// adds the third ("tool") registry for platform-level extensions (a nav entry, a
// panel, an action). PURE + dependency-injected (no React, no I/O) — node-testable.

import {
  registerDiagnosticProvider,
  getDiagnosticProviders,
} from "@/lib/support/diagnosticRegistry";
import {
  registerInvestigationProvider,
  getInvestigationProviders,
} from "@/lib/support/investigationRegistry";

// ---------------------------------------------------------------------------
// Engineering-tool registry (the new, third extension kind).
// A tool = { id, label, description?, category?, href?, run?() }. `run` is an
// optional pure action factory (the UI decides how to invoke it); `href` links
// to a platform surface. Tools NEVER capture data — they are UI/utility plugins.
// ---------------------------------------------------------------------------
const tools = new Map();

export function registerTool(tool) {
  if (!tool || typeof tool.id !== "string" || !tool.id) {
    throw new Error("A platform tool requires a non-empty string `id`.");
  }
  const stored = { label: tool.id, category: "tool", ...tool };
  tools.set(tool.id, stored);
  return () => {
    // Only remove if THIS registration is still the current one (id may have been re-registered).
    if (tools.get(tool.id) === stored) tools.delete(tool.id);
  };
}

export function getTools() {
  return Array.from(tools.values());
}

export function clearTools() {
  tools.clear();
}

// ---------------------------------------------------------------------------
// Unified registration facade.
// ---------------------------------------------------------------------------

/**
 * Register a platform plugin of any kind.
 * @param {{ kind:'diagnostic'|'investigation'|'tool', id:string } & object} plugin
 * @returns {() => void} unregister
 */
export function registerPlugin(plugin) {
  if (!plugin || typeof plugin !== "object") throw new Error("registerPlugin requires a plugin object.");
  switch (plugin.kind) {
    case "diagnostic":
      return registerDiagnosticProvider(plugin);
    case "investigation":
      return registerInvestigationProvider(plugin);
    case "tool":
      return registerTool(plugin);
    default:
      throw new Error(`Unknown plugin kind "${plugin.kind}". Use 'diagnostic', 'investigation' or 'tool'.`);
  }
}

/**
 * A read-only inventory of everything registered across all three registries,
 * for the /dev plugins page and the extensibility coverage test.
 * @returns {Array<{ id:string, kind:string, label:string, description?:string }>}
 */
export function getPluginInventory() {
  const rows = [];
  getDiagnosticProviders().forEach((p) =>
    rows.push({ id: p.id, kind: "diagnostic", label: p.label || p.id, description: p.description || "", devOnly: Boolean(p.devOnly) })
  );
  getInvestigationProviders().forEach((p) =>
    rows.push({ id: p.id, kind: "investigation", label: p.label || p.id, description: p.description || "", devOnly: true })
  );
  getTools().forEach((t) =>
    rows.push({ id: t.id, kind: "tool", label: t.label || t.id, description: t.description || "", category: t.category, href: t.href || null })
  );
  return rows;
}

/** Group the inventory by kind (for a sectioned plugins page). */
export function groupPluginsByKind(inventory = getPluginInventory()) {
  const groups = { diagnostic: [], investigation: [], tool: [] };
  for (const p of inventory) {
    if (!groups[p.kind]) groups[p.kind] = [];
    groups[p.kind].push(p);
  }
  return groups;
}
