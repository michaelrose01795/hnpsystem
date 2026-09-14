#!/usr/bin/env node
// file location: tools/scripts/check-website-design.js
//
// Customer (/website) design-system guard - the custglobal.css counterpart of
// tools/scripts/check-design-governance.js. Full detail:
// docs/ui/website-design-governance.md.
//
// WHAT IT GUARANTEES
// ------------------
//   * Every rule in src/styles/custglobal.css is scoped, sits in a registered
//     @family block, and reads only tokens that exist.
//   * Every token is documented, flips light <-> dark from ONE place, and
//     keeps its text/fill pairs legible.
//   * Every class custglobal.css declares is rendered on /website/dev, and
//     every showcase section the registry names exists - so the showcase shows
//     100% of the stylesheet and cannot silently fall behind it.
//   * Drift that already exists is recorded (ratchet) and can only go down.
//
// It also EMITS src/config/websiteDesign.generated.json, which /website/dev
// renders for its token and coverage reference.
//
// HARD rules (fail on any hit):
//   1. scope-anchor        every selector starts with html.website-scope.
//   2. family-blocks       every rule sits under an `@family <id>` comment whose
//                          id is registered; every registered family has a block.
//   3. defined-tokens      every var(--x) resolves to a token declared in
//                          custglobal.css, a registered runtime token, or a
//                          registered inherited staff token.
//   4. theme-parity        the light blocks only re-point tokens the base blocks
//                          declare, and no token is declared twice per theme.
//   5. token-registry      every declared token has a registry entry (group +
//                          purpose), and no registry entry is stale.
//   6. showcase-sections   every registered section renders a
//                          <ShowcaseSection id="..."> on /website/dev.
//   7. showcase-coverage   every declared class is rendered by the showcase
//                          (its own files, or a component it imports).
//   8. focus-visible-only  var(--focus-ring) only in rules whose every selector
//                          is :focus-visible / :focus-within, never on a text
//                          field (input / textarea / select subject).
//   9. native-controls     customer code renders no raw <select> or
//                          <input type="date|time|datetime-local"> outside
//                          WebsiteNativeSelect / WebsiteNativeDateTimeInput.
//   10. showcase-inline-style  showcase style={{}} may only set registered
//                          runtime tokens (registry "runtimeTokens").
//   11. staff-scope-leak   staff stylesheets never select website-scope;
//                          custglobal.css never selects staff-scope.
//
// RATCHET rules (tools/design-baselines/website-design.json; may only fall):
//   8.  raw-colours        colour literals in custglobal rules (not token
//                          definitions), per @family.
//   9.  important          !important outside token definitions, per @family.
//   10. dead-classes       declared classes no customer code renders, per @family.
//   11. undeclared-classes className tokens in customer code with no rule, per file.
//   12. inline-visual      style={{}} setting a governed visual key, per file.
//   13. js-raw-colours     hex / rgb literals in customer code, per file.
//   14. js-undefined-tokens var(--x) in customer code with no definition, per file.
//   15. contrast           registry text/fill pairs below their floor, per theme.
//   16. control-metric-literals  literal height / font-size / font-weight /
//                          letter-spacing / radius on control rules, per @family.
//   17. radius-literals    px/rem/em border-radius literals, per @family.
//   18. js-staff-classes   staff-only classes / components in customer code,
//                          per file.
//   A ratchet with no key at all in the baseline file is reported as "no
//   baseline yet" - expected until the next deliberate --accept-new.
//
// Usage:
//   node tools/scripts/check-website-design.js              # emit + enforce
//   node tools/scripts/check-website-design.js --list       # show every hit
//   node tools/scripts/check-website-design.js --update     # lock in wins
//   node tools/scripts/check-website-design.js --accept-new # deliberate re-baseline

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const ARGS = new Set(process.argv.slice(2));
const LIST = ARGS.has("--list");
const UPDATE = ARGS.has("--update");
const ACCEPT_NEW = ARGS.has("--accept-new");

const CSS_PATH = "src/styles/custglobal.css";
const REGISTRY_PATH = "src/config/websiteDesignSystem.json";
const MANIFEST_PATH = "src/config/websiteDesign.generated.json";
const BASELINE_PATH = "tools/design-baselines/website-design.json";
const SHOWCASE_ENTRY = "src/pages/website/dev.js";
const SHOWCASE_DIR = "src/features/website/showcase";
// Customer-facing code: everything that renders under html.website-scope.
const CUSTOMER_CODE_ROOTS = ["src/pages/website", "src/features/website"];
// Staff components that custglobal.css restyles when they render under the
// customer scope. Their markup counts as "customer code" for dead-class checks.
const CUSTOMER_RENDERED_COMPONENTS = [
  "src/components/ui/dropdownAPI",
  "src/components/ui/calendarAPI",
  // Global layout with a /website launcher styled by custglobal.css. (The
  // cookie banner's website panel lives in src/features/website/components.)
  "src/components/layout/CustomerWebsiteLayout.js",
];
// Imports the showcase is allowed to borrow coverage from.
const FOLLOW_IMPORT_PREFIXES = ["src/features/website/", "src/components/ui/", "src/components/BrandLogo"];

const ROOT_BASE = "html.website-scope";
const ROOT_LIGHT = 'html.website-scope[data-website-theme="light"]';
const PAGE_BASE = "html.website-scope .ws-page";
const PAGE_LIGHT = 'html.website-scope[data-website-theme="light"] .ws-page';

const abs = (rel) => path.join(ROOT, rel);
const norm = (p) => p.split(path.sep).join("/");
const exists = (rel) => fs.existsSync(abs(rel));
const read = (rel) => fs.readFileSync(abs(rel), "utf8");
const isCode = (file) => /\.(js|jsx|ts|tsx)$/.test(file) && !/\.test\.(js|jsx|ts|tsx)$/.test(file);

function walk(rel, out = []) {
  if (!exists(rel)) return out;
  if (fs.statSync(abs(rel)).isFile()) {
    out.push(norm(rel));
    return out;
  }
  for (const entry of fs.readdirSync(abs(rel), { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const child = norm(path.join(rel, entry.name));
    if (entry.isDirectory()) walk(child, out);
    else out.push(child);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------
function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let quote = "";
  let current = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      current += ch;
      if (ch === "\\") current += text[++i] ?? "";
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "(" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "]") depth -= 1;
    if (ch === separator && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function lineLocator(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) if (text[i] === "\n") starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

function parseStylesheet(source) {
  const markers = [];
  // Blank comments (keeping offsets) but harvest @family markers first.
  const blanked = source.replace(/\/\*[\s\S]*?\*\//g, (block, offset) => {
    // A marker must START a comment line (optionally after the opening `/*`),
    // so prose that merely mentions "@family x" mid-sentence is not a marker.
    for (const m of block.matchAll(/(?:^|\n)[ \t]*(?:\/\*+)?[ \t]*@family[ \t]+([a-z0-9-]+)/g)) {
      markers.push({ offset, id: m[1] });
    }
    return block.replace(/[^\n]/g, " ");
  });
  const lineOf = lineLocator(source);
  const rules = [];
  const mediaStack = [];
  let prelude = "";
  let quote = "";

  for (let i = 0; i < blanked.length; i += 1) {
    const ch = blanked[i];
    if (quote) {
      prelude += ch;
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      prelude += ch;
      continue;
    }
    if (ch === "{") {
      const text = prelude.trim();
      if (/^@(media|supports|container|layer)\b/i.test(text)) {
        mediaStack.push(text);
        prelude = "";
        continue;
      }
      if (text.startsWith("@")) {
        // @keyframes / @font-face: not selectors - skip the whole block.
        let depth = 1;
        while (depth && ++i < blanked.length) {
          if (blanked[i] === "{") depth += 1;
          else if (blanked[i] === "}") depth -= 1;
        }
        prelude = "";
        continue;
      }
      let j = i + 1;
      let q = "";
      for (; j < blanked.length; j += 1) {
        const c = blanked[j];
        if (q) {
          if (c === "\\") j += 1;
          else if (c === q) q = "";
          continue;
        }
        if (c === '"' || c === "'") {
          q = c;
          continue;
        }
        if (c === "}") break;
      }
      const selectorOffset = i - prelude.length + (prelude.length - prelude.trimStart().length);
      const body = blanked.slice(i + 1, j);
      rules.push({
        selector: text.replace(/\s+/g, " "),
        body,
        offset: selectorOffset,
        line: lineOf(selectorOffset),
        media: mediaStack.join(" "),
      });
      i = j;
      prelude = "";
      continue;
    }
    if (ch === "}") {
      mediaStack.pop();
      prelude = "";
      continue;
    }
    if (ch === ";" && prelude.trim().startsWith("@")) {
      prelude = "";
      continue;
    }
    prelude += ch;
  }

  markers.sort((a, b) => a.offset - b.offset);
  for (const rule of rules) {
    let family = null;
    for (const marker of markers) {
      if (marker.offset <= rule.offset) family = marker.id;
      else break;
    }
    rule.family = family;
    rule.parts = splitTopLevel(rule.selector, ",").map((p) => p.trim()).filter(Boolean);
    rule.decls = splitTopLevel(rule.body, ";")
      .map((raw) => {
        const idx = raw.indexOf(":");
        if (idx < 0) return null;
        const prop = raw.slice(0, idx).trim();
        const rawValue = raw.slice(idx + 1).trim();
        const important = /!important\s*$/i.test(rawValue);
        const value = rawValue.replace(/\s*!important\s*$/i, "").trim();
        return prop ? { prop, value, important } : null;
      })
      .filter(Boolean);
  }
  return { rules, markers };
}

function stripJsComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:\\"'`])\/\/[^\n]*/g, "$1");
}

const STRING_RE = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;

// Every word-ish token that appears inside a string literal. Class names in JSX
// text (e.g. inside <code>) deliberately do NOT count - only markup does.
function stringTokens(src) {
  const tokens = new Set();
  for (const m of stripJsComments(src).matchAll(STRING_RE)) {
    const s = m[1] ?? m[2] ?? m[3] ?? "";
    for (const t of s.split(/[^A-Za-z0-9_-]+/)) if (t) tokens.add(t);
  }
  return tokens;
}

function classNameTokens(src) {
  const text = stripJsComments(src);
  const out = [];
  const re = /className=/g;
  let m;
  while ((m = re.exec(text))) {
    const start = m.index + m[0].length;
    let expr = "";
    if (text[start] === '"' || text[start] === "'") {
      const end = text.indexOf(text[start], start + 1);
      expr = text.slice(start, end + 1);
    } else if (text[start] === "{") {
      let depth = 0;
      let j = start;
      for (; j < text.length; j += 1) {
        if (text[j] === "{") depth += 1;
        else if (text[j] === "}") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      expr = text.slice(start, j + 1);
    }
    // `filter === "all" ? "a" : "b"` - the compared value is data, not a class.
    expr = expr
      .replace(/(?:===|!==|==|!=)\s*("[^"\n]*"|'[^'\n]*')/g, " ")
      .replace(/("[^"\n]*"|'[^'\n]*')\s*(?:===|!==|==|!=)/g, " ");
    for (const s of expr.matchAll(STRING_RE)) {
      const str = (s[1] ?? s[2] ?? s[3] ?? "").replace(/\$\{[^}]*\}/g, " ");
      for (const t of str.split(/\s+/)) if (/^[A-Za-z][\w-]*$/.test(t)) out.push(t);
    }
  }
  return out;
}

const IMPORT_RE = /(?:import\s[^'"]*?from\s*|import\s*\(\s*|require\(\s*)["']([^"']+)["']/g;

function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith("@/")) base = path.join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.join(path.dirname(fromFile), spec);
  else return null;
  for (const candidate of [base, `${base}.js`, `${base}.jsx`, path.join(base, "index.js")]) {
    if (exists(candidate) && fs.statSync(abs(candidate)).isFile()) return norm(candidate);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------
const registry = JSON.parse(read(REGISTRY_PATH));
const cssSource = read(CSS_PATH);
const { rules, markers } = parseStylesheet(cssSource);

const hard = [];
const registryFamilies = new Map(registry.families.map((f) => [f.id, f]));
const registrySections = new Map(registry.sections.map((s) => [s.id, s]));
const coverageExemptFamilies = new Set(Object.keys(registry.coverageExemptFamilies || {}));

// Registry self-consistency.
if (registryFamilies.size !== registry.families.length) hard.push(`${REGISTRY_PATH}: duplicate family id.`);
if (registrySections.size !== registry.sections.length) hard.push(`${REGISTRY_PATH}: duplicate section id.`);
for (const family of registry.families) {
  if (!registrySections.has(family.section)) {
    hard.push(`${REGISTRY_PATH}: family "${family.id}" points at unknown section "${family.section}".`);
  }
}

// ---------------------------------------------------------------------------
// Rule 1 - scope anchor
// ---------------------------------------------------------------------------
const SCOPE_RE = /^html\.website-scope(?![\w-])/;
for (const rule of rules) {
  for (const part of rule.parts) {
    if (!SCOPE_RE.test(part)) {
      hard.push(`[scope-anchor] ${CSS_PATH}:${rule.line}: "${part.slice(0, 90)}" must start with html.website-scope.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Rule 2 - family blocks
// ---------------------------------------------------------------------------
const markerIds = new Set(markers.map((m) => m.id));
for (const marker of markers) {
  if (!registryFamilies.has(marker.id)) {
    hard.push(`[family-blocks] ${CSS_PATH}:${lineLocator(cssSource)(marker.offset)}: @family ${marker.id} is not registered in ${REGISTRY_PATH}.`);
  }
}
for (const family of registry.families) {
  if (!markerIds.has(family.id)) hard.push(`[family-blocks] ${REGISTRY_PATH}: family "${family.id}" has no @family block in ${CSS_PATH}.`);
}
for (const rule of rules) {
  if (!rule.family) hard.push(`[family-blocks] ${CSS_PATH}:${rule.line}: rule sits above the first @family marker.`);
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------
const tokenDefs = new Map(); // name -> { dark, light, scope, family }
const scopeMaps = { rootBase: {}, rootLight: {}, pageBase: {}, pageLight: {}, local: {} };
const perThemeSeen = new Map();

for (const rule of rules) {
  const custom = rule.decls.filter((d) => d.prop.startsWith("--"));
  if (!custom.length) continue;
  const selector = rule.selector;
  let scope = "local";
  if (!rule.media && selector === ROOT_BASE) scope = "rootBase";
  else if (!rule.media && selector === ROOT_LIGHT) scope = "rootLight";
  else if (!rule.media && selector === PAGE_BASE) scope = "pageBase";
  else if (!rule.media && selector === PAGE_LIGHT) scope = "pageLight";

  for (const decl of custom) {
    const key = `${scope}:${decl.prop}`;
    if (scope !== "local" && perThemeSeen.has(key)) {
      hard.push(`[theme-parity] ${CSS_PATH}:${rule.line}: ${decl.prop} is declared twice in the ${scope} block (first at line ${perThemeSeen.get(key)}).`);
    }
    perThemeSeen.set(key, rule.line);
    if (!(decl.prop in scopeMaps[scope])) scopeMaps[scope][decl.prop] = decl.value;

    const entry = tokenDefs.get(decl.prop) || { name: decl.prop, dark: null, light: null, scope: null, family: rule.family };
    if (scope === "rootLight" || scope === "pageLight") entry.light = entry.light ?? decl.value;
    else {
      entry.dark = entry.dark ?? decl.value;
      entry.scope = entry.scope ?? (scope === "rootBase" ? "root" : scope === "pageBase" ? "page" : "local");
    }
    tokenDefs.set(decl.prop, entry);
  }
}

// Rule 4 - theme parity
for (const name of Object.keys(scopeMaps.rootLight)) {
  if (!(name in scopeMaps.rootBase)) {
    hard.push(`[theme-parity] ${name} is re-pointed in the light root block but never declared in the base ${ROOT_BASE} block.`);
  }
}
for (const name of Object.keys(scopeMaps.pageLight)) {
  if (!(name in scopeMaps.pageBase)) {
    hard.push(`[theme-parity] ${name} is re-pointed in the light .ws-page block but never declared in the base .ws-page block.`);
  }
}

// Rule 5 - token registry
const registryTokens = registry.tokens || {};
for (const name of tokenDefs.keys()) {
  const entry = registryTokens[name];
  if (!entry) hard.push(`[token-registry] ${name} is declared in ${CSS_PATH} but has no entry in ${REGISTRY_PATH} "tokens".`);
  else if (!entry.group || !entry.purpose) hard.push(`[token-registry] ${REGISTRY_PATH}: ${name} needs both "group" and "purpose".`);
}
for (const name of Object.keys(registryTokens)) {
  if (!tokenDefs.has(name)) hard.push(`[token-registry] ${REGISTRY_PATH}: ${name} is registered but no longer declared in ${CSS_PATH}.`);
}

// Rule 3 - defined tokens
const inherited = new Set(Object.keys(registry.inheritedStaffTokens || {}));
const runtimeTokens = new Set(Object.keys(registry.runtimeTokens || {}));
const knownTokens = new Set([...tokenDefs.keys(), ...inherited, ...runtimeTokens]);
const usedInherited = new Set();
for (const rule of rules) {
  for (const m of rule.body.matchAll(/var\(\s*(--[\w-]+)/g)) {
    const name = m[1];
    if (inherited.has(name)) usedInherited.add(name);
    if (!knownTokens.has(name)) {
      hard.push(`[defined-tokens] ${CSS_PATH}:${rule.line}: var(${name}) is not declared in ${CSS_PATH}. Declare it in the token block (and register it) - do not borrow a staff token.`);
    }
  }
}
for (const name of inherited) {
  if (!usedInherited.has(name)) hard.push(`[defined-tokens] ${REGISTRY_PATH}: inherited staff token ${name} is no longer used - remove it from "inheritedStaffTokens".`);
}
for (const [name, owner] of Object.entries(registry.runtimeTokens || {})) {
  if (!exists(owner) || !read(owner).includes(name)) {
    hard.push(`[defined-tokens] ${REGISTRY_PATH}: runtime token ${name} must be set by ${owner}.`);
  }
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------
const classFamily = new Map(); // class -> family (first non-exempt declaration wins)
const familyRules = new Map();
for (const rule of rules) {
  familyRules.set(rule.family, (familyRules.get(rule.family) || 0) + 1);
  for (const part of rule.parts) {
    for (const m of part.matchAll(/\.([A-Za-z_][\w-]*)/g)) {
      const cls = m[1];
      if (cls === "website-scope") continue;
      const current = classFamily.get(cls);
      if (!current || (coverageExemptFamilies.has(current) && !coverageExemptFamilies.has(rule.family))) {
        classFamily.set(cls, rule.family);
      }
    }
  }
}
const declaredClasses = new Set(classFamily.keys());

// Showcase corpus: its own files plus the customer / ui components it imports.
const showcaseOwn = [SHOWCASE_ENTRY, ...walk(SHOWCASE_DIR).filter(isCode)].filter(exists);
const showcaseAll = new Set();
{
  const queue = showcaseOwn.map((file) => [file, 0]);
  while (queue.length) {
    const [file, depth] = queue.shift();
    if (showcaseAll.has(file)) continue;
    showcaseAll.add(file);
    if (depth >= 4) continue;
    for (const m of read(file).matchAll(IMPORT_RE)) {
      const target = resolveImport(file, m[1]);
      if (!target || !isCode(target)) continue;
      if (!FOLLOW_IMPORT_PREFIXES.some((p) => target.startsWith(p))) continue;
      queue.push([target, depth + 1]);
    }
  }
}
const showcaseTokens = new Set();
for (const file of showcaseAll) for (const t of stringTokens(read(file))) showcaseTokens.add(t);

// Rule 6 - showcase sections
const showcaseOwnText = showcaseOwn.map(read).join("\n");
for (const section of registry.sections) {
  const re = new RegExp(`<ShowcaseSection\\b[^>]*?\\bid=["']${section.id}["']`);
  if (!re.test(showcaseOwnText)) {
    hard.push(`[showcase-sections] section "${section.id}" has no <ShowcaseSection id="${section.id}"> in ${SHOWCASE_ENTRY} or ${SHOWCASE_DIR}/.`);
  }
}

// Rule 7 - showcase coverage
const exemptions = registry.coverageExemptions || {};
const uncovered = [];
for (const [cls, family] of classFamily) {
  if (coverageExemptFamilies.has(family)) continue;
  const covered = showcaseTokens.has(cls);
  if (exemptions[cls]) {
    if (covered) hard.push(`[showcase-coverage] ${REGISTRY_PATH}: .${cls} is exempt but IS rendered now - remove the exemption.`);
    continue;
  }
  if (!covered) uncovered.push(`.${cls} (@family ${family})`);
}
for (const cls of Object.keys(exemptions)) {
  if (!declaredClasses.has(cls)) hard.push(`[showcase-coverage] ${REGISTRY_PATH}: exemption for .${cls}, which ${CSS_PATH} no longer declares.`);
}
if (uncovered.length) {
  hard.push(
    `[showcase-coverage] ${uncovered.length} class(es) in ${CSS_PATH} are not rendered on /website/dev:\n      ${uncovered.join("\n      ")}`,
  );
}

// ---------------------------------------------------------------------------
// Shared: customer code corpus
// ---------------------------------------------------------------------------
const customerFiles = CUSTOMER_CODE_ROOTS.flatMap((r) => walk(r)).filter(isCode);
const TOKEN_BLOCK_SELECTORS = new Set([ROOT_BASE, ROOT_LIGHT, PAGE_BASE, PAGE_LIGHT]);

// Line number of an offset in a file's (comment-blanked) text.
function hitsWithLines(text, re) {
  const lineOf = lineLocator(text);
  return [...text.matchAll(re)].map((m) => ({ line: lineOf(m.index), match: m[0] }));
}

// Remove the contents of :not(...) / :is(...)-style negations so a selector
// that merely EXCLUDES something is not read as targeting it.
function stripNot(selector) {
  let out = selector;
  let prev;
  do {
    prev = out;
    out = out.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, "");
  } while (out !== prev);
  return out;
}

// The subject compound of a selector part (after the last combinator).
function subjectCompound(part) {
  let depth = 0;
  let quote = "";
  let last = 0;
  for (let i = 0; i < part.length; i += 1) {
    const ch = part[i];
    if (quote) {
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "]") depth -= 1;
    else if (depth === 0 && /[\s>+~]/.test(ch)) last = i + 1;
  }
  return part.slice(last).trim();
}

// ---------------------------------------------------------------------------
// Rule 8 - focus-visible-only (HARD)
// The focus ring is a keyboard affordance: only :focus-visible / :focus-within
// rules may paint it, and text fields never do (they show focus through the
// control fill - the product owner does not want a ring round a field).
// ---------------------------------------------------------------------------
const FOCUS_RING_RE = /var\(\s*--focus-ring\b/;
const FIELD_SUBJECT_RE = /^(input|textarea|select)(?![\w-])/;
const NON_FIELD_INPUT_TYPE_RE = /\[type=["']?(radio|checkbox|submit|button|reset|image)["']?\]/;
for (const rule of rules) {
  if (TOKEN_BLOCK_SELECTORS.has(rule.selector)) continue;
  if (!rule.decls.some((d) => FOCUS_RING_RE.test(d.value))) continue;
  for (const part of rule.parts) {
    const positive = stripNot(part);
    const visibleOnly = /:focus-(visible|within)(?![\w-])/.test(positive) && !/:focus(?![\w-])/.test(positive);
    if (!visibleOnly) {
      hard.push(`[focus-visible-only] ${CSS_PATH}:${rule.line}: "${part.slice(0, 90)}" paints var(--focus-ring) outside :focus-visible / :focus-within. Move the ring to a :focus-visible rule; never ring on plain :focus.`);
    }
    const subject = subjectCompound(part);
    if (FIELD_SUBJECT_RE.test(subject) && !NON_FIELD_INPUT_TYPE_RE.test(subject)) {
      hard.push(`[focus-visible-only] ${CSS_PATH}:${rule.line}: "${part.slice(0, 90)}" puts var(--focus-ring) on a text field. Fields show focus through the control fill (--ws-control-bg-hover / ring colour), never a focus ring.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Rule 9 - native-controls (HARD)
// Customer code renders selects and date/time fields through the two website
// wrappers only; a raw one skips the customer trigger, menu and picker.
// ---------------------------------------------------------------------------
const NATIVE_CONTROL_OWNERS = new Set([
  "src/features/website/components/WebsiteNativeSelect.js",
  "src/features/website/components/WebsiteNativeDateTimeInput.js",
]);
const NATIVE_SELECT_RE = /(?<!["'`\w])<select(?![\w-])/g;
const NATIVE_DATE_RE = /\btype=\s*(?:\{\s*)?["'`](date|time|datetime-local)["'`]/g;
for (const file of customerFiles) {
  if (NATIVE_CONTROL_OWNERS.has(file)) continue;
  const text = stripJsComments(read(file));
  for (const hit of hitsWithLines(text, NATIVE_SELECT_RE)) {
    hard.push(`[native-controls] ${file}:${hit.line}: raw <select>. Render WebsiteNativeSelect (src/features/website/components/WebsiteNativeSelect.js).`);
  }
  const lineOf = lineLocator(text);
  // Only a raw <input> counts: <WebsiteNativeDateTimeInput type="date"> is the
  // sanctioned path, and type="date" inside prose props is not markup.
  for (const m of text.matchAll(NATIVE_DATE_RE)) {
    const tagStart = text.lastIndexOf("<", m.index);
    const tag = tagStart >= 0 ? (text.slice(tagStart + 1).match(/^[A-Za-z][\w.]*/) || [""])[0] : "";
    if (tag !== "input") continue;
    hard.push(`[native-controls] ${file}:${lineOf(m.index)}: raw <input type="${m[1]}">. Render WebsiteNativeDateTimeInput (src/features/website/components/WebsiteNativeDateTimeInput.js).`);
  }
}

// ---------------------------------------------------------------------------
// Rule 10 - showcase-inline-style (HARD)
// The showcase is the reference for custglobal.css; an inline style there
// shows something the stylesheet does not own. The only allowed style={{}}
// sets registered runtime custom properties (registry.runtimeTokens).
// ---------------------------------------------------------------------------
// Top-level keys of a JS object literal source ("{ a: 1, "--b": x, ...c }").
function objectLiteralKeys(src) {
  const keys = [];
  let depth = 0;
  let quote = "";
  let expectKey = true;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = "";
      continue;
    }
    if (depth === 1 && expectKey && /\S/.test(ch) && ch !== "{" && ch !== ",") {
      const m = src.slice(i).match(/^(?:"([^"]*)"|'([^']*)'|(\.\.\.)|\[|([\w$]+))/);
      if (m) {
        keys.push(m[1] ?? m[2] ?? (m[3] ? "...spread" : m[4] ?? "[computed]"));
        expectKey = false;
      }
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{" || ch === "(" || ch === "[") depth += 1;
    else if (ch === "}" || ch === ")" || ch === "]") depth -= 1;
    else if (ch === "," && depth === 1) expectKey = true;
  }
  return keys;
}

for (const file of showcaseOwn) {
  const text = stripJsComments(read(file));
  const lineOf = lineLocator(text);
  for (const m of text.matchAll(/style=\{\{/g)) {
    const start = m.index + "style={".length;
    let depth = 0;
    let end = start;
    for (; end < text.length; end += 1) {
      if (text[end] === "{") depth += 1;
      else if (text[end] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const keys = objectLiteralKeys(text.slice(start, end + 1));
    const bad = keys.filter((k) => !runtimeTokens.has(k));
    if (!bad.length) continue;
    hard.push(`[showcase-inline-style] ${file}:${lineOf(m.index)}: style={{}} sets ${bad.join(", ")}. The showcase may only set registered runtime tokens (${REGISTRY_PATH} "runtimeTokens"); put layout in a .website-dev-* class in custglobal.css.`);
  }
}

// ---------------------------------------------------------------------------
// Rule 11 - staff-scope-leak (HARD, static isolation)
// Staff stylesheets never select the customer scope (in any form, not just
// html.website-scope), and custglobal.css never selects the staff scope.
// Exclusions such as :not(.website-scope) are allowed.
// ---------------------------------------------------------------------------
const STAFF_ISOLATION_FILES = [
  "src/styles/staffglobal.css",
  "src/styles/theme.css",
  ...walk("src/styles/families").filter((f) => f.endsWith(".css")),
].filter(exists);
for (const file of STAFF_ISOLATION_FILES) {
  for (const rule of parseStylesheet(read(file)).rules) {
    for (const part of rule.parts) {
      if (/website-scope/.test(stripNot(part))) {
        hard.push(`[staff-scope-leak] ${file}:${rule.line}: "${part.slice(0, 90)}" styles the customer scope from a staff stylesheet. Customer rules belong in ${CSS_PATH}.`);
      }
    }
  }
}
for (const rule of rules) {
  for (const part of rule.parts) {
    if (/staff-scope/.test(stripNot(part))) {
      hard.push(`[staff-scope-leak] ${CSS_PATH}:${rule.line}: "${part.slice(0, 90)}" selects the staff scope. custglobal.css styles html.website-scope only.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Ratchets
// ---------------------------------------------------------------------------
const COLOUR_LITERAL_RE = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*[\d.]+\s*[,\s]/g;
const NAMED_COLOUR_RE = /\b(white|black)\b/g;
const COLOUR_PROP_RE = /^(color|background|background-color|background-image|box-shadow|text-shadow|outline|outline-color|border|border-[a-z-]+|fill|stroke|scrollbar-color|caret-color|text-decoration-color|filter)$/;

function collectCssRatchet(test) {
  const hits = new Map();
  const detail = new Map();
  for (const rule of rules) {
    for (const decl of rule.decls) {
      if (decl.prop.startsWith("--")) continue;
      const n = test(decl);
      if (!n) continue;
      const key = `${CSS_PATH}#${rule.family}`;
      hits.set(key, (hits.get(key) || 0) + n);
      if (!detail.has(key)) detail.set(key, []);
      detail.get(key).push(`${rule.line}: ${decl.prop}: ${decl.value.slice(0, 60)}`);
    }
  }
  return { hits, detail };
}

const collectRawColours = () =>
  collectCssRatchet((decl) => {
    const literal = (decl.value.match(COLOUR_LITERAL_RE) || []).length;
    const named = COLOUR_PROP_RE.test(decl.prop) ? (decl.value.match(NAMED_COLOUR_RE) || []).length : 0;
    return literal + named;
  });

const collectImportant = () => collectCssRatchet((decl) => (decl.important ? 1 : 0));

const customerRenderFiles = [
  ...customerFiles.filter((f) => f !== SHOWCASE_ENTRY && !f.startsWith(`${SHOWCASE_DIR}/`)),
  ...CUSTOMER_RENDERED_COMPONENTS.flatMap((r) => (/\.[cm]?jsx?$/.test(r) ? [r] : walk(r))).filter(isCode),
];

function collectDeadClasses() {
  const used = new Set();
  for (const file of customerRenderFiles) for (const t of stringTokens(read(file))) used.add(t);
  const hits = new Map();
  const detail = new Map();
  for (const [cls, family] of classFamily) {
    if (coverageExemptFamilies.has(family) || used.has(cls)) continue;
    const key = `${CSS_PATH}#${family}`;
    hits.set(key, (hits.get(key) || 0) + 1);
    if (!detail.has(key)) detail.set(key, []);
    detail.get(key).push(`.${cls}`);
  }
  return { hits, detail };
}

function collectUndeclaredClasses() {
  const hits = new Map();
  const detail = new Map();
  for (const file of customerFiles) {
    const missing = classNameTokens(read(file)).filter((t) => !declaredClasses.has(t));
    if (!missing.length) continue;
    hits.set(file, missing.length);
    detail.set(file, [...new Set(missing)].slice(0, 10));
  }
  return { hits, detail };
}

const GOVERNED_STYLE_KEYS = [
  "background", "backgroundColor", "backgroundImage", "color", "border", "borderRadius", "borderColor",
  "boxShadow", "fontSize", "fontWeight", "fontFamily", "letterSpacing", "textTransform",
  "display", "gap", "rowGap", "columnGap", "flex", "flexDirection", "flexWrap", "alignItems", "alignSelf", "justifyContent",
  "width", "minWidth", "maxWidth", "height", "minHeight", "maxHeight", "margin", "marginTop", "marginBottom", "marginLeft", "marginRight",
  "transition", "animation", "transform", "position", "top", "right", "bottom", "left",
  "padding", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "opacity",
];
const STYLE_PROP_RE = /style=\{\{([\s\S]{0,600}?)\}\}/g;
const GOVERNED_KEY_RE = new RegExp(`(?:^|[\\s,{])(${GOVERNED_STYLE_KEYS.join("|")})\\s*:`, "g");

function collectInlineVisual() {
  const hits = new Map();
  const detail = new Map();
  for (const file of customerFiles) {
    const text = read(file).replace(/\r?\n/g, "\r\n");
    let count = 0;
    const keys = new Set();
    for (const match of text.matchAll(STYLE_PROP_RE)) {
      for (const k of match[1].matchAll(GOVERNED_KEY_RE)) {
        count += 1;
        keys.add(k[1]);
      }
    }
    if (!count) continue;
    hits.set(file, count);
    detail.set(file, [...keys].slice(0, 8));
  }
  return { hits, detail };
}

function collectJsRawColours() {
  const hits = new Map();
  const detail = new Map();
  for (const file of customerFiles) {
    const matches = [...stripJsComments(read(file)).matchAll(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\brgba?\(\s*\d/g)];
    if (!matches.length) continue;
    hits.set(file, matches.length);
    detail.set(file, [...new Set(matches.map((m) => m[0]))].slice(0, 8));
  }
  return { hits, detail };
}

function collectJsUndefinedTokens() {
  const hits = new Map();
  const detail = new Map();
  for (const file of customerFiles) {
    const text = stripJsComments(read(file));
    const local = new Set([...text.matchAll(/["'](--[\w-]+)["']\s*:/g)].map((m) => m[1]));
    const missing = [...text.matchAll(/var\(\s*(--[\w-]+)/g)]
      .map((m) => m[1])
      .filter((t) => !knownTokens.has(t) && !local.has(t));
    if (!missing.length) continue;
    hits.set(file, missing.length);
    detail.set(file, [...new Set(missing)].slice(0, 10));
  }
  return { hits, detail };
}

// Control metrics / radii: a literal where a control-system token belongs.
// var(...) (fallback included) is removed first, so only what is hand-typed
// in the declaration counts.
const stripVars = (value) => {
  let out = value;
  let prev;
  do {
    prev = out;
    out = out.replace(/var\((?:[^()]|\([^()]*\))*\)/g, "");
  } while (out !== prev);
  return out;
};
const CONTROL_ELEMENT_RE = /(?:^|[\s>+~(,])(button|input|select|textarea)(?![\w-])/;
const CONTROL_CLASS_RE = /\.(?:[\w-]*?(?:-btn|-button|-close|-qty|-toggle|-option|-phone|-account|-link|-tab|-chip|-filter|__trigger|__control|__nav|__day)(?:--[a-z0-9-]+)?(?![\w-]))/;
const CONTROL_METRIC_PROPS = /^(height|min-height|max-height|font-size|font-weight|letter-spacing|border(?:-(?:top|bottom)-(?:left|right))?-radius)$/;
const isRadiusProp = (prop) => /^border(?:-(?:top|bottom)-(?:left|right))?-radius$/.test(prop);

const targetsControl = (rule) =>
  rule.parts.some((part) => {
    const s = stripNot(part);
    return CONTROL_ELEMENT_RE.test(s) || s.includes('[role="button"]') || /\.app-btn(?![\w])/.test(s) || CONTROL_CLASS_RE.test(s);
  });

const collectControlMetricLiterals = () => {
  const controlRules = new Set(rules.filter(targetsControl));
  const hits = new Map();
  const detail = new Map();
  for (const rule of controlRules) {
    for (const decl of rule.decls) {
      if (decl.prop.startsWith("--") || !CONTROL_METRIC_PROPS.test(decl.prop)) continue;
      const v = decl.value.trim();
      if (/^(0|auto|inherit|initial|unset|none|normal|100%)$/.test(v)) continue;
      if (isRadiusProp(decl.prop) && v === "50%") continue;
      const rest = stripVars(v);
      if (!/\d/.test(rest) && !/\bclamp\(/.test(rest)) continue;
      const key = `${CSS_PATH}#${rule.family}`;
      hits.set(key, (hits.get(key) || 0) + 1);
      if (!detail.has(key)) detail.set(key, []);
      detail.get(key).push(`${rule.line}: ${decl.prop}: ${v.slice(0, 60)}`);
    }
  }
  return { hits, detail };
};

const collectRadiusLiterals = () =>
  collectCssRatchet((decl) => {
    if (!isRadiusProp(decl.prop)) return 0;
    const v = decl.value.trim();
    if (/^(0|50%|inherit|initial|unset)$/.test(v)) return 0;
    return [...stripVars(v).matchAll(/(\d*\.?\d+)(px|rem|em)\b/g)].some((m) => parseFloat(m[1]) !== 0) ? 1 : 0;
  });

// Staff-only classes and components rendered by customer code.
const STAFF_CLASS_RE = /^(app-input(?:--[\w-]+)?|app-btn--(?:primary|secondary|ghost)|app-section-card|app-page-card|popup-card|app-modal__[\w-]+)$/;
const STAFF_IMPORT_TARGETS = [
  "src/components/ui/Button",
  "src/components/ui/LayerSurface",
  "src/components/ui/LayerTheme",
  "src/components/popups/",
  "src/components/ui/dropdownAPI/DropdownField",
];
const STAFF_IMPORT_RE = /import\s+([^'"]*?)\s*from\s*["']([^"']+)["']|(?:import\s*\(\s*|require\(\s*)["']([^"']+)["']/g;

function staffImportTarget(fromFile, spec, clause) {
  let target;
  if (spec.startsWith("@/")) target = norm(path.join("src", spec.slice(2)));
  else if (spec.startsWith(".")) target = norm(path.join(path.dirname(fromFile), spec));
  else return null;
  target = target.replace(/\.(js|jsx|ts|tsx)$/, "").replace(/\/index$/, "");
  for (const prefix of STAFF_IMPORT_TARGETS) {
    if (prefix.endsWith("/") ? `${target}/`.startsWith(prefix) : target === prefix) return spec;
  }
  // The dropdownAPI barrel re-exports the staff DropdownField.
  if (target === "src/components/ui/dropdownAPI" && /\bDropdownField\b/.test(clause || "")) return `${spec} (DropdownField)`;
  return null;
}

function collectJsStaffClasses() {
  const hits = new Map();
  const detail = new Map();
  for (const file of customerFiles) {
    const src = read(file);
    const found = classNameTokens(src).filter((t) => STAFF_CLASS_RE.test(t)).map((t) => `.${t}`);
    for (const m of stripJsComments(src).matchAll(STAFF_IMPORT_RE)) {
      const hit = staffImportTarget(file, m[2] ?? m[3], m[1]);
      if (hit) found.push(`import ${hit}`);
    }
    if (!found.length) continue;
    hits.set(file, found.length);
    detail.set(file, [...new Set(found)].slice(0, 10));
  }
  return { hits, detail };
}

// ---------------------------------------------------------------------------
// Contrast
// ---------------------------------------------------------------------------
const themeTokens = {
  dark: { ...scopeMaps.rootBase, ...scopeMaps.pageBase },
  light: { ...scopeMaps.rootBase, ...scopeMaps.pageBase, ...scopeMaps.rootLight, ...scopeMaps.pageLight },
};

function resolveValue(value, theme, depth = 0) {
  if (depth > 12) return value;
  const replaced = value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_, name, fallback) => {
    const hit = themeTokens[theme][name];
    return hit !== undefined ? hit : fallback ?? "";
  });
  return replaced === value ? value : resolveValue(replaced, theme, depth + 1);
}

function parseColour(value) {
  const v = String(value || "").trim();
  let m = v.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
      h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    ];
  }
  m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i);
  if (m) {
    const alpha = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [Number(m[1]), Number(m[2]), Number(m[3]), alpha];
  }
  if (v === "transparent") return [0, 0, 0, 0];
  return null;
}

const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1);
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (c) => 0.2126 * lin(c[0] / 255) + 0.7152 * lin(c[1] / 255) + 0.0722 * lin(c[2] / 255);
const ratio = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const contrastResults = [];
function collectContrast() {
  const hits = new Map();
  const detail = new Map();
  for (const pair of registry.contrast || []) {
    for (const theme of ["dark", "light"]) {
      const layers = [...pair.on].reverse().map((name) => ({ name, colour: parseColour(resolveValue(`var(${name})`, theme)) }));
      const fgColour = parseColour(resolveValue(`var(${pair.fg})`, theme));
      if (!fgColour || layers.some((l) => !l.colour)) {
        hard.push(`[contrast] "${pair.label}" (${theme}) could not be resolved to colours - check the token values.`);
        continue;
      }
      if (layers[0].colour[3] < 1) {
        hard.push(`[contrast] "${pair.label}" (${theme}): the last layer ${layers[0].name} must be opaque.`);
        continue;
      }
      let bg = layers[0].colour;
      for (const layer of layers.slice(1)) bg = over(layer.colour, bg);
      const fg = fgColour[3] < 1 ? over(fgColour, bg) : fgColour;
      const value = Math.round(ratio(fg, bg) * 100) / 100;
      const hex = (c) => `#${c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
      contrastResults.push({
        label: pair.label,
        theme,
        fg: pair.fg,
        on: pair.on,
        min: pair.min,
        ratio: value,
        pass: value >= pair.min,
        resolved: { fg: hex(fg), bg: hex(bg) },
      });
      if (value < pair.min) {
        const key = `${theme}: ${pair.fg} on ${pair.on.join(" / ")}`;
        hits.set(key, 1);
        detail.set(key, [`${value}:1 (${hex(fg)} on ${hex(bg)}), floor ${pair.min}:1 - ${pair.label}`]);
      }
    }
  }
  return { hits, detail };
}

const RATCHETS = [
  ["raw-colours", collectRawColours, "colour literal(s) in custglobal rules. Name the colour once in the token block and read the token."],
  ["important", collectImportant, "!important outside token definitions. Fix the specificity instead."],
  ["dead-classes", collectDeadClasses, "class(es) declared in custglobal.css that no customer code renders. Delete the rule or use it."],
  ["undeclared-classes", collectUndeclaredClasses, "className token(s) with no custglobal.css rule. Add the rule, use an existing class, or drop the name."],
  ["inline-visual", collectInlineVisual, "inline style(s) setting a governed visual property. Put it in custglobal.css."],
  ["js-raw-colours", collectJsRawColours, "raw colour literal(s) in customer code. Read a custglobal token instead."],
  ["js-undefined-tokens", collectJsUndefinedTokens, "var(--token) reference(s) with no custglobal definition."],
  ["contrast", collectContrast, "text/fill pair(s) below the registry floor."],
  ["control-metric-literals", collectControlMetricLiterals, "literal height / font / letter-spacing / radius value(s) on a control. Read the control-system token (--website-control-height, --website-control-radius, ...)."],
  ["radius-literals", collectRadiusLiterals, "border-radius literal(s). Read a --website-radius-* token."],
  ["js-staff-classes", collectJsStaffClasses, "staff-only class / component use(s) in customer code. Use the raw customer control, WebsiteNativeSelect or a custglobal class - staff UI does not belong under html.website-scope."],
];

// ---------------------------------------------------------------------------
// Manifest (always emitted - /website/dev renders it)
// ---------------------------------------------------------------------------
const ratchetResults = RATCHETS.map(([id, collect, advice]) => ({ id, advice, ...collect() }));
const familyDebt = (id, familyId) => ratchetResults.find((r) => r.id === id).hits.get(`${CSS_PATH}#${familyId}`) || 0;

const tokenOrder = Object.keys(registryTokens);
const manifest = {
  $comment: `GENERATED by tools/scripts/check-website-design.js from ${CSS_PATH} + ${REGISTRY_PATH}. Do not edit by hand.`,
  totals: {
    rules: rules.length,
    classes: declaredClasses.size,
    coveredClasses: [...classFamily].filter(([cls, fam]) => coverageExemptFamilies.has(fam) || showcaseTokens.has(cls) || exemptions[cls]).length,
    tokens: tokenDefs.size,
    families: registry.families.length,
    sections: registry.sections.length,
  },
  sections: registry.sections.map((section) => ({
    ...section,
    families: registry.families
      .filter((f) => f.section === section.id)
      .map((f) => ({
        id: f.id,
        title: f.title,
        rules: familyRules.get(f.id) || 0,
        classes: [...classFamily].filter(([, fam]) => fam === f.id).map(([cls]) => cls).sort(),
        debt: { rawColours: familyDebt("raw-colours", f.id), important: familyDebt("important", f.id), deadClasses: familyDebt("dead-classes", f.id) },
      })),
  })),
  tokens: [...tokenDefs.values()]
    .sort((a, b) => {
      const ia = tokenOrder.indexOf(a.name);
      const ib = tokenOrder.indexOf(b.name);
      return (ia < 0 ? 1e6 : ia) - (ib < 0 ? 1e6 : ib);
    })
    .map((t) => ({
      name: t.name,
      group: registryTokens[t.name]?.group || null,
      purpose: registryTokens[t.name]?.purpose || null,
      scope: t.scope || "root",
      dark: t.dark,
      light: t.light,
    })),
  contrast: contrastResults,
};
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
if (!exists(MANIFEST_PATH) || read(MANIFEST_PATH) !== manifestText) {
  fs.writeFileSync(abs(MANIFEST_PATH), manifestText, "utf8");
}

// ---------------------------------------------------------------------------
// Ratchet plumbing (same contract as check-design-governance.js)
// ---------------------------------------------------------------------------
let baseline = {};
try {
  baseline = JSON.parse(read(BASELINE_PATH));
} catch {
  baseline = {};
}

const failures = [];
const improvements = [];
const nextBaseline = {};
const listing = [];
const unbaselinedRatchets = [];

for (const { id, advice, hits, detail } of ratchetResults) {
  const recorded = baseline[id] || {};
  const observed = Object.fromEntries([...hits.entries()].sort((a, b) => b[1] - a[1]));
  nextBaseline[id] = observed;

  if (LIST) {
    const total = Object.values(observed).reduce((a, b) => a + b, 0);
    listing.push(`\n=== ${id} (${Object.keys(observed).length} keys, ${total} hits) ===`);
    for (const [key, count] of Object.entries(observed)) {
      const d = detail.get(key);
      listing.push(`  ${String(count).padStart(4)}  ${key}${d && d.length ? `\n          ${d.slice(0, 8).join("\n          ")}` : ""}`);
    }
    continue;
  }
  if (ACCEPT_NEW) continue;

  const unbaselinedRatchet = baseline[id] === undefined;
  if (unbaselinedRatchet && Object.keys(observed).length) unbaselinedRatchets.push(id);
  for (const [key, count] of Object.entries(observed)) {
    const allowed = recorded[key];
    if (allowed === undefined && unbaselinedRatchet) failures.push(`[${id}] ${key}: ${count} - ratchet "${id}" has no baseline yet (introduced after the last re-baseline). ${advice}`);
    else if (allowed === undefined) failures.push(`[${id}] ${key}: ${count} new ${advice}`);
    else if (count > allowed) failures.push(`[${id}] ${key}: ${count} (baseline ${allowed}) ${advice}`);
  }
  for (const [key, allowed] of Object.entries(recorded)) {
    const count = observed[key] ?? 0;
    if (count < allowed) improvements.push(`[${id}] ${key}: ${allowed} -> ${count}`);
  }
}

if (LIST) {
  console.log(listing.join("\n"));
  if (hard.length) console.log(`\n=== HARD (${hard.length}) ===\n  ${hard.join("\n  ")}`);
  process.exit(0);
}

if (UPDATE || ACCEPT_NEW) {
  if (hard.length) {
    console.error("\nRefusing to write a baseline while HARD rules fail:\n");
    hard.forEach((p) => console.error(`  ${p}`));
    process.exit(1);
  }
  if (UPDATE) {
    for (const [id, keys] of Object.entries(nextBaseline)) {
      for (const [key, count] of Object.entries(keys)) {
        const prev = baseline[id] && baseline[id][key];
        if (prev === undefined) {
          console.error(`Refusing to add a new ${id} baseline entry for ${key}. Fix the drift, or use --accept-new for a deliberate re-baseline.`);
          process.exit(1);
        }
        if (count > prev) {
          console.error(`Refusing to raise the ${id} baseline for ${key} (${prev} -> ${count}). Fix the drift instead.`);
          process.exit(1);
        }
      }
    }
  }
  fs.mkdirSync(path.dirname(abs(BASELINE_PATH)), { recursive: true });
  fs.writeFileSync(abs(BASELINE_PATH), `${JSON.stringify(nextBaseline, null, 2)}\n`, "utf8");
  console.log(`Website design baseline written to ${BASELINE_PATH}.`);
  process.exit(0);
}

if (hard.length) {
  console.error(`\nWebsite design check FAILED - ${hard.length} hard rule violation(s):\n`);
  hard.forEach((p) => console.error(`  ${p}`));
}
if (failures.length) {
  console.error(`\nWebsite design check FAILED - ${failures.length} ratchet violation(s):\n`);
  failures.slice(0, 60).forEach((f) => console.error(`  ${f}`));
  if (failures.length > 60) console.error(`  ...and ${failures.length - 60} more. Run with --list.`);
  if (unbaselinedRatchets.length) {
    console.error(
      `\n  Ratchet(s) ${unbaselinedRatchets.join(", ")} are new and have no entry in ${BASELINE_PATH} yet.` +
        "\n  This failure is EXPECTED until the design-system owner records the existing debt with" +
        "\n  `node tools/scripts/check-website-design.js --accept-new` (once the HARD rules pass)." +
        "\n  Do not re-baseline to get unrelated work through; from then on the counts may only fall.",
    );
  }
}
if (hard.length || failures.length) {
  console.error("\nSee docs/ui/website-design-governance.md. Baselines may only go down.\n");
  process.exit(1);
}

if (improvements.length) {
  console.log(`Website design improved in ${improvements.length} place(s):`);
  improvements.slice(0, 20).forEach((i) => console.log(`  ${i}`));
  console.log("Run `npm run check:website:update` to lock these in.\n");
}

const debt = ratchetResults.map((r) => `${r.id}: ${Object.values(nextBaseline[r.id]).reduce((a, b) => a + b, 0)}`).join(", ");
console.log(
  `Website design check passed - ${manifest.totals.classes} classes / ${manifest.totals.tokens} tokens / ${manifest.totals.rules} rules, all shown on /website/dev. Tracked debt - ${debt}.`,
);
