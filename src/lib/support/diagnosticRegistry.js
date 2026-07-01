// file location: src/lib/support/diagnosticRegistry.js
//
// Help & Diagnostics ("support") — extensible diagnostic provider registry.
//
// This is the extension point that lets ANY future feature contribute its own
// diagnostics to a support report WITHOUT touching the popup, the capture core,
// or the analysis engine. A feature registers a provider once (at module import
// or in a setup hook); the capture pipeline then calls every provider and merges
// the results into the snapshot under `providers.<id>`.
//
//   import { registerDiagnosticProvider } from "@/lib/support/diagnosticRegistry";
//   registerDiagnosticProvider({
//     id: "jobcard",
//     label: "Job card state",
//     devOnly: false,
//     collect({ doc, win, store, snapshot, isDev }) {
//       return { activeJobNumber: doc?.querySelector?.("[data-job-number]")?.textContent };
//     },
//   });
//
// Contract:
//   - `id` (string, unique) and `collect(context)` (function) are required.
//   - `collect` MUST be synchronous, side-effect-free, and defensive — it runs
//     during report capture and must never throw (a throw is swallowed so one bad
//     provider can't break the whole report) or block.
//   - `collect` must return a plain JSON-able object (or null/{} to contribute
//     nothing). It must NOT return secrets or raw user-entered values — whatever
//     it returns is run through the shared sanitiser, but providers should still
//     follow the "names/booleans not values" rule (see uiStateProvider).
//   - `devOnly: true` providers run only when the capture context is `isDev`.
//
// PURE + dependency-free (no window/document of its own — the browser objects
// arrive via the injected context) so it is fully unit-testable in node.

const providers = new Map();

/**
 * Register (or replace, by id) a diagnostic provider.
 * @param {{ id: string, collect: Function, label?: string, devOnly?: boolean }} provider
 * @returns {() => void} an unregister function
 */
export function registerDiagnosticProvider(provider) {
  if (!provider || typeof provider.id !== "string" || !provider.id) {
    throw new Error("A diagnostic provider requires a non-empty string `id`.");
  }
  if (typeof provider.collect !== "function") {
    throw new Error(`Diagnostic provider "${provider.id}" requires a collect() function.`);
  }
  providers.set(provider.id, {
    label: provider.id,
    devOnly: false,
    ...provider,
  });
  return () => {
    // Only remove if it's still the same registration.
    if (providers.get(provider.id) && providers.get(provider.id).collect === provider.collect) {
      providers.delete(provider.id);
    }
  };
}

/** All currently-registered providers (in insertion order). */
export function getDiagnosticProviders() {
  return Array.from(providers.values());
}

/** Remove every provider — used by tests for isolation. */
export function clearDiagnosticProviders() {
  providers.clear();
}

/**
 * Run every registered provider against the capture context and return a map of
 * `{ [providerId]: data }`. Faulty providers are skipped (never throw), devOnly
 * providers are skipped unless `context.isDev`, and empty contributions are
 * dropped so the snapshot stays lean.
 *
 * @param {{ win?: object, doc?: object, store?: object, snapshot?: object, isDev?: boolean }} [context]
 * @returns {Record<string, object>}
 */
export function collectProviderDiagnostics(context = {}) {
  const out = {};
  for (const provider of providers.values()) {
    if (provider.devOnly && !context.isDev) continue;
    try {
      const data = provider.collect(context);
      if (data && typeof data === "object" && !Array.isArray(data) && Object.keys(data).length > 0) {
        out[provider.id] = data;
      } else if (Array.isArray(data) && data.length > 0) {
        out[provider.id] = data;
      }
    } catch {
      // A provider must never break report capture. Swallow and move on.
    }
  }
  return out;
}
