#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SCAN_DIRS = [
  "src/pages",
  "src/components",
  "src/customers",
  "src/features",
  "src/styles",
];
const FILE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".css", ".module.css"]);

const SPACING_VALUES = new Map([
  ["4px", "var(--space-xs)"],
  ["6px", "var(--space-1)"],
  ["8px", "var(--space-sm)"],
  ["10px", "var(--space-2)"],
  ["12px", "var(--space-3)"],
  ["14px", "var(--space-4)"],
  ["16px", "var(--space-md)"],
  ["18px", "var(--space-5)"],
  ["20px", "var(--space-6)"],
  ["24px", "var(--space-lg)"],
  ["28px", "var(--space-7)"],
  ["32px", "var(--space-xl)"],
  ["48px", "var(--space-2xl)"],
]);

const RADIUS_VALUES = new Map([
  ["8px", "var(--radius-xs)"],
  ["12px", "var(--radius-sm)"],
  ["16px", "var(--radius-md)"],
  ["20px", "var(--radius-lg)"],
  ["24px", "var(--radius-xl)"],
  ["999px", "var(--radius-pill)"],
]);

const WIDTH_VALUES = new Map([
  ["900px", "var(--page-width-form)"],
  ["1200px", "var(--page-width-content)"],
  ["1440px", "var(--page-content-max-width)"],
  ["1680px", "var(--page-max-width)"],
]);

const BORDER_REPLACEMENTS = new Map([
  ["1px solid var(--surface-light)", "var(--control-border)"],
  ["1px solid rgba(var(--primary-rgb), 0.12)", "var(--page-card-border)"],
  ["1px solid rgba(var(--text-primary-rgb), 0.12)", "var(--control-border)"],
]);

const INLINE_SPACING_PROPS = [
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "gap",
  "rowGap",
  "columnGap",
  "top",
  "right",
  "bottom",
  "left",
  "inset",
];

const CSS_SPACING_PROPS = [
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "gap",
  "row-gap",
  "column-gap",
  "top",
  "right",
  "bottom",
  "left",
  "inset",
];

const WIDTH_PROPS = ["maxWidth", "minWidth", "width", "max-width", "min-width"];
const HEIGHT_PROPS = ["height", "minHeight", "maxHeight", "height", "min-height", "max-height"];

const TAILWIND_REPLACEMENTS = new Map([
  ["rounded-3xl", "rounded-[var(--radius-xl)]"],
  ["rounded-2xl", "rounded-[var(--radius-xl)]"],
  ["rounded-xl", "rounded-[var(--radius-lg)]"],
  ["rounded-lg", "rounded-[var(--radius-md)]"],
  ["rounded-md", "rounded-[var(--radius-sm)]"],
  ["rounded-sm", "rounded-[var(--radius-xs)]"],
  ["rounded-full", "rounded-[var(--radius-pill)]"],
  ["rounded", "rounded-[var(--radius-sm)]"],
  ["bg-white", "bg-[var(--surface)]"],
  ["bg-gray-100", "bg-[var(--surface-light)]"],
  ["border-gray-200", "border-[var(--control-border-color)]"],
  ["border-gray-300", "border-[var(--control-border-color)]"],
  ["max-w-6xl", "max-w-[var(--page-width-content)]"],
  ["max-w-3xl", "max-w-[48rem]"],
  ["max-w-md", "max-w-[28rem]"],
  ["max-w-lg", "max-w-[32rem]"],
  ["p-8", "p-[var(--space-2xl)]"],
  ["p-6", "p-[var(--space-lg)]"],
  ["p-5", "p-[var(--section-card-padding)]"],
  ["p-4", "p-[var(--space-md)]"],
  ["px-6", "px-[var(--space-lg)]"],
  ["px-5", "px-[var(--space-6)]"],
  ["px-4", "px-[var(--space-md)]"],
  ["px-3", "px-[var(--space-3)]"],
  ["py-8", "py-[var(--space-2xl)]"],
  ["py-6", "py-[var(--space-lg)]"],
  ["py-5", "py-[var(--space-6)]"],
  ["py-4", "py-[var(--space-md)]"],
  ["py-3", "py-[var(--space-3)]"],
  ["py-2", "py-[var(--space-sm)]"],
  ["gap-6", "gap-[var(--space-lg)]"],
  ["gap-5", "gap-[var(--space-6)]"],
  ["gap-4", "gap-[var(--space-md)]"],
  ["gap-3", "gap-[var(--space-3)]"],
  ["gap-2", "gap-[var(--space-sm)]"],
  ["space-y-4", "space-y-[var(--space-md)]"],
  ["space-y-3", "space-y-[var(--space-3)]"],
  ["space-y-1", "space-y-[var(--space-1)]"],
  ["mb-4", "mb-[var(--space-md)]"],
  ["mb-3", "mb-[var(--space-3)]"],
  ["mt-4", "mt-[var(--space-md)]"],
  ["mt-3", "mt-[var(--space-3)]"],
  ["mt-2", "mt-[var(--space-sm)]"],
]);

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist" || entry.name === "build") {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (fullPath.includes(`${path.sep}pages${path.sep}api${path.sep}`)) {
      continue;
    }
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    const ext = entry.name.endsWith(".module.css") ? ".module.css" : path.extname(entry.name);
    if (FILE_EXTENSIONS.has(ext)) {
      files.push(fullPath);
    }
  }
  return files;
}

function replaceAll(content, replacements) {
  let next = content;
  for (const [from, to] of replacements.entries()) {
    next = next.replace(new RegExp(`\\b${escapeRegex(from)}\\b`, "g"), to);
  }
  return next;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceInlinePropertyValues(content, props, values) {
  let next = content;
  for (const prop of props) {
    for (const [from, to] of values.entries()) {
      const regex = new RegExp(`(${escapeRegex(prop)}\\s*:\\s*["'\`])${escapeRegex(from)}(["'\`])`, "g");
      next = next.replace(regex, `$1${to}$2`);
    }
  }
  return next;
}

function replaceCssPropertyValues(content, props, values) {
  let next = content;
  for (const prop of props) {
    for (const [from, to] of values.entries()) {
      const regex = new RegExp(`(${escapeRegex(prop)}\\s*:\\s*)${escapeRegex(from)}(\\s*;)`, "g");
      next = next.replace(regex, `$1${to}$2`);
    }
  }
  return next;
}

function replaceLiteralPairs(content) {
  return content
    .replace(/(["'`])10px 12px\1/g, "$1var(--control-padding-sm)$1")
    .replace(/(["'`])10px 14px\1/g, "$1var(--control-padding)$1")
    .replace(/(["'`])8px 12px\1/g, "$1var(--control-padding-sm)$1")
    .replace(/(["'`])8px 16px\1/g, "$1var(--space-sm) var(--space-md)$1")
    .replace(/(["'`])10px 16px\1/g, "$1var(--space-2) var(--space-md)$1")
    .replace(/(["'`])10px 18px\1/g, "$1var(--space-2) var(--space-5)$1")
    .replace(/(["'`])10px 20px\1/g, "$1var(--space-2) var(--space-6)$1")
    .replace(/(["'`])12px 16px\1/g, "$1var(--space-3) var(--space-md)$1")
    .replace(/(["'`])12px 20px\1/g, "$1var(--space-3) var(--space-6)$1")
    .replace(/(["'`])12px 24px\1/g, "$1var(--space-3) var(--space-lg)$1")
    .replace(/(["'`])14px 18px\1/g, "$1var(--space-4) var(--space-5)$1")
    .replace(/(["'`])16px 20px\1/g, "$1var(--space-md) var(--space-6)$1")
    .replace(/(["'`])16px 24px\1/g, "$1var(--space-md) var(--space-lg)$1")
    .replace(/(["'`])20px 24px\1/g, "$1var(--space-6) var(--space-lg)$1")
    .replace(/(["'`])24px 32px\1/g, "$1var(--space-lg) var(--space-xl)$1")
    .replace(/(:\s*)10px 12px(\s*;)/g, "$1var(--control-padding-sm)$2")
    .replace(/(:\s*)10px 14px(\s*;)/g, "$1var(--control-padding)$2")
    .replace(/(:\s*)8px 12px(\s*;)/g, "$1var(--control-padding-sm)$2")
    .replace(/(:\s*)12px 16px(\s*;)/g, "$1var(--space-3) var(--space-md)$2");
}

function replaceBorders(content) {
  let next = content;
  for (const [from, to] of BORDER_REPLACEMENTS.entries()) {
    next = next.replace(new RegExp(escapeRegex(from), "g"), to);
  }
  return next;
}

function replaceTailwindClasses(content) {
  let next = content;
  for (const [from, to] of TAILWIND_REPLACEMENTS.entries()) {
    next = next.replace(new RegExp(`\\b${escapeRegex(from)}\\b`, "g"), to);
  }
  return next;
}

function cleanDuplicates(content) {
  return content
    .replace(/className="([^"]*?)\s+"/g, 'className="$1"')
    .replace(/className='([^']*?)\s+'/g, "className='$1'")
    .replace(/ rounded-\[var\(--radius-sm\)\] rounded-\[var\(--radius-sm\)\]/g, " rounded-[var(--radius-sm)]")
    .replace(/ border-\[var\(--control-border-color\)\] border-\[var\(--control-border-color\)\]/g, " border-[var(--control-border-color)]");
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  let next = original;

  next = replaceInlinePropertyValues(next, INLINE_SPACING_PROPS, SPACING_VALUES);
  next = replaceCssPropertyValues(next, CSS_SPACING_PROPS, SPACING_VALUES);
  next = replaceInlinePropertyValues(next, ["borderRadius"], RADIUS_VALUES);
  next = replaceCssPropertyValues(next, ["border-radius"], RADIUS_VALUES);
  next = replaceInlinePropertyValues(next, WIDTH_PROPS, WIDTH_VALUES);
  next = replaceCssPropertyValues(next, WIDTH_PROPS, WIDTH_VALUES);
  next = replaceLiteralPairs(next);
  next = replaceBorders(next);
  next = replaceTailwindClasses(next);
  next = cleanDuplicates(next);

  if (next !== original) {
    fs.writeFileSync(filePath, next);
    return true;
  }
  return false;
}

const files = SCAN_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));
const changed = [];

for (const file of files) {
  if (processFile(file)) {
    changed.push(path.relative(ROOT, file));
  }
}

process.stdout.write(`${JSON.stringify({ changedCount: changed.length, changed }, null, 2)}\n`);
