#!/usr/bin/env node
// Staff control guard.
//
// Staff-facing page/section UI must use the shared staffglobal.css component
// families:
//   - Button component / .app-btn for actions
//   - DropdownField / .dropdown-api for choice controls
//   - .app-input (+ modifiers) for native text/number/search/textarea fields
//   - hidden native file input + staff Button trigger for uploads
//
// Existing legacy raw controls are held to a fixed baseline so they can be
// migrated down over time, but new raw/browser-default controls cannot be added.

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SEARCH_ROOTS = [
  "src/components/page-ui",
  "src/pages",
];
const EXCLUDED_PREFIXES = [
  "src/pages/website/",
];
const FILE_EXT_RE = /\.(js|jsx|ts|tsx)$/;

// Transitional ceiling for legacy controls. Lower counts as files are migrated.
// Do not increase this map. New files default to 0.
const MIGRATION_BASELINE = new Map([
  ["src/components/page-ui/accounts/payslips/payslips-ui.js", 3],
  ["src/components/page-ui/accounts/reports/accounts-reports-ui.js", 2],
  ["src/components/page-ui/admin/users/admin-users-ui.js", 1],
  ["src/components/page-ui/appointments/appointments-ui.js", 4],
  ["src/components/page-ui/clocking/clocking-technician-slug-ui.js", 3],
  ["src/components/page-ui/dev/dev-status-snapshot-ui.js", 2],
  ["src/components/page-ui/dev/dev-user-diagnostic-ui.js", 4],
  ["src/components/page-ui/job-cards/ContactTab.js", 1],
  ["src/components/page-ui/job-cards/job-cards-job-number-ui.js", 5],
  ["src/components/page-ui/job-cards/myjobs/job-cards-myjobs-job-number-ui.js", 8],
  ["src/components/page-ui/job-cards/SchedulingTab.js", 1],
  ["src/components/page-ui/job-cards/ServiceHistoryTab.js", 2],
  ["src/components/page-ui/job-cards/ServiceHistoryTab.test.js", 1],
  ["src/components/page-ui/job-cards/view/job-cards-view-ui.js", 5],
  ["src/components/page-ui/job-cards/waiting/job-cards-waiting-nextjobs-ui.js", 3],
  ["src/components/page-ui/job-cards/WarrantyTab.js", 2],
  ["src/components/page-ui/messages/messages-ui.js", 5],
  ["src/components/page-ui/newsfeed-ui.js", 2],
  ["src/components/page-ui/parts/create-order/parts-create-order-order-number-ui.js", 4],
  ["src/components/page-ui/parts/create-order/parts-create-order-ui.js", 32],
  ["src/components/page-ui/parts/deliveries/parts-deliveries-delivery-id-ui.js", 22],
  ["src/components/page-ui/parts/parts-delivery-planner-ui.js", 9],
  ["src/components/page-ui/parts/parts-goods-in-ui.js", 50],
  ["src/components/page-ui/parts/parts-manager-ui.js", 1],
  ["src/components/page-ui/stock-catalogue-ui.js", 14],
  ["src/components/page-ui/tech/tech-consumables-request-ui.js", 3],
  ["src/components/page-ui/valet/valet-ui.js", 2],
  ["src/components/page-ui/vhc/customer-preview/vhc-customer-preview-job-number-ui.js", 3],
  ["src/components/page-ui/vhc/customer-view/vhc-customer-view-job-number-ui.js", 1],
  ["src/components/page-ui/vhc/share/[jobNumber]/vhc-share-job-number-link-code-ui.js", 1],
  ["src/pages/admin/compliance/breaches.js", 5],
  ["src/pages/admin/compliance/dpias.js", 4],
  ["src/pages/admin/compliance/ropa.js", 2],
  ["src/pages/admin/compliance/sars.js", 1],
  ["src/pages/customers/[customerSlug].js", 3],
  ["src/pages/deliveries/index.js", 1],
  ["src/pages/delivery-planner.js", 16],
  ["src/pages/dev/knowledge.js", 1],
  ["src/pages/dev/user-diagnostic.js", 28],
  ["src/pages/goods-in/index.js", 19],
  ["src/pages/hr/disciplinary.js", 1],
  ["src/pages/hr/performance.js", 1],
  ["src/pages/hr/settings.js", 1],
  ["src/pages/hr/training.js", 1],
  ["src/pages/job-cards/[jobNumber].js", 45],
  ["src/pages/messages/index.js", 2],
  ["src/pages/new-order/[orderNumber].js", 1],
  ["src/pages/password-reset/new.js", 2],
  ["src/pages/profile/privacy.js", 1],
  ["src/pages/stock-catalogue.js", 31],
  ["src/pages/tech/[jobNumber].js", 11],
  ["src/pages/valet/index.js", 3],
  ["src/pages/vhc/customer-preview/[jobNumber].js", 2],
]);

const CONTROL_TAG_RE = /<(input|textarea|button)\b/;
const SELECT_TAG_RE = /<select\b/;
const VISUAL_STYLE_RE = /\b(background|backgroundColor|color|padding|border|borderRadius|font|fontSize|fontWeight|boxShadow|minHeight|height)\b/;
const APP_INPUT_RE = /className=(?:"[^"]*\bapp-input\b[^"]*"|'[^']*\bapp-input\b[^']*'|{`[^`]*\bapp-input\b[^`]*`}|{[^}]*app-input[^}]*})/;
const APP_TOGGLE_RE = /className=(?:"[^"]*\bapp-toggle--(?:checkbox|radio)\b[^"]*"|'[^']*\bapp-toggle--(?:checkbox|radio)\b[^']*'|{`[^`]*\bapp-toggle--(?:checkbox|radio)\b[^`]*`}|{[^}]*app-toggle--(?:checkbox|radio)[^}]*})/;
const APP_BUTTON_RE = /className=(?:"[^"]*\b(app-btn|tab-api__item|vhc-btn)\b[^"]*"|'[^']*\b(app-btn|tab-api__item|vhc-btn)\b[^']*'|{`[^`]*\b(app-btn|tab-api__item|vhc-btn)\b[^`]*`}|{[^}]*(app-btn|tab-api__item|vhc-btn)[^}]*})/;
const HIDDEN_FILE_RE = /type=(?:"file"|'file'|{"file"}).*style=\{\{\s*display:\s*["']none["']\s*\}\}/;
const HIDDEN_INPUT_RE = /type=(?:"hidden"|'hidden'|{"hidden"})/;

function walk(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
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

function stripLineComments(line) {
  const index = line.indexOf("//");
  return index >= 0 ? line.slice(0, index) : line;
}

function readOpeningTag(lines, startIndex) {
  const chunks = [];
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 12); index += 1) {
    const line = stripLineComments(lines[index]);
    chunks.push(line);
    if (/\/>\s*$/.test(line) || />\s*$/.test(line.replace(/=>/g, ""))) break;
  }
  return chunks.join(" ");
}

function findViolations(source) {
  const lines = source.split(/\r?\n/);
  const violations = [];

  lines.forEach((line, index) => {
    if (!CONTROL_TAG_RE.test(line) && !SELECT_TAG_RE.test(line)) return;
    const openingTag = readOpeningTag(lines, index);
    const lineNumber = index + 1;

    if (SELECT_TAG_RE.test(openingTag)) {
      violations.push({ line: lineNumber, reason: "native <select>; use DropdownField" });
      return;
    }

    const tagMatch = openingTag.match(CONTROL_TAG_RE);
    if (!tagMatch) return;
    const tagName = tagMatch[1].toLowerCase();

    if (tagName === "button") {
      if (!APP_BUTTON_RE.test(openingTag)) {
        violations.push({ line: lineNumber, reason: "raw <button>; use Button or .app-btn" });
        return;
      }
      if (/style=/.test(openingTag) && VISUAL_STYLE_RE.test(openingTag)) {
        violations.push({ line: lineNumber, reason: "button visual inline style; use staffglobal button classes" });
      }
      return;
    }

    if (tagName === "input" && (HIDDEN_INPUT_RE.test(openingTag) || HIDDEN_FILE_RE.test(openingTag))) {
      return;
    }

    if (tagName === "input" && APP_TOGGLE_RE.test(openingTag)) {
      return;
    }

    if (!APP_INPUT_RE.test(openingTag)) {
      violations.push({ line: lineNumber, reason: `${tagName} missing .app-input` });
      return;
    }

    if (/style=/.test(openingTag) && VISUAL_STYLE_RE.test(openingTag)) {
      violations.push({ line: lineNumber, reason: `${tagName} visual inline style; use .app-input/staffglobal` });
    }
  });

  return violations;
}

const violations = [];
const observedCounts = new Map();
const files = SEARCH_ROOTS.flatMap((root) => walk(path.join(ROOT, root)));

for (const file of files) {
  const relative = relativePath(file);
  if (EXCLUDED_PREFIXES.some((prefix) => relative.startsWith(prefix))) continue;
  const fileViolations = findViolations(fs.readFileSync(file, "utf8"));
  observedCounts.set(relative, fileViolations.length);
  const permitted = MIGRATION_BASELINE.get(relative) ?? 0;
  if (fileViolations.length > permitted) {
    fileViolations.slice(permitted).forEach((violation) => {
      violations.push(`${relative}:${violation.line}: ${violation.reason}`);
    });
  }
}

// Regression guard for the /jobs quick-note popup. This popup previously
// duplicated control styling and placed completion actions in a footer, which
// bypassed the compact staff-popup convention documented in staffglobal.css.
// Keep this check in the predev/prebuild control gate so later edits cannot
// silently reintroduce that drift.
const quickNoteUiPath = "src/components/page-ui/job-cards/view/job-cards-view-ui.js";
const quickNoteUiSource = fs.readFileSync(path.join(ROOT, quickNoteUiPath), "utf8");
const quickNoteStart = quickNoteUiSource.indexOf('cardClassName="app-job-quick-note"');
const quickNoteEnd = quickNoteUiSource.indexOf("</PopupModal>", quickNoteStart);

if (quickNoteStart < 0 || quickNoteEnd < 0) {
  violations.push(`${quickNoteUiPath}: quick-note PopupModal contract could not be located`);
} else {
  const quickNotePopup = quickNoteUiSource.slice(quickNoteStart, quickNoteEnd);
  const requiredFragments = [
    '<header className="app-popup-compact-header">',
    '<div className="app-popup-compact-header__actions">',
    'variant="primary"',
    "Save note",
    'variant="secondary"',
    "Close",
    'className="app-summary-grid"',
    'className="app-summary-item"',
    'className="app-summary-label"',
    'className="app-summary-value"',
    '<LayerTheme as="section" className="app-job-quick-note__recent"',
  ];
  const forbiddenFragments = [
    "app-job-quick-note__eyebrow",
    "app-job-quick-note__header",
    "app-job-quick-note__actions",
    ">Cancel<",
    "<button",
  ];

  requiredFragments.forEach((fragment) => {
    if (!quickNotePopup.includes(fragment)) {
      violations.push(`${quickNoteUiPath}: quick-note popup missing staff contract fragment ${JSON.stringify(fragment)}`);
    }
  });
  forbiddenFragments.forEach((fragment) => {
    if (quickNotePopup.includes(fragment)) {
      violations.push(`${quickNoteUiPath}: quick-note popup contains forbidden legacy fragment ${JSON.stringify(fragment)}`);
    }
  });

  if (
    quickNotePopup.indexOf("Open full notes") > quickNotePopup.indexOf("Save note") ||
    quickNotePopup.indexOf("Save note") > quickNotePopup.indexOf("Close")
  ) {
    violations.push(`${quickNoteUiPath}: quick-note actions must render Open full notes, Save note, then Close`);
  }
}

const staffGlobalPath = "src/styles/staffglobal.css";
const staffGlobalSource = fs.readFileSync(path.join(ROOT, staffGlobalPath), "utf8");
const quickNoteCssStart = staffGlobalSource.indexOf("/* Quick-note composer on /jobs;");
const quickNoteCssEnd = staffGlobalSource.indexOf(
  "html.staff-scope .app-job-operations-row__request-meta",
  quickNoteCssStart
);

if (quickNoteCssStart < 0 || quickNoteCssEnd < 0) {
  violations.push(`${staffGlobalPath}: quick-note colour contract could not be located`);
} else {
  const quickNoteCss = staffGlobalSource.slice(quickNoteCssStart, quickNoteCssEnd);
  if (quickNoteCss.includes("var(--text-2)")) {
    violations.push(
      `${staffGlobalPath}: quick-note surface text must not use inverse --text-2; use --text-1 or --surfaceTextMuted`
    );
  }
  if (!quickNoteCss.includes("color: var(--surfaceTextMuted)")) {
    violations.push(`${staffGlobalPath}: quick-note muted copy must use --surfaceTextMuted`);
  }
}

if (process.argv.includes("--print-baseline")) {
  [...observedCounts.entries()]
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([file, count]) => {
      console.log(`  ["${file}", ${count}],`);
    });
  process.exit(0);
}

for (const [file, expectedCount] of MIGRATION_BASELINE) {
  const observedCount = observedCounts.get(file) ?? 0;
  if (observedCount < expectedCount) {
    violations.push(
      `${file}: migration baseline is stale (${expectedCount} recorded, ${observedCount} found); lower it in check-staff-controls.js`
    );
  }
}

if (violations.length > 0) {
  console.error(`\nStaff control violations (${violations.length}):\n`);
  violations.slice(0, 120).forEach((violation) => console.error(`  ${violation}`));
  if (violations.length > 120) {
    console.error(`  ...and ${violations.length - 120} more`);
  }
  console.error(
    "\nUse Button/.app-btn, DropdownField, SearchBar, and .app-input. Do not use browser-default controls in staff UI.\n"
  );
  process.exit(1);
}

const baselineTotal = [...MIGRATION_BASELINE.values()].reduce((total, count) => total + count, 0);
console.log(`Staff control check passed - no new raw staff controls (${baselineTotal} legacy controls remain queued for migration).`);
