#!/usr/bin/env node
// Frontend Feedback & Error System guard (rollout Phase 10 — the permanent
// standard). Mirrors check-borders.js / check-report-events.js.
//
// The Feedback System is the single path for telling a user something:
//   - failures  → reportError / reportApiError (Phase 3/5) — friendly message,
//                 explicit type, reference code, devInfo (never a raw stack).
//   - success   → reportSuccess;  neutral → reportInfo;  caveat → reportWarning.
//   - crashes   → RouteBoundary / SectionBoundary (Phase 9).
//   - loading / empty / validation → the Phase 6/7/8 primitives.
//
// This guard RATCHETS that standard so migrated code cannot regress and new code
// cannot reintroduce the banned patterns:
//
//   HARD (exit 1) — a user-facing surface (src/pages, src/components, src/features)
//     uses a raw browser dialog:
//       • bare `alert(...)`            (the deprecated untyped path — window.alert
//                                       is globally routed to the toast bus, but
//                                       it loses type/reference-code/devInfo)
//       • `window.alert/confirm/prompt(...)`
//     …unless the file is on BASELINE_ALLOWLIST (pre-existing debt, tracked for
//     the ongoing sweep) or EXEMPT (intentional non-product/native contexts).
//
//   ADVISORY (exit 0 unless --strict) — a raw technical message is piped straight
//     into a toast (`showAlert(... .message ...)` / `pushAlert(err.message ...)`),
//     i.e. the raw `error.message` is shown to the user instead of flowing into
//     devInfo via reportError. These are the "raw technical message" defects.
//
// Usage:  node tools/scripts/check-feedback.js [--strict] [--list]
//   --strict : promote advisories to failures.
//   --list   : print every current HARD hit grouped by file (ignores baseline) —
//              use this to shrink BASELINE_ALLOWLIST as files are migrated.

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const STRICT = process.argv.includes("--strict");
const LIST = process.argv.includes("--list");
const SEARCH_ROOTS = ["src/pages", "src/components", "src/features"];
const FILE_EXT_RE = /\.(js|jsx|ts|tsx)$/;

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/");

// Files/areas intentionally exempt from the dialog ban (native/non-product
// contexts already outside the design system, or the override's own home).
const EXEMPT = new Set([
  // Dev-only website preview page (not a product surface).
  "src/pages/website/dev.js",
]);
const EXEMPT_PREFIXES = [
  "src/pages/api/", // server handlers — no window, no user toast surface.
  "src/pages/dev/", // dev diagnostics/showcase pages (incl. user-diagnostic, readiness).
  "src/components/support/dev/", // internal Support Centre dev tooling.
];

// Pre-existing debt: files that still contain a banned dialog and are queued for
// the ongoing sweep. Passing today = this baseline. A file is REMOVED from here
// the moment it is fully migrated, so it can never regress. Adding a NEW file
// here should be a deliberate, reviewed decision — the default for new code is to
// use the Feedback helpers, not to baseline.
//
// Generated with `node tools/scripts/check-feedback.js --list`; keep sorted.
const BASELINE_ALLOWLIST = new Set([
  "src/pages/admin/users/index.js",
  "src/pages/appointments/index.js",
  "src/pages/login.js",
  "src/pages/stock-catalogue.js",
  "src/pages/tech/[jobNumber].js",
  "src/pages/tracking/index.js",
  "src/pages/vhc/customer/[jobNumber]/[linkCode].js",
  "src/pages/vhc/customer-preview/[jobNumber].js",
  "src/pages/job-cards/[jobNumber].js",
  "src/pages/website/profile.js",
  "src/components/Clocking/EfficiencyTab.js",
  "src/components/JobCards/JobCardModal.js",
  "src/components/JobCards/WriteUpForm.js",
  "src/components/page-ui/job-cards/ContactTab.js",
  "src/components/page-ui/job-cards/job-cards-job-number-ui.js",
  "src/components/page-ui/job-cards/WarrantyTab.js",
  "src/components/popups/DocumentsUploadPopup.js",
  "src/components/profile/ProfileWorkTab.js",
  "src/components/VHC/VhcDetailsPanel.js",
  "src/components/VHC/WheelsHubsModal.js",
  "src/components/Workshop/JobClockingCard.js",
  "src/features/invoices/components/ProformaOverrideModal.js",
  "src/features/presentation/usePdfExport.js",
  "src/features/tracking/map/TrackingMap.js",
  "src/features/websiteManager/panels/LivePreviewPanel.js",
  "src/features/websiteManager/panels/MediaPanel.js",
  "src/features/websiteManager/panels/PageContentPanel.js",
  "src/features/websiteManager/panels/ShopPanel.js",
]);

// HARD patterns — banned browser dialogs. Bare identifier form uses a
// negative-lookbehind so `showAlert(` / `pushAlert(` / `foo.alert(` don't match.
const HARD_PATTERNS = [
  { re: /(?<![\w.])alert\s*\(/g, label: "alert(" },
  { re: /\bwindow\.(alert|confirm|prompt)\s*\(/g, label: "window dialog" },
];

// ADVISORY — a raw error message piped straight into a toast call.
const ADVISORY_RE = /\b(showAlert|pushAlert)\s*\([^)]*\b\w*(?:error|err|e)\.message\b/;

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (FILE_EXT_RE.test(entry.name)) files.push(full);
  }
  return files;
}

const isExempt = (relative) =>
  EXEMPT.has(relative) || EXEMPT_PREFIXES.some((p) => relative.startsWith(p));

// Strip line comments + block comments so a mention in prose doesn't trip us.
const strip = (line) => line.replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*?\*\//g, "");

const hardHits = []; // { file, line, text } — respecting the baseline
const listHits = new Map(); // file -> count (ignores baseline, for --list)
const advisories = [];

for (const rootRel of SEARCH_ROOTS) {
  for (const file of walk(path.join(ROOT, rootRel))) {
    const relative = rel(file);
    if (isExempt(relative)) continue;
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      const stripped = strip(line);
      for (const { re, label } of HARD_PATTERNS) {
        re.lastIndex = 0;
        if (re.test(stripped)) {
          listHits.set(relative, (listHits.get(relative) || 0) + 1);
          if (!BASELINE_ALLOWLIST.has(relative)) {
            hardHits.push({ where: `${relative}:${i + 1}`, label, text: line.trim().slice(0, 100) });
          }
          break;
        }
      }
      if (ADVISORY_RE.test(stripped)) {
        advisories.push(`${relative}:${i + 1}: raw error message piped into a toast — use reportError/reportApiError`);
      }
    });
  }
}

// --list: dump the authoritative hit list so the baseline can be shrunk.
if (LIST) {
  const sorted = [...listHits.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  console.log(`\nFiles with banned dialogs (${sorted.length}) — baseline should equal the not-yet-migrated subset:\n`);
  for (const [f, count] of sorted) {
    const state = BASELINE_ALLOWLIST.has(f) ? "baseline" : "ENFORCED";
    console.log(`  [${state}] ${f} (${count})`);
  }
  console.log("");
  process.exit(0);
}

// Stale-baseline hygiene: a baselined file that no longer has any hit should be
// removed from BASELINE_ALLOWLIST (it's been migrated) — warn so it gets cleaned.
const staleBaseline = [...BASELINE_ALLOWLIST].filter((f) => !listHits.has(f));
if (staleBaseline.length) {
  console.log(`\ncheck:feedback — ${staleBaseline.length} baseline entr${staleBaseline.length === 1 ? "y is" : "ies are"} now clean; remove from BASELINE_ALLOWLIST:`);
  for (const f of staleBaseline) console.log("  " + f);
  console.log("");
}

if (advisories.length) {
  console.log(`\nRaw technical message shown to a user (${advisories.length}) — advisory:`);
  for (const a of advisories.slice(0, 40)) console.log("  " + a);
  if (advisories.length > 40) console.log(`  …and ${advisories.length - 40} more`);
  console.log("  (route these through reportError/reportApiError so the raw message goes to devInfo.)\n");
}

if (hardHits.length) {
  console.error(`\nFeedback standard violations (${hardHits.length}) — banned browser dialog on a product surface:\n`);
  for (const h of hardHits) console.error(`  ${h.where}: ${h.text}`);
  console.error(
    "\nUse the Feedback helpers instead (src/lib/notifications/report.js):" +
      "\n  validation → inline <FieldError>/useFormValidation, or reportWarning(...)" +
      "\n  failure    → reportError(KEY, err, ctx) / reportApiError(err, ctx)" +
      "\n  success    → reportSuccess(...)   neutral → reportInfo(...)" +
      "\nIf this is a genuine non-product/native context, add it to EXEMPT in tools/scripts/check-feedback.js.\n"
  );
  process.exit(1);
}

if (STRICT && advisories.length) {
  console.error(`\n--strict: ${advisories.length} raw-message advisories treated as failures.\n`);
  process.exit(1);
}

console.log(
  `check:feedback passed — no banned dialogs outside the tracked baseline (${BASELINE_ALLOWLIST.size} files queued)` +
    (advisories.length ? `, ${advisories.length} advisory` : "") +
    "."
);
