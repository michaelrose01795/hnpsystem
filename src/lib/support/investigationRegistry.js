// file location: src/lib/support/investigationRegistry.js
//
// Help & Diagnostics ("support") — extensible INVESTIGATION provider registry.
//
// This is the extension point for the developer-facing investigation engine
// (buildInvestigation). It is deliberately SEPARATE from the diagnostic provider
// registry (src/lib/support/diagnosticRegistry.js):
//   - Diagnostic providers add raw signals to the captured snapshot (client-side,
//     may be shown in the reporter popup).
//   - Investigation providers add developer-only ANALYSIS fragments (root-cause
//     hints, files/tables to inspect, module-specific checks). They run only where
//     the investigation runs (server-side at ingest / a future dev viewer) and are
//     NEVER exposed to reporters.
//
// A module registers one once; buildInvestigation() calls every provider and
// merges their fragments under `investigation.providers.<id>` — so any future
// HNPSystem module can enrich investigations without touching the support core.
//
//   import { registerInvestigationProvider } from "@/lib/support/investigationRegistry";
//   registerInvestigationProvider({
//     id: "jobcard",
//     label: "Job card investigation",
//     investigate({ snapshot, analysis, priorReports }) {
//       // synchronous, side-effect-free, defensive (never throw). Return a plain
//       // JSON-able object of dev hints — no secrets, no raw user values.
//       return { suggestedTables: ["job_cards"], notes: ["Check status transitions"] };
//     },
//   });
//
// PURE + dependency-free (context is injected) so it is fully node-testable.

const providers = new Map();

/**
 * Register (or replace, by id) an investigation provider.
 * @param {{ id: string, investigate: Function, label?: string }} provider
 * @returns {() => void} unregister
 */
export function registerInvestigationProvider(provider) {
  if (!provider || typeof provider.id !== "string" || !provider.id) {
    throw new Error("An investigation provider requires a non-empty string `id`.");
  }
  if (typeof provider.investigate !== "function") {
    throw new Error(`Investigation provider "${provider.id}" requires an investigate() function.`);
  }
  providers.set(provider.id, { label: provider.id, ...provider });
  return () => {
    if (providers.get(provider.id) && providers.get(provider.id).investigate === provider.investigate) {
      providers.delete(provider.id);
    }
  };
}

export function getInvestigationProviders() {
  return Array.from(providers.values());
}

export function clearInvestigationProviders() {
  providers.clear();
}

/**
 * Run every registered investigation provider against the context and return a
 * map of `{ [providerId]: fragment }`. Faulty providers are skipped (never
 * throw); empty fragments are dropped.
 *
 * @param {object} [context] { snapshot, analysis, priorReports, isDev, ... }
 * @returns {Record<string, object>}
 */
export function collectInvestigationProviders(context = {}) {
  const out = {};
  for (const provider of providers.values()) {
    try {
      const fragment = provider.investigate(context);
      if (fragment && typeof fragment === "object" && Object.keys(fragment).length > 0) {
        out[provider.id] = fragment;
      }
    } catch {
      // A provider must never break the investigation.
    }
  }
  return out;
}
