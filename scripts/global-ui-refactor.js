// file location: /scripts/global-ui-refactor.js
//
// Global UI Refactor Codemod
// --------------------------
// Scans the entire HNPSystem codebase and flags / rewrites non-global UI patterns
// so they conform to the global design system (theme.css tokens + shared components).
//
// Usage:
//   node scripts/global-ui-refactor.js          → dry run (reports only, writes nothing)
//   node scripts/global-ui-refactor.js --write  → applies transforms and writes .bak backups
//
// Safety notes:
//   - Only processes .js and .jsx files
//   - Ignores node_modules, .next, .git, scripts, out, build, dist, coverage
//   - Always writes a <filename>.bak backup before overwriting
//   - Only overwrites when at least one transform was applied
//   - Never deletes or reorders props (onClick, disabled, type, etc. are preserved)
//   - Anything too risky to auto-rewrite is logged as a FLAG for manual review

"use strict";

const fs = require("fs");
const path = require("path");

// --------------------------------------------------------------------------------------
// CLI FLAGS
// --------------------------------------------------------------------------------------
// --write   : actually write changes to disk (default is dry-run)
// --verbose : print every skipped file
const args = process.argv.slice(2);
const WRITE_MODE = args.includes("--write");
const VERBOSE = args.includes("--verbose");

// --------------------------------------------------------------------------------------
// CONFIG
// --------------------------------------------------------------------------------------
// Root of the project (the parent of /scripts).
const PROJECT_ROOT = path.resolve(__dirname, "..");

// Directories we never recurse into.
const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "scripts",
  "out",
  "build",
  "dist",
  "coverage",
  ".vercel",
  ".turbo",
]);

// File extensions we process.
const PROCESSED_EXTS = new Set([".js", ".jsx"]);

// Where the global Button component lives (used when injecting an import).
// Adjust this path if your project stores it elsewhere — the script will only
// inject the import when it actually rewrites a <button> into <Button>.
const GLOBAL_BUTTON_IMPORT = `import Button from "@/components/ui/Button";`;
const GLOBAL_BUTTON_IMPORT_MARKER = `@/components/ui/Button`;

// --------------------------------------------------------------------------------------
// COUNTERS / REPORT STATE
// --------------------------------------------------------------------------------------
const report = {
  filesScanned: 0,
  filesChanged: 0,
  filesFlagged: 0,
  buttonsRewritten: 0,
  inlineStylesFlagged: 0,
  hardcodedColoursFlagged: 0,
  customSelectsFlagged: 0,
  customInputsFlagged: 0,
  manualTablesFlagged: 0,
  randomClassNamesFlagged: 0,
};

// --------------------------------------------------------------------------------------
// LOGGING HELPERS
// --------------------------------------------------------------------------------------
// Colour-free logging so output is readable in any terminal / CI log.
function log(file, message) {
  console.log(`  • ${path.relative(PROJECT_ROOT, file)} — ${message}`);
}

function flag(file, message) {
  console.log(`  ⚑ FLAG  ${path.relative(PROJECT_ROOT, file)} — ${message}`);
}

function change(file, message) {
  console.log(`  ✎ EDIT  ${path.relative(PROJECT_ROOT, file)} — ${message}`);
}

// --------------------------------------------------------------------------------------
// FILE WALKER
// --------------------------------------------------------------------------------------
// Recursively collects every .js / .jsx file under `dir`, skipping ignored directories.
function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    console.warn(`Could not read ${dir}: ${err.message}`);
    return out;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith(".")) continue; // skip dotfolders like .husky
      walk(full, out);
      continue;
    }

    if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (PROCESSED_EXTS.has(ext)) {
        // Skip backups produced by previous runs.
        if (entry.name.endsWith(".bak")) continue;
        out.push(full);
      }
    }
  }

  return out;
}

// --------------------------------------------------------------------------------------
// TRANSFORM: <button> → <Button variant="primary" />
// --------------------------------------------------------------------------------------
// Rewrites plain lowercase <button ...>...</button> JSX into the global <Button /> component.
// Strategy:
//   - Only touches <button ... > (lowercase) — which in JSX is always a DOM element.
//   - Preserves every prop (onClick, disabled, type, aria-*, data-*, etc.).
//   - Preserves children exactly.
//   - If the file already imports the global Button, the import is not duplicated.
//   - If a <button> tag has className="..." we leave a FLAG comment above it so a human
//     can decide whether to port the styles into a variant.
function transformButtons(file, source) {
  // Match both self-closing and paired button tags. Non-greedy to handle multiple per file.
  // Capture groups: 1 = props string, 2 = children (may be empty for self-closing paired)
  const pairedRe = /<button(\s[^>]*)?>([\s\S]*?)<\/button>/g;
  const selfRe = /<button(\s[^>]*)?\/>/g;

  let changed = false;
  let next = source;

  // Paired: <button ...>children</button>
  next = next.replace(pairedRe, (match, propsRaw, children) => {
    const props = (propsRaw || "").trim();

    // If there's a className / style / complex content, still rewrite the tag name,
    // but also FLAG it for manual review so the styles can be migrated into a variant.
    if (/className\s*=/.test(props) || /style\s*=/.test(props)) {
      flag(
        file,
        `<button> with className/style rewritten to <Button> — migrate styles into a variant`
      );
    }

    changed = true;
    report.buttonsRewritten += 1;

    // Default variant when one isn't obviously declared by the surrounding code.
    const withVariant = /variant\s*=/.test(props)
      ? props
      : `${props ? props + " " : ""}variant="primary"`;

    return `<Button ${withVariant}>${children}</Button>`;
  });

  // Self-closing: <button ... />
  next = next.replace(selfRe, (match, propsRaw) => {
    const props = (propsRaw || "").trim();

    if (/className\s*=/.test(props) || /style\s*=/.test(props)) {
      flag(
        file,
        `<button /> with className/style rewritten to <Button /> — migrate styles into a variant`
      );
    }

    changed = true;
    report.buttonsRewritten += 1;

    const withVariant = /variant\s*=/.test(props)
      ? props
      : `${props ? props + " " : ""}variant="primary"`;

    return `<Button ${withVariant} />`;
  });

  // If we rewrote any <button>, ensure the Button import is present.
  if (changed && !next.includes(GLOBAL_BUTTON_IMPORT_MARKER)) {
    next = injectImport(next, GLOBAL_BUTTON_IMPORT);
    change(file, `added import for global Button component`);
  }

  return { source: next, changed };
}

// --------------------------------------------------------------------------------------
// HELPER: inject an import at the top of a file, after any existing imports
// --------------------------------------------------------------------------------------
// Places the new import after the last existing `import ... from "...";` line,
// or at the very top if there are no imports at all. Preserves a leading "use client".
function injectImport(source, importLine) {
  const lines = source.split("\n");
  let lastImportIdx = -1;
  let directiveIdx = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (
      trimmed === `"use client";` ||
      trimmed === `'use client';` ||
      trimmed === `"use strict";` ||
      trimmed === `'use strict';`
    ) {
      directiveIdx = i;
      continue;
    }
    if (/^import\s.+from\s.+;?$/.test(trimmed)) {
      lastImportIdx = i;
    }
  }

  const insertAt =
    lastImportIdx >= 0 ? lastImportIdx + 1 : directiveIdx >= 0 ? directiveIdx + 1 : 0;

  lines.splice(insertAt, 0, importLine);
  return lines.join("\n");
}

// --------------------------------------------------------------------------------------
// DETECT: inline style={{ ... }}
// --------------------------------------------------------------------------------------
// Inline styles are rarely safe to auto-rewrite because the values often come from
// variables or encode layout intent that should be moved to a className + CSS variables.
// So we FLAG them — we do not silently delete them.
function detectInlineStyles(file, source) {
  const re = /style\s*=\s*\{\{[^}]*\}\}/g;
  const matches = source.match(re) || [];
  if (matches.length === 0) return;

  report.inlineStylesFlagged += matches.length;
  flag(
    file,
    `${matches.length} inline style={{}} occurrence(s) — migrate to className + tokens`
  );
}

// --------------------------------------------------------------------------------------
// DETECT: hardcoded colours (#abc, #aabbcc, rgb(...), rgba(...), hsl(...))
// --------------------------------------------------------------------------------------
// Only flags colour literals found in .js/.jsx (CSS files are outside this codemod's
// scope). Ignores matches inside obvious comment lines to reduce noise.
function detectHardcodedColours(file, source) {
  const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
  const rgbRe = /\brgba?\s*\(/g;
  const hslRe = /\bhsla?\s*\(/g;

  let count = 0;
  const lines = source.split("\n");

  for (const line of lines) {
    // Skip single-line comments.
    if (/^\s*\/\//.test(line)) continue;
    // Skip obvious JSX comments.
    if (/^\s*\{\/\*/.test(line)) continue;

    const hexMatches = line.match(hexRe) || [];
    // Filter out false positives like "#/anchor" URL fragments or SVG ids.
    const realHex = hexMatches.filter((m) => /^#[0-9a-fA-F]{3,8}$/.test(m));
    count += realHex.length;

    count += (line.match(rgbRe) || []).length;
    count += (line.match(hslRe) || []).length;
  }

  if (count > 0) {
    report.hardcodedColoursFlagged += count;
    flag(
      file,
      `${count} hardcoded colour literal(s) — replace with var(--token) from theme.css`
    );
  }
}

// --------------------------------------------------------------------------------------
// DETECT: custom dropdowns/selects
// --------------------------------------------------------------------------------------
// Flags both native <select> and obvious custom dropdown className patterns.
function detectCustomSelects(file, source) {
  const nativeSelect = (source.match(/<select\b/g) || []).length;
  const customDropdown =
    (source.match(/className\s*=\s*["'`][^"'`]*\b(dropdown|select|combobox)\b[^"'`]*["'`]/gi) || [])
      .length;

  const total = nativeSelect + customDropdown;
  if (total > 0) {
    report.customSelectsFlagged += total;
    flag(
      file,
      `${total} custom/native select occurrence(s) — use global Select component`
    );
  }
}

// --------------------------------------------------------------------------------------
// DETECT: custom inputs
// --------------------------------------------------------------------------------------
// Flags raw <input> tags (type text/email/number/password/search/tel/url). Skips
// checkbox, radio, file, hidden — those are usually fine as-is.
function detectCustomInputs(file, source) {
  const re = /<input\b[^>]*>/g;
  const matches = source.match(re) || [];

  const textLike = matches.filter((m) => {
    const typeMatch = m.match(/type\s*=\s*["'`]([^"'`]+)["'`]/);
    const type = typeMatch ? typeMatch[1].toLowerCase() : "text";
    return ["text", "email", "number", "password", "search", "tel", "url", "date"].includes(type);
  });

  if (textLike.length > 0) {
    report.customInputsFlagged += textLike.length;
    flag(
      file,
      `${textLike.length} raw <input> occurrence(s) — use global Input component`
    );
  }
}

// --------------------------------------------------------------------------------------
// DETECT: manual tables
// --------------------------------------------------------------------------------------
// Flags files that hand-roll <table>/<thead>/<tbody>. These should use the project's
// shared table component (if one exists) or at minimum a token-styled wrapper.
function detectManualTables(file, source) {
  if (/<table\b/.test(source) && /<thead\b/.test(source) && /<tbody\b/.test(source)) {
    report.manualTablesFlagged += 1;
    flag(file, `manual <table>/<thead>/<tbody> detected — use global Table component if available`);
  }
}

// --------------------------------------------------------------------------------------
// DETECT: random classNames not using the global system
// --------------------------------------------------------------------------------------
// Heuristic: a className is considered "random" when it is NOT one of:
//   - a known global layout class (.app-*)
//   - a known utility prefix the project uses (e.g. "section-", "page-")
//   - an expression / dynamic template
// We err on the side of flagging rather than rewriting, since class tokens carry
// meaning we can't safely rename.
function detectRandomClassNames(file, source) {
  const re = /className\s*=\s*"([^"]+)"/g;
  let match;
  let count = 0;

  const allowedPrefixes = [
    "app-",
    "section-",
    "page-",
    "text-",
    "flex",
    "grid",
    "sr-only",
  ];

  while ((match = re.exec(source)) !== null) {
    const value = match[1].trim();
    if (!value) continue;

    const tokens = value.split(/\s+/);
    const allAllowed = tokens.every((t) =>
      allowedPrefixes.some((p) => t === p || t.startsWith(p))
    );

    if (!allAllowed) count += 1;
  }

  if (count > 0) {
    report.randomClassNamesFlagged += count;
    flag(
      file,
      `${count} className(s) not using global system (app-*, section-*, page-*) — review`
    );
  }
}

// --------------------------------------------------------------------------------------
// PROCESS A SINGLE FILE
// --------------------------------------------------------------------------------------
// Reads the file, runs transforms (which mutate a working copy of the source),
// runs detectors (which only log flags), and conditionally writes the file back.
function processFile(file) {
  report.filesScanned += 1;

  let source;
  try {
    source = fs.readFileSync(file, "utf8");
  } catch (err) {
    console.warn(`Could not read ${file}: ${err.message}`);
    return;
  }

  const original = source;
  let working = source;
  let fileChanged = false;
  let fileFlagged = false;

  // --- TRANSFORMS (modify source) ---
  const btn = transformButtons(file, working);
  if (btn.changed) {
    working = btn.source;
    fileChanged = true;
    change(file, `rewrote <button> → <Button> (${report.buttonsRewritten} total so far)`);
  }

  // --- DETECTORS (log only) ---
  // Count flags before vs after so we know whether to mark the file as flagged.
  const beforeFlags =
    report.inlineStylesFlagged +
    report.hardcodedColoursFlagged +
    report.customSelectsFlagged +
    report.customInputsFlagged +
    report.manualTablesFlagged +
    report.randomClassNamesFlagged;

  detectInlineStyles(file, working);
  detectHardcodedColours(file, working);
  detectCustomSelects(file, working);
  detectCustomInputs(file, working);
  detectManualTables(file, working);
  detectRandomClassNames(file, working);

  const afterFlags =
    report.inlineStylesFlagged +
    report.hardcodedColoursFlagged +
    report.customSelectsFlagged +
    report.customInputsFlagged +
    report.manualTablesFlagged +
    report.randomClassNamesFlagged;

  if (afterFlags > beforeFlags) fileFlagged = true;

  // --- WRITE ---
  if (fileChanged && working !== original) {
    if (WRITE_MODE) {
      // Backup first. Only create the .bak if one doesn't already exist, so repeated
      // runs don't lose the pristine original.
      const backup = `${file}.bak`;
      if (!fs.existsSync(backup)) {
        fs.writeFileSync(backup, original, "utf8");
      }
      fs.writeFileSync(file, working, "utf8");
      change(file, `wrote changes (backup at ${path.basename(backup)})`);
    } else {
      change(file, `would write changes (dry run — rerun with --write to apply)`);
    }
    report.filesChanged += 1;
  } else if (VERBOSE && !fileFlagged) {
    log(file, `no changes`);
  }

  if (fileFlagged) report.filesFlagged += 1;
}

// --------------------------------------------------------------------------------------
// MAIN
// --------------------------------------------------------------------------------------
function main() {
  console.log("Global UI Refactor");
  console.log("------------------");
  console.log(`Project root : ${PROJECT_ROOT}`);
  console.log(`Mode         : ${WRITE_MODE ? "WRITE (backups .bak)" : "DRY RUN (no writes)"}`);
  console.log(`Verbose      : ${VERBOSE ? "on" : "off"}`);
  console.log("");

  const files = walk(PROJECT_ROOT);
  console.log(`Found ${files.length} .js / .jsx files to scan.`);
  console.log("");

  for (const file of files) {
    processFile(file);
  }

  // --- SUMMARY ---
  console.log("");
  console.log("Summary");
  console.log("-------");
  console.log(`Files scanned                : ${report.filesScanned}`);
  console.log(`Files changed                : ${report.filesChanged}`);
  console.log(`Files with flags             : ${report.filesFlagged}`);
  console.log(`<button> → <Button> rewrites : ${report.buttonsRewritten}`);
  console.log(`Inline style={{}} flags      : ${report.inlineStylesFlagged}`);
  console.log(`Hardcoded colour flags       : ${report.hardcodedColoursFlagged}`);
  console.log(`Custom/native select flags   : ${report.customSelectsFlagged}`);
  console.log(`Raw <input> flags            : ${report.customInputsFlagged}`);
  console.log(`Manual <table> flags         : ${report.manualTablesFlagged}`);
  console.log(`Non-global className flags   : ${report.randomClassNamesFlagged}`);
  console.log("");

  if (!WRITE_MODE) {
    console.log("Dry run complete. Rerun with --write to apply transforms.");
  } else {
    console.log("Write complete. Review .bak files and run the app to verify UI.");
  }
}

main();
