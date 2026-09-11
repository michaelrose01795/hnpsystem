#!/usr/bin/env node
// Symbol guard + usage index.
//
// Two jobs, one scan, because they answer the same question — "where are the
// icon-only buttons?":
//
//   1. GUARD (default). Every icon-only button in staff UI must be
//      <SymbolButton> / .app-symbol-btn, so a "delete" is the same 44px circle
//      with the same mark wherever it appears. Hand-rolled glyph buttons (an
//      emoji, a bare "x", a one-off inline <svg> in a <button>) are held to a
//      per-file baseline: existing ones are tolerated so they can be migrated
//      over time, new ones fail the build. A file with no baseline entry is
//      held to zero.
//
//   2. INDEX (--emit-usage). Writes src/lib/ui/symbolUsage.generated.js, the
//      list of every file that actually uses the symbol family. The
//      "Symbols (.app-symbol-btn)" showcase on /dev/user-diagnostic reads it,
//      so the "Where used" popup stays right on its own instead of being a
//      hand-kept list that rots the first time someone adds a button.
//
// Run: node tools/scripts/check-symbols.js [--emit-usage] [--print-baseline]

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SEARCH_ROOTS = ["src/components", "src/features", "src/pages"];
const FILE_EXT_RE = /\.(js|jsx|ts|tsx)$/;
const USAGE_OUT = path.join(ROOT, "src", "lib", "ui", "symbolUsage.generated.js");

// /website is the customer design system (custglobal.css, html.website-scope).
// .app-symbol-btn is staff-scoped, so the two must not meet — CLAUDE.md §3.0b.
const EXCLUDED_PREFIXES = [
  "src/pages/website/",
  "src/features/website/",
  "src/features/3Dwebsite/",
];

// Files whose icon buttons are deliberately NOT the symbol circle, with the
// reason. These are surfaces the symbol fill cannot sit on, or controls owned
// by another family that already draws its own mark.
// Every entry here is doing real work — run --audit-exceptions to see what
// each one is hiding, and delete any that no longer hide anything.
const ALLOWED_EXCEPTIONS = new Map([
  ["src/components/ui/calendarAPI/Calendar.js", "Month nav arrows belong to the calendar family (calendar-api), which draws its own marks."],
  ["src/components/GlobalNotesWidget.js", "Draggable floating bubble + tab-strip add button, both positioned by their own module CSS."],
  ["src/components/page-ui/job-cards/create/job-cards-create-ui.js", "Add-linked-job control is a tab in the tab strip (tab-api), not a standalone action."],
  ["src/components/NotesTab.js", "Viewer-chip remove sits inside an .app-badge beside the name — a 44px circle would break the chip."],
  ["src/components/Consumables/StockCheckPopup.js", "Quantity steppers are part of the number field, not standalone actions."],
  ["src/components/page-ui/tech/tech-consumables-request-ui.js", "Quantity steppers are part of the number field, not standalone actions."],
]);

// Transitional ceiling for hand-rolled icon buttons outside the exception list.
// Empty on purpose: the staff app has none left, so any new one is a real
// regression. Only add an entry to record debt you are deliberately deferring,
// and only ever lower it. Regenerate with --print-baseline.
const MIGRATION_BASELINE = new Map([]);

const toPosix = (value) => value.split(path.sep).join("/");

const walk = (dir, files = []) => {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (FILE_EXT_RE.test(entry.name)) files.push(full);
  }
  return files;
};

// Walks every button element and returns its opening tag and its body. Buttons
// cannot nest, so the first closing tag after the open tag closes it. `tag`
// picks the element: "button" for the raw one, "Button" for the component.
const readButtons = (text, tag = "button") => {
  const out = [];
  const re = new RegExp(`<${tag}\\b`, "g");
  const closeTag = `</${tag}>`;
  // The open tag ends at the first ">" outside a {…} attribute expression.
  const endOfOpenTag = (from) => {
    let depth = 0;
    for (let i = from; i < text.length; i += 1) {
      const c = text[i];
      if (c === "{") depth += 1;
      else if (c === "}") depth -= 1;
      else if (c === ">" && depth === 0) return i;
    }
    return -1;
  };

  let m;
  while ((m = re.exec(text))) {
    const start = m.index;
    const tagEnd = endOfOpenTag(start);
    if (tagEnd < 0) continue;
    // Self-closing — no body, and crucially no closing tag to pair with. Left
    // unguarded this walks to some LATER element's closing tag and treats
    // everything between as one enormous "label".
    if (text[tagEnd - 1] === "/") continue;

    // Walk forward counting opens and closes so a self-closing sibling inside
    // the body cannot steal the match.
    let depth = 1;
    let cursor = tagEnd + 1;
    let close = -1;
    while (depth > 0) {
      const nextOpen = text.indexOf(`<${tag}`, cursor);
      const nextClose = text.indexOf(closeTag, cursor);
      if (nextClose < 0) break;
      if (nextOpen >= 0 && nextOpen < nextClose) {
        const innerEnd = endOfOpenTag(nextOpen);
        if (innerEnd > 0 && text[innerEnd - 1] !== "/") depth += 1;
        cursor = innerEnd > 0 ? innerEnd + 1 : nextOpen + 1;
        continue;
      }
      depth -= 1;
      cursor = nextClose + closeTag.length;
      if (depth === 0) close = nextClose;
    }
    if (close < 0) continue;

    out.push({ open: text.slice(start, tagEnd + 1), body: text.slice(tagEnd + 1, close) });
  }
  return out;
};

// True when the button shows a mark and nothing else — an emoji or lone glyph,
// or an inline <svg> with no words beside it.
const isIconOnly = ({ open, body }) => {
  const inner = body.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  const hasSvg = /<svg\b/.test(inner);
  // <Symbol …/> is the registry's own mark, so it does not count as hand-rolled.
  const withoutSymbol = inner.replace(/<Symbol\b[^>]*\/>/g, "");
  const textNodes = withoutSymbol.replace(/<[^>]*>/g, "");
  // A {expression} child may render words, so the button is not icon-only.
  if (textNodes.includes("{")) return false;
  const words = textNodes.trim();
  if (words.length > 0) {
    // Words present — icon-only only when they are a single bare glyph, and
    // only when the button names itself some other way (aria-label / title).
    const bare = words.length <= 2 && !/[A-Za-z0-9]/.test(words);
    if (!bare) return false;
    return /aria-label|title=/.test(open);
  }
  return hasSvg;
};

// Decorative marks people type into a label: "+ Add Part", "← Back", "🗑 Delete".
// Not an exhaustive emoji sweep — these are the ones that turn up as button
// furniture, and each is already a symbol in SYMBOLS.
//
// Deliberately NOT here: the status ticks ✓ ✔ ✗. "Copied ✓" and "✓ Checked In"
// report a state rather than name the action, which is the same reason
// symbolLabels.js keeps "Approve" as words — a bare tick on an authorisation
// reads as a different thing entirely. Those stay as the author wrote them.
const LABEL_GLYPH = "[+\\u00d7\\u2715\\u2716\\u2192\\u2190\\u2191\\u2193\\u27a1\\u2b05\\u2795\\u{1f5d1}\\u270f\\u{1f50d}\\u{1f4cb}\\u{1f4ce}\\u2699\\u{1f504}\\u21bb\\u27f2]";
// A glyph on either side of the words, with at least one real word beside it.
const LABEL_GLYPH_RE = new RegExp(
  `(^\\s*${LABEL_GLYPH}\\uFE0F?\\s+\\S|\\S\\s+${LABEL_GLYPH}\\uFE0F?\\s*$)`,
  "u"
);

// A button label that carries BOTH a typed mark and words. The design law is
// one or the other: if the words are the point, the glyph is noise; if the mark
// is the point, it belongs in SYMBOLS where every call site draws it the same.
const labelGlyphHits = ({ body }) => {
  // A button label is short. Anything this long means the tag pairing went
  // wrong, and scanning it would report nonsense as a label.
  if (body.length > 2000) return [];
  const inner = body.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  const hits = [];

  // Plain JSX text: <Button>+ Add Part</Button>
  const stripped = inner.replace(/<[^>]*>/g, "");
  // "+ {hiddenCount} more" is counting notation, not furniture — the glyph
  // belongs to the number, so it is left alone.
  const isNotation = new RegExp(`^\\s*${LABEL_GLYPH}\\uFE0F?\\s*\\{`, "u").test(stripped);
  const jsxText = stripped.replace(/\{[^{}]*\}/g, "").trim();
  if (!isNotation && jsxText && LABEL_GLYPH_RE.test(jsxText)) hits.push(jsxText);

  // String literals inside an expression child, which is where a conditional
  // label lives: {busy ? "Capturing…" : "+ Add another"}
  for (const m of inner.matchAll(/"([^"\n]{2,60})"|'([^'\n]{2,60})'/g)) {
    const value = m[1] ?? m[2];
    if (LABEL_GLYPH_RE.test(value)) hits.push(value);
  }

  return [...new Set(hits)];
};

const AUDIT_EXCEPTIONS = process.argv.includes("--audit-exceptions");

// The real symbol names, read from the registry itself, so a symbol="…" found
// inside prose (the usage examples in the component's own header comment) is
// not mistaken for a call site.
const SYMBOL_SOURCE = path.join(ROOT, "src", "components", "ui", "SymbolButton.js");
const KNOWN_SYMBOLS = new Set(
  [...fs.readFileSync(SYMBOL_SOURCE, "utf8").matchAll(/^ {2}([a-zA-Z]+): \{$/gm)].map((m) => m[1])
);

// The files that ARE the symbol system rather than places it is used. Named so
// the popup reads like the other entries in USAGE_REGISTRY.
const PRIMITIVES = new Map([
  ["src/components/ui/SymbolButton.js", "SymbolButton primitive — the SYMBOLS registry and the artwork"],
  ["src/components/ui/Button.js", "Button — resolves a label to its mark via SYMBOL_FOR_LABEL"],
  ["src/components/ui/variants.js", "Family registry — the \"symbol\" family entry"],
]);

const files = SEARCH_ROOTS.flatMap((r) => walk(path.join(ROOT, r)));

const violations = new Map(); // rel -> count of hand-rolled icon buttons
const glyphLabels = new Map(); // rel -> the offending label strings
const usage = new Map(); // rel -> Set of symbol names used

for (const file of files) {
  const rel = toPosix(path.relative(ROOT, file));
  if (EXCLUDED_PREFIXES.some((p) => rel.startsWith(p))) continue;
  const text = fs.readFileSync(file, "utf8");

  if (/<SymbolButton\b|<Symbol\b|app-symbol-btn/.test(text)) {
    const names = new Set();
    const symRe = /symbol\s*=\s*"([a-zA-Z]+)"/g;
    let sm;
    while ((sm = symRe.exec(text))) {
      if (KNOWN_SYMBOLS.has(sm[1])) names.add(sm[1]);
    }
    usage.set(rel, names);
  }

  // Glyph-in-label applies to <Button> as well as raw <button>, and is not
  // covered by ALLOWED_EXCEPTIONS: an exception is about the SHAPE a control
  // takes, and no shape justifies typing a mark into the words.
  const labelled = [...readButtons(text, "button"), ...readButtons(text, "Button")]
    .flatMap(labelGlyphHits);
  if (labelled.length) glyphLabels.set(rel, [...new Set(labelled)]);

  // --audit-exceptions counts the exempt files too, so the exception list can
  // be checked for entries that no longer hide anything.
  if (!AUDIT_EXCEPTIONS && ALLOWED_EXCEPTIONS.has(rel)) continue;
  const count = readButtons(text).filter(isIconOnly).length;
  if (count > 0) violations.set(rel, count);
}

// ── --print-baseline ──────────────────────────────────────────
if (process.argv.includes("--print-baseline")) {
  const rows = [...violations.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  console.log("const MIGRATION_BASELINE = new Map([");
  rows.forEach(([f, n]) => console.log(`  [${JSON.stringify(f)}, ${n}],`));
  console.log("]);");
  process.exit(0);
}

// ── --emit-usage ──────────────────────────────────────────────
// Turns "src/pages/parts/index.js" into "/parts". Dynamic segments have no
// single route to link to, so those files are listed without one.
const routeForFile = (rel) => {
  if (!rel.startsWith("src/pages/")) return null;
  let r = rel.slice("src/pages/".length).replace(FILE_EXT_RE, "");
  if (r.includes("[")) return null;
  if (r.startsWith("api/") || r.startsWith("_")) return null;
  r = r.replace(/\/index$/, "");
  if (r === "index") return "/";
  return `/${r}`;
};

// "src/components/topbar/TeamPanel.js" -> "Team panel (topbar)"
const labelForFile = (rel) => {
  const base = path.basename(rel).replace(FILE_EXT_RE, "");
  const words = base
    .replace(/[-_]/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  const pretty = words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
  const parent = path.basename(path.dirname(rel));
  return parent && parent !== "src" ? `${pretty} (${parent})` : pretty;
};

if (process.argv.includes("--emit-usage")) {
  // Primitives first — the popup should open on "what defines this", then the
  // call sites in path order.
  const rows = [...usage.entries()]
    .sort((a, b) => {
      const pa = PRIMITIVES.has(a[0]) ? 0 : 1;
      const pb = PRIMITIVES.has(b[0]) ? 0 : 1;
      return pa !== pb ? pa - pb : a[0].localeCompare(b[0]);
    })
    .map(([rel, names]) => {
      const symbols = [...names].sort();
      const route = routeForFile(rel);
      const base = PRIMITIVES.get(rel) || labelForFile(rel);
      const label = !PRIMITIVES.has(rel) && symbols.length ? `${base} — ${symbols.join(", ")}` : base;
      return { label, file: rel, route };
    });

  const body = rows
    .map((r) => {
      const parts = [`label: ${JSON.stringify(r.label)}`, `file: ${JSON.stringify(r.file)}`];
      if (r.route) parts.push(`route: ${JSON.stringify(r.route)}`);
      return `  { ${parts.join(", ")} },`;
    })
    .join("\n");

  const out = `// GENERATED FILE — do not edit by hand.
// Written by tools/scripts/check-symbols.js (npm run check:symbols), which runs
// in predev/prebuild. Every file below uses the symbol family — <SymbolButton>,
// the bare <Symbol> mark, or .app-symbol-btn directly.
//
// The "Symbols (.app-symbol-btn)" showcase on /dev/user-diagnostic feeds this
// straight into its "Where used" popup, so the list is whatever the code
// actually does rather than a hand-kept register that goes stale.
export const SYMBOL_USAGE = [
${body}
];

export default SYMBOL_USAGE;
`;

  fs.mkdirSync(path.dirname(USAGE_OUT), { recursive: true });
  const existing = fs.existsSync(USAGE_OUT) ? fs.readFileSync(USAGE_OUT, "utf8") : "";
  if (existing !== out) fs.writeFileSync(USAGE_OUT, out);
  console.log(`[check-symbols] usage index: ${rows.length} files -> ${toPosix(path.relative(ROOT, USAGE_OUT))}`);
}

// ── Guard ─────────────────────────────────────────────────────
const failures = [];
for (const [rel, count] of [...violations.entries()].sort()) {
  const allowed = MIGRATION_BASELINE.get(rel) ?? 0;
  if (count > allowed) failures.push({ rel, count, allowed });
}

let failed = false;

if (failures.length) {
  console.error("\n[check-symbols] Hand-rolled icon-only buttons above baseline:\n");
  failures.forEach(({ rel, count, allowed }) => {
    console.error(`  ${rel} — ${count} found, ${allowed} allowed`);
  });
  console.error(
    '\nAn icon-only button must be <SymbolButton symbol="…" label="…" /> so it gets\n' +
      "the shared 44px circle and a mark from SYMBOLS (src/components/ui/SymbolButton.js).\n" +
      "If the mark is missing, add it to SYMBOLS rather than inlining an SVG or emoji.\n" +
      "If the control genuinely cannot be the circle, add it to ALLOWED_EXCEPTIONS in\n" +
      "tools/scripts/check-symbols.js with the reason.\n"
  );
  failed = true;
}

if (glyphLabels.size) {
  console.error("\n[check-symbols] Buttons with a mark typed into the label:\n");
  [...glyphLabels.entries()].sort().forEach(([rel, labels]) => {
    labels.forEach((label) => console.error(`  ${rel} — ${JSON.stringify(label)}`));
  });
  console.error(
    "\nA button is EITHER a mark or words, never both (src/lib/ui/symbolLabels.js).\n" +
      'Usually the words are the point — "Add Part" says more than a bare "+" ever\n' +
      "can — so drop the glyph and leave the label alone. Only when the mark says the\n" +
      'whole thing on its own should it become <SymbolButton> or a mapped label.\n'
  );
  failed = true;
}

if (failed) process.exit(1);

console.log(
  `[check-symbols] OK — ${usage.size} files use the symbol family; no hand-rolled icon buttons, no marks typed into labels.`
);
