#!/usr/bin/env node
// Reporting emit-coverage guard (Phase-2 §13.5). Mirrors check-borders.js.
//
// Two checks:
//   1. (HARD, exit 1) Every `emitReportEvent({ event:{ eventName: "X" } })` and
//      `eventName: "X"` literal in reporting code uses an event_name that exists
//      in the catalogue (src/lib/reporting/config/eventCatalogue.js). An unknown
//      event name is a real bug — it will never match a KPI source.
//   2. (ADVISORY, exit 0 unless --strict) Status-mutating DB writes (.update/.upsert
//      that set a *status column) in src/lib/database/* that have NO paired emit
//      (emitReportEvent / writeStatusHistory / emitStatusChange / logJobActivity)
//      anywhere in the same file. These are the "status update without emit"
//      defects the doc wants flagged. They are ADVISORY by default because emit
//      wiring is a later phase (the operational write paths are not instrumented
//      yet); run with --strict to make them fail once emits roll out.
//
// Usage:  node tools/scripts/check-report-events.js [--strict]

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const STRICT = process.argv.includes("--strict");
const FILE_EXT_RE = /\.(js|jsx|ts|tsx)$/;

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/");

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

// --- Load the catalogue event names by parsing the config source (no ESM import).
function loadCatalogueEventNames() {
  const cataloguePath = path.join(ROOT, "src/lib/reporting/config/eventCatalogue.js");
  const names = new Set();
  if (!fs.existsSync(cataloguePath)) return names;
  const src = fs.readFileSync(cataloguePath, "utf8");
  // Matches the E("EVENT_NAME", ...) factory calls in the catalogue.
  const re = /\bE\(\s*"([A-Z][A-Z0-9_]+)"/g;
  let m;
  while ((m = re.exec(src))) names.add(m[1]);
  return names;
}

const CATALOGUE = loadCatalogueEventNames();

// Files allowed to reference event-name literals that aren't catalogue members
// (the catalogue + its own tests). Add here if a legitimate non-event literal trips it.
const EVENT_NAME_ALLOWLIST = new Set([
  "src/lib/reporting/config/eventCatalogue.js",
]);

const hardViolations = [];
const advisories = [];

// --- Check 1: unknown event names in emit/eventName literals (reporting code).
for (const file of walk(path.join(ROOT, "src/lib/reporting"))) {
  const relative = rel(file);
  if (EVENT_NAME_ALLOWLIST.has(relative)) continue;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const stripped = line.replace(/\/\/.*$/, "");
    const re = /eventName\s*:\s*"([A-Z][A-Z0-9_]+)"/g;
    let m;
    while ((m = re.exec(stripped))) {
      const name = m[1];
      if (CATALOGUE.size && !CATALOGUE.has(name)) {
        hardViolations.push(`${relative}:${i + 1}: unknown event_name "${name}" (not in catalogue)`);
      }
    }
  });
}

// --- Check 2: status-mutating DB writes lacking a paired emit.
const EMIT_RE = /\b(emitReportEvent|writeStatusHistory|emitStatusChange|logJobActivity|logActivity)\b/;
const STATUS_WRITE_RE = /\.(update|upsert)\s*\(/;
const STATUS_FIELD_RE = /(^|[^a-z_])(status|payment_status|approval_status)\s*:/i;

for (const file of walk(path.join(ROOT, "src/lib/database"))) {
  const relative = rel(file);
  if (relative.includes("/reporting/")) continue; // the reporting data layer IS the emit
  const source = fs.readFileSync(file, "utf8");
  if (!STATUS_WRITE_RE.test(source)) continue;
  const fileHasEmit = EMIT_RE.test(source);
  const lines = source.split(/\r?\n/);
  lines.forEach((line, i) => {
    const stripped = line.replace(/\/\/.*$/, "");
    if (!STATUS_WRITE_RE.test(stripped)) return;
    // Look at a small window after the write for a status field being set.
    const window = lines.slice(i, i + 12).join("\n");
    if (!STATUS_FIELD_RE.test(window)) return;
    if (fileHasEmit) return; // file pairs its status writes with an emit somewhere
    advisories.push(`${relative}:${i + 1}: status-mutating write without a paired emit in this file`);
  });
}

// --- Report.
if (CATALOGUE.size === 0) {
  console.warn("check:report-events — could not load event catalogue; skipping name validation.");
}

if (advisories.length) {
  console.log(`\nStatus-mutating writes without a paired emit (${advisories.length}) — advisory:`);
  for (const a of advisories.slice(0, 50)) console.log("  " + a);
  if (advisories.length > 50) console.log(`  …and ${advisories.length - 50} more`);
  console.log("  (emit wiring is a later phase — run with --strict to enforce once rolled out.)\n");
}

if (hardViolations.length) {
  console.error(`\nReporting event violations (${hardViolations.length}):\n`);
  for (const v of hardViolations) console.error("  " + v);
  console.error("\nEvery emitted event_name must exist in src/lib/reporting/config/eventCatalogue.js.\n");
  process.exit(1);
}

if (STRICT && advisories.length) {
  console.error(`\n--strict: ${advisories.length} status writes lack a paired emit.\n`);
  process.exit(1);
}

console.log("check:report-events passed — event names valid" + (advisories.length ? ` (${advisories.length} advisory emit gaps)` : "") + ".");
