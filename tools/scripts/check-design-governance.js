#!/usr/bin/env node
// file location: tools/scripts/check-design-governance.js
//
// Staff design-governance guard.
//
// SCOPE OF THIS TOOL
// ------------------
// This script is deliberately NON-VISUAL. It reads the repository and records
// what the staff design system looks like today; it does not change the CSS
// cascade, does not move rules between files, and does not make any existing
// implementation inherit different styling. Whatever the staff UI renders right
// now IS the reference. Where that reference contains legacy or inconsistent
// styling, it is recorded as baselined debt, not corrected.
//
// It covers every staff-facing route. /website is excluded on purpose: the
// customer design system lives in src/styles/custglobal.css and is governed
// separately.
//
// WHAT IT DOES
//   - Pins which existing files and components are canonical (rule 1).
//   - Keeps the staff and customer design systems isolated (rule 2).
//   - Keeps the other design checks covering all staff code (rule 3).
//   - Ratchets five categories of drift so nothing NEW is introduced (4-8).
//
// Rules:
//
//   1. canonical-manifest   HARD    - the canonical token source, global sheet,
//                                     family files and family manifest must all
//                                     exist and stay wired together.
//   2. website-isolation    HARD    - staff stylesheets must not style
//                                     html.website-scope, custglobal.css must
//                                     not style html.staff-scope, and neither
//                                     may import the other.
//   3. check-coverage       HARD    - the other design checks must keep
//                                     scanning src/components, src/features
//                                     and src/pages.
//   4. family-ownership     RATCHET - a canonical family class declared outside
//                                     its family file. Everything declared in
//                                     staffglobal.css today is baselined; the
//                                     rule only blocks NEW locations.
//   5. important-budget     RATCHET - !important count per staff stylesheet.
//   6. undefined-tokens     RATCHET - var(--x) with no definition anywhere.
//   7. raw-colours          RATCHET - hex colour literals in staff UI code.
//   8. one-off-styling      RATCHET - inline style objects in staff JSX that
//                                     set governed visual properties.
//
// RATCHET rules read tools/design-baselines/design-governance.json. A count may
// fall (run --update to record the improvement) but never rise. A file with no
// baseline entry is held to zero, so new drift fails immediately while existing
// debt is left exactly as it is.
//
// Usage:
//   node tools/scripts/check-design-governance.js              # enforce
//   node tools/scripts/check-design-governance.js --list       # show all hits
//   node tools/scripts/check-design-governance.js --update     # lock in wins
//   node tools/scripts/check-design-governance.js --accept-new # re-baseline

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const BASELINE_PATH = path.join(ROOT, "tools/design-baselines/design-governance.json");
const ARGS = new Set(process.argv.slice(2));
const LIST = ARGS.has("--list");
const UPDATE = ARGS.has("--update");
const ACCEPT_NEW = ARGS.has("--accept-new");

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------
const SEARCH_ROOTS = ["src"];
// /website has its own design system (custglobal.css). singlescroll is the
// customer marketing scroller and rides on the same customer tokens.
const EXCLUDED = [
  "src/pages/website/",
  "src/features/website/",
  "src/singlescroll/",
  "src/styles/custglobal.css",
  "node_modules",
];

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full).split(path.sep).join("/");
    if (EXCLUDED.some((p) => rel.startsWith(p))) continue;
    if (entry.isDirectory()) walk(full, out);
    else out.push(rel);
  }
  return out;
}

const ALL_FILES = SEARCH_ROOTS.flatMap((r) => walk(path.join(ROOT, r), []));
const CSS_FILES = ALL_FILES.filter((f) => f.endsWith(".css") && !f.endsWith(".module.css"));
const JS_FILES = ALL_FILES.filter(
  (f) => /\.(js|jsx|ts|tsx)$/.test(f) && !/\.test\.(js|jsx|ts|tsx)$/.test(f)
);
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const stripCssComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

// ---------------------------------------------------------------------------
// Rule 1 - canonical manifest (HARD)
// ---------------------------------------------------------------------------
// This is how the system declares "these existing files are the canonical
// implementation". It asserts wiring only; it never asserts content.
const CANONICAL = {
  tokens: "src/styles/theme.css",
  staffGlobal: "src/styles/staffglobal.css",
  familyIndex: "src/styles/families/index.css",
  familyManifest: "src/components/ui/variants.js",
  customerGlobal: "src/styles/custglobal.css",
  appEntry: "src/pages/_app.js",
};

// Family stylesheets that ship today without a UI_FAMILIES entry. This set may
// only shrink - see the note in checkCanonicalManifest().
const UNREGISTERED_FAMILY_BASELINE = new Set(["src/styles/families/forms.css"]);

function checkCanonicalManifest() {
  const problems = [];
  for (const [name, file] of Object.entries(CANONICAL)) {
    if (!exists(file)) problems.push(`${file}: canonical ${name} source is missing.`);
  }
  if (problems.length) return problems;

  const app = read(CANONICAL.appEntry);
  for (const required of [CANONICAL.tokens, CANONICAL.staffGlobal, CANONICAL.customerGlobal]) {
    const alias = "@/" + required.replace(/^src\//, "");
    if (!app.includes(alias)) {
      problems.push(`${CANONICAL.appEntry}: must import ${alias} - it is a canonical stylesheet.`);
    }
  }

  const staff = read(CANONICAL.staffGlobal);
  if (!/@import\s+"\.\/families\/index\.css";/.test(staff)) {
    problems.push(`${CANONICAL.staffGlobal}: must import ./families/index.css so every family file loads.`);
  }

  // Every family declared in variants.js must have a real, imported css file.
  const manifest = read(CANONICAL.familyManifest);
  const index = read(CANONICAL.familyIndex);
  const declaredFiles = [...manifest.matchAll(/cssFile:\s*"([^"]+)"/g)].map((m) => m[1]);
  if (!declaredFiles.length) {
    problems.push(`${CANONICAL.familyManifest}: no cssFile entries found - the family manifest is the canonical registry.`);
  }
  for (const file of declaredFiles) {
    if (!exists(file)) {
      problems.push(`${CANONICAL.familyManifest}: declares ${file}, which does not exist.`);
      continue;
    }
    const base = "./" + path.basename(file);
    if (!index.includes(`@import "${base}"`)) {
      problems.push(`${CANONICAL.familyIndex}: does not import ${base}, but ${CANONICAL.familyManifest} declares it canonical.`);
    }
  }

  // Every family file on disk must be registered, so a NEW one cannot appear
  // outside the manifest.
  //
  // Pre-existing gap, deliberately baselined rather than corrected: forms.css
  // (the Frontend Feedback System validation family) ships and is imported by
  // families/index.css, but was never added to UI_FAMILIES. Registering it
  // would add a section to the /dev/user-diagnostic showcase - a visual change
  // to a staff route - so it is recorded here instead. Register it in a later
  // pass that is allowed to change what that page renders.
  for (const file of CSS_FILES.filter((f) => f.startsWith("src/styles/families/"))) {
    if (file === CANONICAL.familyIndex) continue;
    if (UNREGISTERED_FAMILY_BASELINE.has(file)) continue;
    if (!declaredFiles.includes(file)) {
      problems.push(`${file}: family stylesheet is not registered in ${CANONICAL.familyManifest}. Add it to UI_FAMILIES or remove the file.`);
    }
  }
  // Keep the baseline honest: if the gap is closed, drop the entry.
  for (const file of UNREGISTERED_FAMILY_BASELINE) {
    if (declaredFiles.includes(file)) {
      problems.push(`${file}: now registered in ${CANONICAL.familyManifest}. Remove it from UNREGISTERED_FAMILY_BASELINE.`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Rule 2 - staff / customer isolation (HARD)
// ---------------------------------------------------------------------------
const STAFF_STYLESHEETS = () =>
  CSS_FILES.filter((f) => f.startsWith("src/styles/") && f !== CANONICAL.customerGlobal);

function checkWebsiteIsolation() {
  const problems = [];
  const customer = stripCssComments(read(CANONICAL.customerGlobal));
  if (/html\.staff-scope/.test(customer)) {
    problems.push(`${CANONICAL.customerGlobal}: must not style html.staff-scope. The customer design system is separate.`);
  }
  if (/@import\s+["'][^"']*staffglobal/.test(customer) || /@import\s+["'][^"']*families\//.test(customer)) {
    problems.push(`${CANONICAL.customerGlobal}: must not import staff stylesheets.`);
  }
  for (const file of STAFF_STYLESHEETS()) {
    const css = stripCssComments(read(file));
    if (/html\.website-scope/.test(css)) {
      problems.push(`${file}: staff stylesheets must not style html.website-scope. Put customer rules in custglobal.css.`);
    }
    if (/@import\s+["'][^"']*custglobal/.test(css)) {
      problems.push(`${file}: must not import custglobal.css.`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Rule 3 - the other design checks must keep covering components + features
// ---------------------------------------------------------------------------
const COVERAGE_REQUIRED = ["src/components", "src/features", "src/pages"];
const COVERAGE_SCRIPTS = ["tools/scripts/check-staff-controls.js", "tools/scripts/check-dropdowns.js"];

function checkCoverage() {
  const problems = [];
  for (const script of COVERAGE_SCRIPTS) {
    const text = read(script);
    const block = text.match(/const SEARCH_ROOTS = \[([\s\S]*?)\];/);
    if (!block) {
      problems.push(`${script}: SEARCH_ROOTS not found.`);
      continue;
    }
    for (const required of COVERAGE_REQUIRED) {
      if (!block[1].includes(`"${required}"`)) {
        problems.push(`${script}: SEARCH_ROOTS must include "${required}" so every staff component and feature is covered.`);
      }
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Rule 4 - family ownership (RATCHET)
// ---------------------------------------------------------------------------
// Declares the intended home for each family class. Most of these rules still
// physically live in staffglobal.css; that is recorded in the baseline and left
// alone. The ratchet exists so a THIRD location cannot appear.
const FAMILY_OWNERS = [
  [/\.app-btn(?![\w-])|\.app-btn--/, "src/styles/families/buttons.css"],
  [/\.app-badge/, "src/styles/families/badges.css"], // covers --variants and the .app-badge-slot companion
  [/\.app-data-table|\.app-table-action-btn|\.app-table-shell/, "src/styles/families/tables.css"],
  [/\.app-input(?![\w-])|\.app-input--/, ["src/styles/families/inputs.css", "src/styles/families/forms.css"]],
  [/\.app-field-error|\.app-field-hint|\.app-form-summary/, "src/styles/families/forms.css"],
  [/\.app-modal|\.app-drawer/, "src/styles/families/modals.css"],
  [/\.app-alert|\.app-toast/, "src/styles/families/toasts.css"],
  [/\.app-empty-state/, "src/styles/families/empty-states.css"],
  [/\.app-toggle/, "src/styles/families/toggles.css"],
  [/\.app-tab(?![\w-])|\.app-tab--|\.tab-api/, "src/styles/families/tabs.css"],
  [/\.app-toolbar|\.app-layout-toolbar-row/, "src/styles/families/toolbars.css"],
  [/\.dropdown-api|\.app-dropdown/, "src/styles/families/dropdowns.css"],
  [/\.skeleton-block/, "src/styles/families/loaders.css"],
  [/\.app-page-card|\.app-section-card|\.app-layout-surface|\.app-layout-stat-card/, "src/styles/families/cards.css"],
];

function selectorsOf(css) {
  return [...stripCssComments(css).matchAll(/([^{}]+)\{/g)]
    .map((m) => m[1].replace(/\s+/g, " ").trim())
    .filter((s) => s && !s.startsWith("@"));
}

// Selector + declaration block, so family-ownership can tell a visual
// declaration from a layout-only one.
function rulesOf(css) {
  return [...stripCssComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((m) => ({
      selector: m[1].replace(/\s+/g, " ").trim(),
      body: m[2],
    }))
    .filter((r) => r.selector && !r.selector.startsWith("@"));
}

// Properties that define how a family LOOKS. A rule setting none of these is
// positioning an existing component, not restyling it.
const FAMILY_VISUAL_PROP_RE =
  /(^|[;\s])(background|background-[a-z-]+|color|border|border-[a-z-]+|box-shadow|font|font-[a-z-]+|letter-spacing|text-transform|text-decoration|padding|padding-[a-z-]+|opacity|filter|outline|outline-[a-z-]+)\s*:/;

function collectFamilyOwnership() {
  const hits = new Map();
  const detail = new Map();
  for (const file of CSS_FILES) {
    for (const { selector, body } of rulesOf(read(file))) {
      // Dev-overlay trace selectors classify elements; they do not define a
      // family's appearance.
      if (/data-dev-overlay|data-dev-section/.test(selector)) continue;
      // Layout-only rules position a component; they do not redefine it.
      if (!FAMILY_VISUAL_PROP_RE.test(body)) continue;
      for (const [re, owner] of FAMILY_OWNERS) {
        const owners = Array.isArray(owner) ? owner : [owner];
        if (re.test(selector) && !owners.includes(file)) {
          hits.set(file, (hits.get(file) || 0) + 1);
          if (!detail.has(file)) detail.set(file, []);
          detail.get(file).push(selector.slice(0, 110));
          break;
        }
      }
    }
  }
  return { hits, detail };
}

// ---------------------------------------------------------------------------
// Rule 5 - !important budget (RATCHET)
// ---------------------------------------------------------------------------
function collectImportant() {
  const hits = new Map();
  for (const file of CSS_FILES) {
    const count = (stripCssComments(read(file)).match(/!important/g) || []).length;
    if (count) hits.set(file, count);
  }
  return { hits, detail: new Map() };
}

// ---------------------------------------------------------------------------
// Rule 6 - undefined token references (RATCHET)
// ---------------------------------------------------------------------------
// Several token names are referenced across shipped staff code but have no
// definition anywhere, so the var() silently falls through to its fallback.
// They are recorded here rather than defined, because defining one would change
// what those elements render.
// A handful of tokens are legitimately DEFINED AT RUNTIME from JS, as an inline
// custom property on a wrapper element, and consumed from CSS. They are real
// definitions - the checker just cannot see them in a stylesheet. Each entry
// names the component that owns the token so the pairing stays auditable. This
// list may only shrink.
const RUNTIME_TOKEN_SOURCES = [
  "src/pages/_app.js", // --font-inter, pinned to :root from next/font
  "src/components/layout/StaffLayout.js", // --portrait-sidebar-top
  "src/components/VHC/VideoEditorModal.js", // --video-editor-max-width / -aspect-ratio
  "src/components/ui/StaffCardGrid.js", // --app-card-grid-min
  "src/components/StatusTracking/JobProgressTracker.js", // --job-tracker-phase-color
];

// var(--radius-<size>) template literals compose the token name at runtime, so
// the literal prefix left in the source is not a real reference.
const DYNAMIC_TOKEN_REF_RE = /^var\(\s*--[A-Za-z0-9-]*\$\{/;

function collectUndefinedTokens() {
  const defined = new Set();
  const tokenSources = [
    "src/styles/theme.css",
    "src/styles/staffglobal.css",
    "src/styles/features/vhc.css",
    "src/styles/themeRuntime.js",
    "src/styles/themeProvider.js",
    "src/styles/appTheme.js",
    ...CSS_FILES.filter((f) => f.startsWith("src/styles/families/")),
  ];
  for (const file of tokenSources) {
    if (!exists(file)) continue;
    for (const m of read(file).matchAll(/(--[A-Za-z0-9-]+)\s*:/g)) defined.add(m[1]);
  }
  for (const file of RUNTIME_TOKEN_SOURCES) {
    if (!exists(file)) continue;
    // Quoted keys only - i.e. an inline style object setting a custom property.
    for (const m of read(file).matchAll(/"?(--[A-Za-z0-9-]+)"?\s*:/g)) defined.add(m[1]);
  }
  const hits = new Map();
  const detail = new Map();
  for (const file of [...CSS_FILES, ...JS_FILES]) {
    const raw = read(file);
    const text = file.endsWith(".css") ? stripCssComments(raw) : raw;
    // Tokens a file sets itself (inline style vars, local scopes) are fine.
    const local = new Set([...text.matchAll(/(--[A-Za-z0-9-]+)"?\s*:/g)].map((m) => m[1]));
    const missing = [...text.matchAll(/var\(\s*(--[A-Za-z0-9-]+)/g)]
      .filter((m) => !DYNAMIC_TOKEN_REF_RE.test(text.slice(m.index, m.index + m[0].length + 2)))
      .map((m) => m[1])
      .filter((t) => !defined.has(t) && !local.has(t));
    if (!missing.length) continue;
    hits.set(file, missing.length);
    detail.set(file, [...new Set(missing)]);
  }
  return { hits, detail };
}

// ---------------------------------------------------------------------------
// Rule 7 - raw colour literals in staff UI code (RATCHET)
// ---------------------------------------------------------------------------
const HEX_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
// Not part of the product surface: trace-mode swatches, dev overlays, drawing
// primitives and email templates. Applies to BOTH raw-colours and
// one-off-styling.
const VISUAL_EXEMPT = [
  "src/styles/families/",
  "src/styles/theme.css",
  "src/lib/dev-layout/",
  "src/lib/email/",
  "src/components/dev-layout-overlay/",
  "src/components/dev-platform/",
  "src/features/presentation/",
  "src/features/tracking/map/",
  "src/pages/dev/",
  "src/components/ui/variants.js",
];

// Additionally exempt from raw-colours ONLY: contexts where a colour literal is
// the only thing that CAN work. These files still have their inline styling
// governed - the exemption is about the colour value, not about layout or
// visual styling. Each entry needs a reason; this is not a place to park debt.
const RAW_COLOUR_EXEMPT = [
  ...VISUAL_EXEMPT,
  // A token source: emitting colour literals is its job.
  "src/styles/themeRuntime.js",
  // The pre-hydration theme bootstrap runs before any stylesheet exists, so it
  // has to carry the palette as literals.
  "src/pages/_document.js",
  // Transactional email HTML. Email clients do not support custom properties,
  // so every colour must be inlined as a literal.
  "src/lib/support/supportReportEmail.js",
  "src/pages/api/",
  // WebGL / three.js materials. A CSS variable cannot reach a shader.
  "src/features/3Dwebsite/",
  // Canvas 2D drawing surfaces (photo/video annotation, screen recording).
  // The canvas API takes colour strings, not custom properties. This is the
  // same set tools/scripts/check-borders.js allowlists as functional primitives.
  "src/components/VHC/photoEditor/",
  "src/components/VHC/videoEditor/",
  "src/components/VHC/mediaCapture/",
];

function collectRawColours() {
  const hits = new Map();
  const detail = new Map();
  for (const file of [...CSS_FILES, ...JS_FILES]) {
    if (RAW_COLOUR_EXEMPT.some((p) => file.startsWith(p))) continue;
    const matches = [...read(file).matchAll(HEX_RE)];
    if (!matches.length) continue;
    hits.set(file, matches.length);
    detail.set(file, [...new Set(matches.map((m) => m[0]))].slice(0, 8));
  }
  return { hits, detail };
}

// ---------------------------------------------------------------------------
// Rule 8 - one-off inline styling in staff JSX (RATCHET)
// ---------------------------------------------------------------------------
// The governed visual properties. Layout-only keys (display, flex, gap, grid,
// width, position, overflow, zIndex, ...) are NOT counted: they are legitimate
// per-instance layout, not a competing visual implementation.
const GOVERNED_STYLE_KEYS = [
  "background",
  "backgroundColor",
  "backgroundImage",
  "color",
  "border",
  "borderRadius",
  "borderColor",
  "boxShadow",
  "fontSize",
  "fontWeight",
  "fontFamily",
  "letterSpacing",
  "textTransform",
  "padding",
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
];
const STYLE_PROP_RE = /style=\{\{([\s\S]{0,600}?)\}\}/g;
const GOVERNED_KEY_RE = new RegExp(`\\b(${GOVERNED_STYLE_KEYS.join("|")})\\s*:`, "g");

function collectOneOffStyling() {
  const hits = new Map();
  const detail = new Map();
  for (const file of JS_FILES) {
    if (VISUAL_EXEMPT.some((p) => file.startsWith(p))) continue;
    // Keep the bounded style scan deterministic across Windows and Linux.
    const text = read(file).replace(/\r?\n/g, "\r\n");
    let count = 0;
    const keys = new Set();
    for (const match of text.matchAll(STYLE_PROP_RE)) {
      const body = match[1];
      const governed = [...body.matchAll(GOVERNED_KEY_RE)].map((m) => m[1]);
      if (!governed.length) continue;
      count += governed.length;
      governed.forEach((k) => keys.add(k));
    }
    if (!count) continue;
    hits.set(file, count);
    detail.set(file, [...keys].slice(0, 8));
  }
  return { hits, detail };
}

// ---------------------------------------------------------------------------
// Ratchet plumbing
// ---------------------------------------------------------------------------
const RATCHETS = [
  [
    "family-ownership",
    collectFamilyOwnership,
    "declaration(s) of a canonical family class outside its family file. Existing locations are baselined - do not add a new one.",
  ],
  [
    "important-budget",
    collectImportant,
    "!important declaration(s). The budget only goes down.",
  ],
  [
    "undefined-tokens",
    collectUndefinedTokens,
    "var(--token) reference(s) with no definition anywhere. Use a token that exists in theme.css.",
  ],
  [
    "raw-colours",
    collectRawColours,
    "raw hex colour literal(s). Staff UI colour must come from a token in theme.css.",
  ],
  [
    "one-off-styling",
    collectOneOffStyling,
    "inline style(s) setting a governed visual property. Use the shared component or its canonical class instead.",
  ],
];

let baseline = {};
try {
  baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
} catch {
  baseline = {};
}

const failures = [];
const improvements = [];
const nextBaseline = {};
const listing = [];

for (const [id, collect, advice] of RATCHETS) {
  const { hits, detail } = collect();
  const recorded = baseline[id] || {};
  const observed = Object.fromEntries([...hits.entries()].sort((a, b) => b[1] - a[1]));
  nextBaseline[id] = observed;

  if (LIST) {
    const files = Object.keys(observed).length;
    const total = Object.values(observed).reduce((a, b) => a + b, 0);
    listing.push(`\n=== ${id} (${files} files, ${total} hits) ===`);
    for (const [file, count] of Object.entries(observed)) {
      const d = detail.get(file);
      listing.push(`  ${String(count).padStart(4)}  ${file}${d && d.length ? `\n          ${d.slice(0, 6).join(", ")}` : ""}`);
    }
    continue;
  }
  if (ACCEPT_NEW) continue;

  for (const [file, count] of Object.entries(observed)) {
    const allowed = recorded[file];
    if (allowed === undefined) {
      failures.push(`[${id}] ${file}: ${count} new ${advice}`);
    } else if (count > allowed) {
      failures.push(`[${id}] ${file}: ${count} (baseline ${allowed}) ${advice}`);
    }
  }
  for (const [file, allowed] of Object.entries(recorded)) {
    const count = observed[file] ?? 0;
    if (count < allowed) improvements.push(`[${id}] ${file}: ${allowed} -> ${count}`);
  }
}

if (LIST) {
  console.log(listing.join("\n"));
  process.exit(0);
}

if (UPDATE || ACCEPT_NEW) {
  if (UPDATE) {
    for (const [id, files] of Object.entries(nextBaseline)) {
      for (const [file, count] of Object.entries(files)) {
        const prev = baseline[id] && baseline[id][file];
        if (prev === undefined) {
          console.error(`Refusing to add a new ${id} baseline entry for ${file}. Fix the drift, or use --accept-new for a deliberate re-baseline.`);
          process.exit(1);
        }
        if (count > prev) {
          console.error(`Refusing to raise the ${id} baseline for ${file} (${prev} -> ${count}). Fix the drift instead.`);
          process.exit(1);
        }
      }
    }
  }
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(nextBaseline, null, 2)}\n`, "utf8");
  console.log("Design governance baseline written to tools/design-baselines/design-governance.json.");
  process.exit(0);
}

const hardProblems = [...checkCanonicalManifest(), ...checkWebsiteIsolation(), ...checkCoverage()];

if (hardProblems.length) {
  console.error("\nDesign governance FAILED - canonical wiring / isolation / coverage broken:\n");
  hardProblems.forEach((p) => console.error(`  ${p}`));
}
if (failures.length) {
  console.error(`\nDesign governance FAILED - ${failures.length} ratchet violation(s):\n`);
  failures.slice(0, 60).forEach((f) => console.error(`  ${f}`));
  if (failures.length > 60) {
    console.error(`  ...and ${failures.length - 60} more. Run with --list for the full picture.`);
  }
}
if (hardProblems.length || failures.length) {
  console.error("\nSee docs/ui/staff-design-governance.md. Baselines may only go down.\n");
  process.exit(1);
}

if (improvements.length) {
  console.log(`Design governance improved in ${improvements.length} place(s):`);
  improvements.slice(0, 20).forEach((i) => console.log(`  ${i}`));
  console.log("Run `npm run check:design:update` to lock these in.\n");
}

const totals = RATCHETS.map(([id]) => `${id}: ${Object.values(nextBaseline[id]).reduce((a, b) => a + b, 0)}`).join(", ");
console.log(`Design governance check passed. Tracked legacy debt - ${totals}.`);
