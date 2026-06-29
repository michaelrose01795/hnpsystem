#!/usr/bin/env node
// Border ban guard (CLAUDE.md §3.0a). Borders are only allowed in five places:
//   1. Form inputs                 → var(--input-ring)
//   2. Checkboxes / radios         → var(--checkbox-ring)
//   3. Ghost buttons               → var(--ghostbutton-ring)
//   4. Keyboard focus (box-shadow) → var(--focus-ring)
//   5. Row-bottom separator        → var(--separating-line)
// Plus border-radius / -collapse / -spacing / -image, transparent placeholder
// borders for layout, `border: none|0`, and indirect references where the
// underlying value cannot be statically determined. Anything else is a
// violation — surfaces, cards, sections, panels, popups, sidebars, toasts,
// chips, badges, calendar cells etc. must NOT carry a border.

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SEARCH_ROOTS = ["src/pages", "src/components", "src/features", "src/styles", "src/lib", "src/context", "src/hooks", "src/utils"];
const FILE_EXT_RE = /\.(js|jsx|ts|tsx|css)$/;

// Files that legitimately carry borders (functional drawing primitives, dev
// overlays, presentation primitives, email templates).
const ALLOWLIST = new Set([
  "src/components/VHC/TyreDiagram.js",
  "src/components/VHC/BrakeDiagram.js",
  "src/components/VHC/photoEditor/PhotoEditorCanvas.js",
  "src/components/VHC/photoEditor/ShapeToolbar.js",
  "src/components/VHC/videoEditor/TimelineTrimControl.js",
  "src/components/VHC/mediaCapture/FullScreenCapture.js",
  "src/components/ui/LoadingSkeleton.js",
  // Sidebar caret triangle — CSS-triangle technique using borders.
  "src/components/Sidebar.js",
  // Timeline-dot 2px halo ring — drawn with border, not card chrome.
  "src/components/StatusTracking/JobProgressTracker.js",
  "src/components/dev-layout-overlay/DevLayoutOverlay.module.css",
  "src/components/dev-layout-overlay/DevLayoutOverlay.js",
  "src/features/jobCards/components/JobWorkflowDiagnostics.js",
  // Presentation overlays — the coloured highlight ring IS the feature.
  "src/features/presentation/PresentationHighlight.js",
  "src/features/presentation/PresentationDevOverlay.js",
  "src/features/presentation/PresentationCallout.js",
  // Email templates — different rendering rules (HTML email clients).
  "src/lib/email/template.js",
  "src/pages/api/auth/password-reset.js",
  "src/pages/api/invoices/email.js",
  "src/pages/api/job-cards/[jobNumber]/send-vhc.js",
  // Print-only HTML template for invoice preview (window.print stylesheet).
  "src/components/popups/InvoiceBuilderPopup.js",
  // Style sources (intentional definitions of ring/separator tokens).
  "src/styles/theme.css",
  "src/styles/globals.css",
  "src/styles/themeRuntime.js",
  "src/styles/families/buttons.css",
  "src/styles/families/toggles.css",
  "src/pages/_document.js",
  // Showcase page that demonstrates token system.
  "src/pages/dev/user-diagnostic.js",
]);

const ALLOWED_RING_TOKEN_RE = /var\(--(input-ring|checkbox-ring|ghostbutton-ring|focus-ring|separating-line|input-border)\)/;

function isAllowedValue(rawValue) {
  const value = rawValue.trim().replace(/[,;].*$/, "").replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
  if (!value) return true;
  // String literals stripping the surrounding quotes.
  const unquoted = value.replace(/^["'`]|["'`]$/g, "");
  if (/^(none|0|0px|unset|inherit|initial|revert|auto|undefined|null)(\s*!important)?$/i.test(unquoted)) return true;
  if (/^transparent$/i.test(unquoted)) return true;
  if (ALLOWED_RING_TOKEN_RE.test(value)) return true;
  if (/\d+px\s+(solid|dashed|dotted)\s+transparent/i.test(value)) return true;
  // Indirect references (variable / property access / function call) — can't
  // determine value statically, so trust the author.
  if (/^[A-Za-z_$][\w.$]*(\s*\[[^\]]*\])?(\s*\.[A-Za-z_$][\w$]*)*\s*$/.test(value)) return true;
  // Ternary or template literal that ultimately resolves to allowed tokens
  // only — conservative: if both branches are allowed values, accept.
  const ternary = value.match(/^(.*)\?(.*):(.*)$/);
  if (ternary) {
    return isAllowedValue(ternary[2]) && isAllowedValue(ternary[3]);
  }
  return false;
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (FILE_EXT_RE.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

const BORDER_PROP_RE_GLOBAL = /\b(border(?:-?(top|bottom|left|right))?(?:-?color)?)\s*:\s*([^,;}\n]+)/gi;
const BORDER_RADIUS_NAME_RE = /^border-?(radius|collapse|spacing|image)/i;

// Lines that fall inside an `@media print { ... }` block. Printed output obeys
// different rendering rules (like the allowlisted HTML email templates): solid
// borders on printed tables/boxes are functional, not decorative card chrome.
function computePrintBlockLines(lines) {
  const inside = new Set();
  let depth = 0; // running brace depth across the file
  let printDepth = -1; // brace depth at which the active @media print opened
  let armed = false; // saw `@media … print` on the current line, awaiting `{`
  lines.forEach((line, index) => {
    if (printDepth === -1 && /@media[^{}]*\bprint\b/i.test(line)) armed = true;
    for (const ch of line) {
      if (ch === "{") {
        if (armed && printDepth === -1) {
          printDepth = depth;
          armed = false;
        }
        depth++;
      } else if (ch === "}") {
        depth--;
        if (printDepth !== -1 && depth === printDepth) printDepth = -1;
      }
    }
    if (printDepth !== -1) inside.add(index);
  });
  return inside;
}

const violations = [];

for (const root of SEARCH_ROOTS) {
  for (const file of walk(path.join(ROOT, root))) {
    const relative = rel(file);
    if (ALLOWLIST.has(relative)) continue;
    const source = fs.readFileSync(file, "utf8");
    const lines = source.split(/\r?\n/);
    const printLines = computePrintBlockLines(lines);
    lines.forEach((line, index) => {
      // Borders inside an @media print block are functional print styling.
      if (printLines.has(index)) return;
      // Strip line-end comments before pattern matching to avoid being thrown
      // off by `// note about the border`.
      const stripped = line.replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*?\*\//g, "");
      if (!/border/i.test(stripped)) return;
      let match;
      // Iterate every border-* property on the line.
      const re = new RegExp(BORDER_PROP_RE_GLOBAL.source, BORDER_PROP_RE_GLOBAL.flags);
      while ((match = re.exec(stripped))) {
        const propName = match[1];
        if (BORDER_RADIUS_NAME_RE.test(propName)) continue;
        const rawValue = match[3];
        if (isAllowedValue(rawValue)) continue;
        violations.push(`${relative}:${index + 1}: ${propName.trim()}: ${rawValue.trim()}`);
      }
    });
  }
}

if (violations.length) {
  console.error(`\nBorder ban violations (${violations.length}):\n`);
  for (const v of violations) console.error("  " + v);
  console.error(`\nSee CLAUDE.md §3.0a. Allowed: --input-ring, --checkbox-ring, --ghostbutton-ring, --focus-ring, --separating-line.`);
  console.error(`Diagram primitives, presentation overlays, dev tools, and email templates can be added to ALLOWLIST in tools/scripts/check-borders.js if they are functional drawing primitives.\n`);
  process.exit(1);
}

console.log("Border ban check passed — no forbidden border declarations.");
