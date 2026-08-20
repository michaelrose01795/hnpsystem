#!/usr/bin/env node
// Prevent the ambiguous legacy --text-2 token from spreading. It resolves to
// white in light mode and near-black in dark mode, so it cannot safely mean
// "secondary text". New code must use --surfaceTextMuted for secondary copy or
// --onAccentText for copy on a strong accent. Existing occurrences are frozen
// to a migration baseline which may only move down.

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SEARCH_ROOTS = ["src/components", "src/pages"];
const FILE_RE = /\.(js|jsx|ts|tsx)$/;
// Match both JS style objects (`color: "var(...)"`) and CSS inside styled-jsx
// template strings (`color: var(...)`). The latter was previously invisible to
// this guard and allowed dark-on-dark text to reach the efficiency workspace.
const AMBIGUOUS_TEXT_RE = /color\s*:\s*["'`]?var\(--text-2\)["'`]?/g;
const MIGRATION_BASELINE = new Map([
  ["src/components/HR/tabs/EmployeesTab.js", 1],
  ["src/components/Parts/DeliverySchedulerModal.js", 1],
  ["src/components/VHC/VhcDetailsPanel.js", 2],
  ["src/components/VHC/VhcMediaGallery.js", 1],
  ["src/components/layout/WorkspaceBreadcrumbs.js", 1],
  ["src/components/layout/WorkspaceHeader.js", 1],
  ["src/components/popups/CheckSheetPopup.js", 2],
  ["src/components/popups/ConfirmationDialog.js", 1],
  ["src/components/page-ui/dashboard/parts/dashboard-parts-ui.js", 8],
  ["src/components/page-ui/dashboard/service/dashboard-service-ui.js", 6],
  ["src/components/page-ui/dashboard/workshop/dashboard-workshop-ui.js", 1],
  ["src/components/page-ui/dev/dev-status-snapshot-ui.js", 1],
  ["src/components/page-ui/dev/dev-user-diagnostic-ui.js", 5],
  ["src/components/page-ui/job-cards/job-cards-job-number-ui.js", 4],
  ["src/components/page-ui/job-cards/myjobs/job-cards-myjobs-job-number-ui.js", 6],
  ["src/components/page-ui/job-cards/view/job-cards-view-ui.js", 1],
  ["src/components/page-ui/messages/messages-ui.js", 1],
  ["src/components/page-ui/stock-catalogue-ui.js", 0],
  ["src/components/page-ui/tech/tech-dashboard-ui.js", 2],
  ["src/pages/accounts/invoices/[invoiceId].js", 4],
  ["src/pages/dashboard/parts/index.js", 3],
  ["src/pages/dashboard/service/index.js", 4],
  ["src/pages/dev/user-diagnostic.js", 5],
  ["src/pages/job-cards/[jobNumber].js", 18],
  ["src/pages/jobs/index.js", 3],
  ["src/pages/mobile/dashboard.js", 4],
  ["src/pages/nextjobs.js", 1],
  ["src/pages/tech/[jobNumber].js", 4],
]);

function walk(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, files);
    else if (FILE_RE.test(entry.name)) files.push(absolute);
  }
  return files;
}

const violations = [];
const observed = new Map();
for (const root of SEARCH_ROOTS) {
  for (const file of walk(path.join(ROOT, root))) {
    const relative = path.relative(ROOT, file).replace(/\\/g, "/");
    const count = [...fs.readFileSync(file, "utf8").matchAll(AMBIGUOUS_TEXT_RE)].length;
    if (count) observed.set(relative, count);
  }
}

for (const [file, count] of observed) {
  const baseline = MIGRATION_BASELINE.get(file) || 0;
  if (count > baseline) violations.push(`${file}: ${count} found, ${baseline} allowed`);
}

for (const [file, baseline] of MIGRATION_BASELINE) {
  const count = observed.get(file) || 0;
  if (count < baseline) violations.push(`${file}: migration baseline is stale (${baseline} recorded, ${count} found); lower it`);
}

if (violations.length) {
  console.error("Ambiguous --text-2 token violations:");
  violations.forEach((violation) => console.error(`  ${violation}`));
  console.error("Use --surfaceTextMuted for secondary copy or --onAccentText on a strong accent.");
  process.exit(1);
}

console.log("Text contrast token check passed.");
