#!/usr/bin/env node
// Staff dropdown guard.
//
// Staff-facing choice controls must use DropdownField instead of a native
// <select>. Existing native selects are held to a fixed migration baseline so
// they can be converted incrementally without allowing the backlog to grow.

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, "src");
const STAFF_GLOBAL_CSS = path.join(SOURCE_ROOT, "styles", "staffglobal.css");
const FILE_EXT_RE = /\.(js|jsx|ts|tsx)$/;

// These components intentionally provide native controls for the public
// website, outside staff scope.
const INTENTIONAL_NATIVE_SELECTS = new Map([
  ["src/features/website/components/WebsiteNativeSelect.js", 1],
  ["src/singlescroll/components/WebsiteNativeSelect.js", 1],
  ["src/pages/website/dev.js", 1],
]);

// Transitional ceiling for staff files that pre-date the DropdownField rule.
// Lower each count as the corresponding file is migrated; never increase it.
const MIGRATION_BASELINE = new Map([
  ["src/components/Admin/AdminUserForm.js", 2],
  ["src/components/HR/tabs/EmployeesTab.js", 2],
  ["src/components/JobCards/WriteUpForm.js", 1],
  ["src/components/Parts/DeliverySchedulerModal.js", 1],
  ["src/components/VHC/VhcDetailsPanel.js", 1],
  ["src/components/Workshop/JobClockingCard.js", 1],
  ["src/components/page-ui/job-cards/ContactTab.js", 1],
  ["src/components/page-ui/job-cards/myjobs/job-cards-myjobs-job-number-ui.js", 1],
  ["src/components/page-ui/job-cards/view/job-cards-view-ui.js", 1],
  ["src/components/page-ui/parts/create-order/parts-create-order-ui.js", 1],
  ["src/components/page-ui/parts/deliveries/parts-deliveries-delivery-id-ui.js", 1],
  ["src/components/page-ui/parts/parts-delivery-planner-ui.js", 1],
  ["src/components/page-ui/stock-catalogue-ui.js", 4],
  ["src/components/popups/InvoiceBuilderPopup.js", 1],
  ["src/components/popups/NextActionPrompt.js", 2],
  ["src/features/websiteManager/editors/fields.js", 2],
  ["src/features/websiteManager/panels/ActivityPanel.js", 1],
  ["src/features/websiteManager/panels/OverviewPanel.js", 1],
  ["src/features/websiteManager/panels/PageContentPanel.js", 1],
  ["src/features/websiteManager/panels/SeoPanel.js", 1],
  ["src/features/websiteManager/panels/ShopPanel.js", 1],
  ["src/pages/admin/compliance/breaches.js", 3],
  ["src/pages/admin/compliance/dpias.js", 3],
  ["src/pages/admin/compliance/ropa.js", 1],
  ["src/pages/admin/compliance/sars.js", 1],
  ["src/pages/profile/privacy.js", 1],
]);

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, files);
    } else if (FILE_EXT_RE.test(entry.name)) {
      files.push(absolute);
    }
  }
  return files;
}

function relativePath(file) {
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

// Count JSX tags while ignoring comments and quoted strings that merely mention
// "<select>". The scan is line-oriented so apostrophes in JSX text cannot be
// mistaken for JavaScript strings on later lines.
function findNativeSelectLines(source) {
  const lines = [];
  let inBlockComment = false;

  source.split(/\r?\n/).forEach((sourceLine, lineIndex) => {
    let quote = "";

    for (let index = 0; index < sourceLine.length; index += 1) {
      const char = sourceLine[index];
      const next = sourceLine[index + 1];

      if (inBlockComment) {
        if (char === "*" && next === "/") {
          inBlockComment = false;
          index += 1;
        }
        continue;
      }

      if (quote) {
        if (char === "\\") {
          index += 1;
        } else if (char === quote) {
          quote = "";
        }
        continue;
      }

      if (char === "/" && next === "/") break;
      if (char === "/" && next === "*") {
        inBlockComment = true;
        index += 1;
        continue;
      }
      if (char === "'" || char === '"') {
        quote = char;
        continue;
      }
      if (char === "`") {
        quote = char;
        continue;
      }

      if (
        char === "<" &&
        sourceLine.slice(index + 1, index + 7).toLowerCase() === "select" &&
        (sourceLine[index + 7] === undefined || /[\s>]/.test(sourceLine[index + 7]))
      ) {
        lines.push(lineIndex + 1);
      }
    }
  });

  return lines;
}

const violations = [];
const observedCounts = new Map();

for (const file of walk(SOURCE_ROOT)) {
  const source = fs.readFileSync(file, "utf8");
  const nativeSelectLines = findNativeSelectLines(source);
  if (nativeSelectLines.length === 0) continue;

  const relative = relativePath(file);
  observedCounts.set(relative, nativeSelectLines.length);
  const permitted =
    INTENTIONAL_NATIVE_SELECTS.get(relative) ??
    MIGRATION_BASELINE.get(relative) ??
    0;

  if (nativeSelectLines.length > permitted) {
    const newLines = nativeSelectLines.slice(permitted);
    for (const line of newLines) {
      violations.push(
        `${relative}:${line}: native <select> is not allowed; use DropdownField`
      );
    }
  }
}

for (const [file, expectedCount] of MIGRATION_BASELINE) {
  const observedCount = observedCounts.get(file) ?? 0;
  if (observedCount < expectedCount) {
    violations.push(
      `${file}: migration baseline is stale (${expectedCount} recorded, ${observedCount} found); lower it in check-dropdowns.js`
    );
  }
}

const staffGlobalSource = fs.readFileSync(STAFF_GLOBAL_CSS, "utf8");
const nativeStaffSelectors = staffGlobalSource
  .split(/\r?\n/)
  .map((line, index) => ({ line, number: index + 1 }))
  .filter(({ line }) => /html\.staff-scope\s+select\b/i.test(line));

for (const match of nativeStaffSelectors) {
  violations.push(
    `src/styles/staffglobal.css:${match.number}: native selects must not be styled in staff scope`
  );
}

if (violations.length > 0) {
  console.error(`\nStaff dropdown violations (${violations.length}):\n`);
  for (const violation of violations) console.error(`  ${violation}`);
  console.error(
    "\nUse DropdownField from @/components/ui/dropdownAPI. Do not increase the migration baseline.\n"
  );
  process.exit(1);
}

const baselineTotal = [...MIGRATION_BASELINE.values()].reduce(
  (total, count) => total + count,
  0
);
console.log(
  `Staff dropdown check passed - no new native selects (${baselineTotal} legacy selects remain queued for migration).`
);
