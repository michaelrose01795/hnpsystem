// file location: src/lib/support/providers/index.js
//
// Registers the built-in support diagnostic providers. Called once when the
// SupportDiagnosticsProvider mounts. Registration is keyed by id, so calling it
// again (e.g. fast-refresh / a second provider mount) is harmless.
//
// Feature teams add their own providers the same way — see
// src/lib/support/diagnosticRegistry.js for the contract and
// docs/Support/help-diagnostics-system-plan.md for the extension-point guide.

import { registerDiagnosticProvider } from "@/lib/support/diagnosticRegistry";
import uiStateProvider from "@/lib/support/providers/uiStateProvider";
import devMetadataProvider from "@/lib/support/providers/devMetadataProvider";

let registered = false;

export function registerBuiltinDiagnosticProviders() {
  // Idempotent at the registry level too (Map keyed by id), but skip the work on
  // repeat calls.
  if (registered) return;
  registerDiagnosticProvider(uiStateProvider);
  registerDiagnosticProvider(devMetadataProvider);
  registered = true;
}

export { uiStateProvider, devMetadataProvider };
