#!/usr/bin/env node
// Layer sweep guard: blocks reintroducing legacy card wrappers in app code.
// It intentionally allows the canonical layer primitives, the global shell
// implementation, and the user-diagnostic showcase reference.

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SEARCH_ROOTS = ["src/pages", "src/components"];
const ALLOWLIST = new Set([
  "src/pages/dev/user-diagnostic.js",
  "src/components/Layout.js",
  "src/components/Section.js",
  "src/components/ui/Card.js",
  "src/components/ui/LayerSurface.js",
  "src/components/ui/LayerTheme.js",
  "src/components/ui/LoadingSkeleton.js",
  "src/components/ui/variants.js",
  // Staff app shell — the canonical implementation of the .app-page-card
  // surface (peer of Layout.js). Renders the page card the rest of the app sits in.
  "src/components/layout/StaffLayout.js",
  // Canonical route-level skeleton placeholders (peer of LoadingSkeleton.js).
  "src/components/ui/RouteSkeletons.js",
]);

// Feature files that still reference a legacy card class but are NOT yet
// migrated to <LayerSurface>/<LayerTheme>. Exempt from the class check only
// (still subject to the inline-token check). Distinct from ALLOWLIST so it
// stays visible that these are pending migration, not canonical.
const RESIDUAL_CLASS_ALLOWLIST = new Set([
  // Floating status sidebar: bespoke inline panel/header styling layered on
  // .app-page-card/.app-section-card. Migration deferred (padding-token
  // differences) — see UI debt report.
  "src/components/StatusTracking/StatusSidebar.js",
  // False positive: the dev-layout sectionKey constant
  // "profile-desktop-app-page-card" contains the "app-page-card" substring.
  // The component itself already uses LayerSurface/LayerTheme correctly.
  "src/components/profile/DesktopAppCard.js",
]);

const RESIDUAL_TOKEN_ALLOWLIST = new Set([
  "src/pages/clocking/index.js",
  "src/components/HR/HrTabLoadingSkeleton.js",
  "src/components/HR/StaffVehiclesCard.js",
  "src/components/page-ui/appointments/appointments-ui.js",
  "src/components/page-ui/workshop/workshop-consumables-tracker-ui.js",
  "src/components/profile/ProfileWorkTab.js",
  "src/components/Sidebar.js",
  "src/components/layout/StaffSidebar.js",
  "src/components/StatusTracking/JobProgressTracker.js",
  "src/components/VHC/BrakesHubsDetailsModal.js",
  "src/components/VHC/ExternalDetailsModal.js",
  "src/components/VHC/InternalElectricsDetailsModal.js",
  "src/components/VHC/ServiceIndicatorDetailsModal.js",
  "src/components/VHC/UndersideDetailsModal.js",
  "src/components/VHC/VhcCustomerDescriptionModal.js",
  "src/components/VHC/WheelsTyresDetailsModal.js",
]);

const LEGACY_CLASS_RE = /\b(app-section-card|app-page-card)\b/;
const LEGACY_SURFACE_TOKEN_RE = /style=\{\{[^}]*\b(background|border|borderRadius)\s*:[^}]*var\(--(section-card-bg|page-card-bg|section-card-border|page-card-border|section-card-radius|page-card-radius)/s;

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

const violations = [];

for (const root of SEARCH_ROOTS) {
  for (const file of walk(path.join(ROOT, root))) {
    const relative = rel(file);
    if (ALLOWLIST.has(relative)) continue;
    const source = fs.readFileSync(file, "utf8");
    if (!RESIDUAL_CLASS_ALLOWLIST.has(relative)) {
      source.split(/\r?\n/).forEach((line, index) => {
        if (LEGACY_CLASS_RE.test(line)) {
          violations.push(`${relative}:${index + 1}: legacy app card class`);
        }
      });
    }
    if (!RESIDUAL_TOKEN_ALLOWLIST.has(relative) && LEGACY_SURFACE_TOKEN_RE.test(source)) {
      violations.push(`${relative}: legacy surface token used in inline JSX surface style`);
    }
  }
}

if (violations.length) {
  console.error("Layer sweep violations found:");
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}

console.log("Layer sweep check passed.");
