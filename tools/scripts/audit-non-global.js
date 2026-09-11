#!/usr/bin/env node
// Non-global UI audit.
//
// Finds staff UI that hand-rolls something staffglobal.css already owns: a
// button that is not .app-btn, an input that is not .app-input, a table off
// .app-data-table, a modal scrim that is not .popup-backdrop, and so on.
//
// It EMITS, it does not gate. `npm run check:design` / `check:layers` /
// `check:borders` are the ratchets that fail a build; this script exists so the
// "Non-Global" scope on /dev/user-diagnostic shows what the code actually does
// instead of a hand-kept register that goes stale. Same contract as
// check-symbols.js --emit-usage.
//
// Run:  node tools/scripts/audit-non-global.js [--print]
// Out:  src/lib/ui/nonGlobalUsage.generated.js

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const OUT = path.join(ROOT, "src", "lib", "ui", "nonGlobalUsage.generated.js");
const SEARCH_ROOTS = ["src/pages", "src/components", "src/features"];

// Out of scope for the staff design system.
//   /website + singlescroll  - custglobal.css, a separate design system (CLAUDE.md 3.0b)
//   dev tooling + showcase   - deliberately off-system, and would report itself
//   api routes + email       - transactional HTML, no stylesheet reaches it
const SKIP = [
  "src/pages/website",
  "src/pages/dev",
  "src/pages/api",
  "src/features/website",
  "src/features/websiteManager",
  "src/features/3Dwebsite",
  "src/features/presentation",
  "src/features/staffStyleReview",
  "src/singlescroll",
  "src/components/dev-layout-overlay",
  "src/components/dev-platform",
  "src/components/ui/variants.js",
  "src/components/ui/StaffShowcasePrimitives.js",
];

// Files that legitimately hand-roll a control: functional diagram primitives and
// the photo/video annotation editors draw their own surfaces, and the border
// check allowlists them for the same reason.
//
// The editors matter most for raw colours. Annotation ink is baked into the
// exported image, so it must NOT follow the accent: a red arrow drawn on a tyre
// photo has to stay red when the user switches theme. Those literals are the
// correct implementation, not debt, so reporting them would be noise.
const FUNCTIONAL_EXEMPT = [
  "src/components/VHC/TyreDiagram.js",
  "src/components/VHC/BrakeDiagram.js",
  "src/components/VHC/CarImage.js",
  "src/components/VHC/PhotoEditorModal.js",
  "src/components/VHC/VideoEditorModal.js",
  "src/components/ui/LoadingSkeleton.js",
];

// Directory-level equivalents of FUNCTIONAL_EXEMPT.
const FUNCTIONAL_EXEMPT_DIRS = [
  "src/components/VHC/photoEditor",
  "src/components/VHC/videoEditor",
];

function walk(dir, out = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (SKIP.some((s) => rel === s || rel.startsWith(`${s}/`))) continue;
    if (entry.isDirectory()) walk(rel, out);
    else if (/\.(js|jsx)$/.test(entry.name) && !/\.test\.js$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const JS_FILES = SEARCH_ROOTS.flatMap((r) => walk(r)).filter(
  (f) =>
    !FUNCTIONAL_EXEMPT.includes(f) &&
    !FUNCTIONAL_EXEMPT_DIRS.some((d) => f.startsWith(`${d}/`))
);

// Blank comments out (newlines preserved so line numbers stay true). Without
// this, a doc comment describing `<input type="date">` reads as a call site.
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p1) => p1 + m.slice(p1.length).replace(/./g, " "));
}

// Read a whole JSX open tag from `<tag`, aware of quotes and {expressions} so
// the `>` inside `onClick={() => x}` does not end the tag early.
function openTag(source, start) {
  let brace = 0;
  let quote = null;
  for (let i = start + 1; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (c === quote && source.charCodeAt(i - 1) !== 92) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") { brace++; continue; }
    if (c === "}") { brace--; continue; }
    if (brace === 0 && c === ">") return source.slice(start, i + 1);
  }
  return source.slice(start, start + 500);
}

function classNames(tag) {
  const m = tag.match(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{([^}]*)\})/);
  return m ? m.slice(1).filter(Boolean).join(" ") : "";
}

// True when `index` falls inside a template literal. Print/preview and email
// builders assemble raw HTML in backticks — `<table>`, `<button style="...">` —
// which no stylesheet reaches, so it is not staff UI drift. Counting an odd
// number of unescaped backticks before the position is crude but reliable here:
// these files build documents, they do not nest template literals inside JSX
// attributes at the same spot.
function insideTemplateLiteral(source, index) {
  let ticks = 0;
  for (let i = 0; i < index; i++) {
    if (source[i] === "`" && source.charCodeAt(i - 1) !== 92) ticks++;
  }
  return ticks % 2 === 1;
}

const sources = new Map();
function read(file) {
  if (!sources.has(file)) sources.set(file, stripComments(fs.readFileSync(path.join(ROOT, file), "utf8")));
  return sources.get(file);
}

// Count matches of a JSX tag that satisfy `test`, per file.
function scanTag(tag, test) {
  const hits = new Map();
  const re = new RegExp(`<${tag}(?![A-Za-z0-9_])`, "g");
  for (const file of JS_FILES) {
    const src = read(file);
    let m;
    re.lastIndex = 0;
    let n = 0;
    while ((m = re.exec(src))) {
      if (insideTemplateLiteral(src, m.index)) continue;
      if (test(openTag(src, m.index), src)) n++;
    }
    if (n) hits.set(file, n);
  }
  return hits;
}

// Count regex matches per file.
function scanRe(re) {
  const hits = new Map();
  for (const file of JS_FILES) {
    const src = read(file);
    let m;
    const rx = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let n = 0;
    while ((m = rx.exec(src))) if (!insideTemplateLiteral(src, m.index)) n++;
    if (n) hits.set(file, n);
  }
  return hits;
}

// ── Detectors ──────────────────────────────────────────────────────────────
const CONTROL_FAMILY_CLASS =
  /app-btn|app-symbol-btn|app-table-action-btn|app-tab|tab-api|dropdown-api|searchbar-api|calendar-api|monthpicker-api|timepicker-api|app-toggle|app-empty-state__action/;

const DETECTORS = {
  "non-global-buttons": {
    title: "buttons carrying their own fill / radius / type instead of .app-btn",
    run: () =>
      scanTag("button", (t) => {
        if (CONTROL_FAMILY_CLASS.test(classNames(t))) return false;
        return /style=\{\{[\s\S]{0,600}?(background|border|color|padding|fontSize|fontWeight|borderRadius)/.test(t);
      }),
  },
  "non-global-inputs": {
    title: "text inputs and textareas that are not .app-input",
    run: () => {
      const inputs = scanTag("input", (t) => {
        if (/type=(?:"|\{")(?:checkbox|radio|file|hidden|range|color)/.test(t)) return false;
        return !/app-input|searchbar-api|calendar-api|app-toggle/.test(classNames(t));
      });
      const areas = scanTag("textarea", (t) => !/app-input|app-textarea/.test(classNames(t)));
      for (const [f, n] of areas) inputs.set(f, (inputs.get(f) || 0) + n);
      return inputs;
    },
  },
  "non-global-form-labels": {
    title: "form labels styled locally — there is no label primitive to use",
    run: () => scanRe(/<label\s+style=\{\{/g),
  },
  "non-global-selects": {
    title: "raw <select> in staff UI (CLAUDE.md 3.4a: must be DropdownField)",
    run: () => scanTag("select", () => true),
  },
  "non-global-tables": {
    title: "tables that do not carry .app-data-table",
    run: () => scanTag("table", (t) => !/app-data-table|table-api/.test(classNames(t))),
  },
  "non-global-badges": {
    title: "pill-shaped status chips built inline instead of .app-badge",
    run: () =>
      scanTag("span", (t) => {
        if (/app-badge/.test(classNames(t))) return false;
        return /radius-pill|borderRadius:\s*"999/.test(t) && /background/i.test(t);
      }),
  },
  "non-global-modals": {
    title: "modal scrims painted by hand instead of .popup-backdrop",
    // A fixed, full-bleed element with its own translucent black/navy fill is a
    // backdrop. .popup-backdrop is the only one with the accent tint and blur.
    run: () =>
      scanRe(
        /position:\s*"fixed"[\s\S]{0,240}?background(?:Color)?:\s*"rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,/g
      ),
  },
  "non-global-colours": {
    // What survives here is the recorded-on-purpose set from migration pass 1
    // (governance doc 7.6): status dots with no matching token yet, and the
    // accent fallback literals that three components duplicate. Not new drift —
    // each one needs a token decision before it can move.
    title: "hex colour literals with no token to move to yet",
    run: () => scanRe(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g),
  },
};

// Tab systems are counted by consumer, not by occurrence: the question is how
// many pages each competing implementation still owns.
function tabSystems() {
  const count = (re) => JS_FILES.filter((f) => re.test(read(f))).length;
  return [
    { label: `TabGroup / .tab-api — dominant (${count(/TabGroup|tab-api/)} files)`, file: "src/components/ui/tabAPI/TabGroup.js" },
    { label: `.app-tab--* — second base (${count(/app-tab--/)} files)`, file: "src/styles/families/tabs.css" },
    { label: `StaffTabs / .app-staff-tabs — third (${count(/app-staff-tabs|StaffTabs/)} files)`, file: "src/styles/staffglobal.css" },
  ];
}

// Stylesheets outside the family system that declare their own surfaces.
function moduleStylesheets() {
  const out = [];
  const seen = new Set();
  for (const root of ["src/components", "src/features"]) {
    const stack = [root];
    while (stack.length) {
      const dir = stack.pop();
      const abs = path.join(ROOT, dir);
      if (!fs.existsSync(abs)) continue;
      for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (SKIP.some((s) => rel === s || rel.startsWith(`${s}/`))) continue;
        if (e.isDirectory()) stack.push(rel);
        else if (e.name.endsWith(".module.css") && !seen.has(rel)) {
          seen.add(rel);
          const css = fs.readFileSync(path.join(ROOT, rel), "utf8");
          const rules = (css.match(/\{/g) || []).length;
          const surfaces = (css.match(/^\s*(background|border-radius|box-shadow)\s*:/gm) || []).length;
          if (surfaces) out.push({ label: `${rel.split("/").pop()} — ${rules} rules, ${surfaces} surface declarations`, file: rel, count: surfaces });
        }
      }
    }
  }
  return out.sort((a, b) => b.count - a.count);
}

// ── Build ──────────────────────────────────────────────────────────────────
function label(file, count) {
  const name = file.split("/").pop().replace(/\.jsx?$/, "");
  const folder = file.split("/").slice(-2, -1)[0];
  return `${name} (${folder}) — ${count}`;
}

const ROUTE_FOR = (file) => {
  const m = file.match(/^src\/pages\/(.+)\.jsx?$/);
  if (!m) return undefined;
  const r = `/${m[1].replace(/\/index$/, "")}`;
  return r.includes("[") ? undefined : r;
};

const audit = {};
for (const [key, det] of Object.entries(DETECTORS)) {
  const hits = [...det.run()].sort((a, b) => b[1] - a[1]);
  audit[key] = {
    title: det.title,
    total: hits.reduce((s, h) => s + h[1], 0),
    files: hits.length,
    usage: hits.slice(0, 10).map(([file, count]) => {
      const entry = { label: label(file, count), file };
      const route = ROUTE_FOR(file);
      if (route) entry.route = route;
      return entry;
    }),
  };
}

const tabs = tabSystems();
audit["non-global-tabs"] = {
  title: "three tab implementations still live side by side",
  total: 3,
  files: 3,
  usage: tabs,
};

const modules = moduleStylesheets();
audit["non-global-stylesheets"] = {
  title: "CSS Modules declaring surfaces outside the family system",
  total: modules.reduce((s, m) => s + m.count, 0),
  files: modules.length,
  usage: modules.slice(0, 10).map(({ label: l, file }) => ({ label: l, file })),
};

const banner = `// GENERATED FILE — do not edit by hand.
// Written by tools/scripts/audit-non-global.js (npm run audit:non-global),
// which runs in predev/prebuild.
//
// Each entry is one "Non-Global" showcase on /dev/user-diagnostic: staff UI
// that hand-rolls something staffglobal.css already owns. The counts are read
// out of the code on every dev/build, so the page cannot drift from reality the
// way a hand-kept register does.
//
// This is a REPORT, not a gate. The ratchets that fail a build are
// check:design, check:layers and check:borders.
`;

const body = Object.entries(audit)
  .map(([key, v]) => {
    const usage = v.usage
      .map((u) => `      { label: ${JSON.stringify(u.label)}, file: ${JSON.stringify(u.file)}${u.route ? `, route: ${JSON.stringify(u.route)}` : ""} },`)
      .join("\n");
    return `  ${JSON.stringify(key)}: {
    title: ${JSON.stringify(v.title)},
    total: ${v.total},
    files: ${v.files},
    usage: [
${usage}
    ],
  },`;
  })
  .join("\n");

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${banner}export const NON_GLOBAL_AUDIT = {\n${body}\n};\n`);

const scanned = JS_FILES.length;
const totals = Object.entries(audit).map(([k, v]) => `${k.replace("non-global-", "")}: ${v.total}`);
console.log(`[audit-non-global] scanned ${scanned} staff files -> ${path.relative(ROOT, OUT).replace(/\\/g, "/")}`);
console.log(`[audit-non-global] ${totals.join(", ")}`);

if (process.argv.includes("--print")) {
  for (const [key, v] of Object.entries(audit)) {
    console.log(`\n${key} — ${v.title}\n  ${v.total} in ${v.files} files`);
    v.usage.forEach((u) => console.log(`    ${u.file}`));
  }
}
