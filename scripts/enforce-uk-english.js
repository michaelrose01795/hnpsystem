#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SHOULD_FIX = process.argv.includes("--fix");
const SCAN_ALL_CODE = process.argv.includes("--all");

const IGNORE_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "out",
  "build",
  ".vercel",
  ".claude",
  "tmp",
]);

const TEXT_EXTENSIONS = new Set([".md", ".txt", ".sql", ".yml", ".yaml", ".json"]);
const CODE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".css", ".scss"]);
const SCAN_EXTENSIONS = SCAN_ALL_CODE
  ? new Set([...TEXT_EXTENSIONS, ...CODE_EXTENSIONS])
  : TEXT_EXTENSIONS;

const SAFE_FIX_EXTENSIONS = new Set([".md", ".txt", ".sql", ".yml", ".yaml"]);

const SKIP_FILES = new Set([
  "package-lock.json",
  "scripts/enforce-uk-english.js",
  "src/lib/database/schema/addtable.sql",
]);

const US_TO_UK = {
  color: "colour",
  colors: "colours",
  colored: "coloured",
  coloring: "colouring",
  favorite: "favourite",
  favorites: "favourites",
  optimize: "optimise",
  optimized: "optimised",
  optimizing: "optimising",
  organization: "organisation",
  organizations: "organisations",
  organize: "organise",
  organized: "organised",
  organizing: "organising",
  authorization: "authorisation",
  authorizations: "authorisations",
  authorize: "authorise",
  authorized: "authorised",
  authorizing: "authorising",
  catalog: "catalogue",
  catalogs: "catalogues",
  behavior: "behaviour",
  behaviors: "behaviours",
  center: "centre",
  centers: "centres",
  theater: "theatre",
  theaters: "theatres",
  gray: "grey",
  traveler: "traveller",
  travelers: "travellers",
  license: "licence",
  licenses: "licences",
};

const termEntries = Object.entries(US_TO_UK);

const toCaseLike = (source, replacement) => {
  if (source.toUpperCase() === source) return replacement.toUpperCase();
  if (source[0] && source[0].toUpperCase() === source[0]) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const walk = (dir, files = []) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(fullPath, files);
      continue;
    }
    const ext = path.extname(entry.name);
    const rel = path.relative(ROOT, fullPath).replace(/\\/g, "/");
    if (SKIP_FILES.has(rel)) continue;
    if (SCAN_EXTENSIONS.has(ext)) files.push(fullPath);
  }
  return files;
};

const lineNumberAt = (text, idx) => text.slice(0, idx).split("\n").length;

const findings = [];
let fixedFiles = 0;

for (const file of walk(ROOT)) {
  const ext = path.extname(file);
  const relativePath = path.relative(ROOT, file).replace(/\\/g, "/");
  const original = fs.readFileSync(file, "utf8");
  let next = original;
  let fileChanged = false;

  for (const [us, uk] of termEntries) {
    const regex = new RegExp(`\\b${escapeRegExp(us)}\\b`, "gi");
    const matches = [...next.matchAll(regex)];
    if (!matches.length) continue;

    for (const match of matches) {
      findings.push({
        file: relativePath,
        line: lineNumberAt(next, match.index || 0),
        us: match[0],
        uk: toCaseLike(match[0], uk),
      });
    }

    if (SHOULD_FIX && SAFE_FIX_EXTENSIONS.has(ext)) {
      next = next.replace(regex, (m) => toCaseLike(m, uk));
      fileChanged = true;
    }
  }

  if (fileChanged && next !== original) {
    fs.writeFileSync(file, next, "utf8");
    fixedFiles += 1;
  }
}

if (findings.length === 0) {
  console.log("UK English check passed: no US spellings found in scanned files.");
  process.exit(0);
}

const summary = new Map();
for (const finding of findings) {
  const key = `${finding.us.toLowerCase()} -> ${finding.uk.toLowerCase()}`;
  summary.set(key, (summary.get(key) || 0) + 1);
}

console.error("UK English check found non-UK spellings:");
for (const [rule, count] of summary.entries()) {
  console.error(`- ${rule}: ${count}`);
}

for (const finding of findings.slice(0, 150)) {
  console.error(`  ${finding.file}:${finding.line} ${finding.us} -> ${finding.uk}`);
}

if (findings.length > 150) {
  console.error(`  ...and ${findings.length - 150} more.`);
}

if (SHOULD_FIX) {
  console.error(`Auto-fix mode updated ${fixedFiles} file(s) with safe text extensions.`);
}

process.exit(1);
