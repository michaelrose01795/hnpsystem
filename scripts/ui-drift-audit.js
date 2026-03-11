#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SCAN_DIRS = [
  "src/app",
  "src/pages",
  "src/components",
  "src/customers",
  "src/features",
  "src/layout",
  "src/ui",
  "src/styles",
];
const FILE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".css", ".module.css"]);

const CATEGORY_CONFIG = [
  {
    key: "spacing",
    label: "spacing inconsistencies",
    regexes: [
      /\b(?:margin|marginTop|marginRight|marginBottom|marginLeft|padding|paddingTop|paddingRight|paddingBottom|paddingLeft|gap|rowGap|columnGap|top|right|bottom|left|inset):\s*["'`]([^"'`]+)["'`]/g,
      /\b(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|space-x|space-y)-(\[[^\]]+\]|\d+)/g,
    ],
    tokenMap: {
      "4px": "var(--space-xs)",
      "6px": "var(--space-1)",
      "8px": "var(--space-sm)",
      "10px": "var(--space-2)",
      "12px": "var(--space-3)",
      "14px": "var(--space-4)",
      "16px": "var(--space-md)",
      "18px": "var(--space-5)",
      "20px": "var(--space-6)",
      "24px": "var(--space-lg)",
      "28px": "var(--space-7)",
      "32px": "var(--space-xl)",
      "48px": "var(--space-2xl)",
    },
  },
  {
    key: "radius",
    label: "radius inconsistencies",
    regexes: [
      /\b(?:borderRadius):\s*["'`]([^"'`]+)["'`]/g,
      /\brounded(?:-[trblxy]{1,2})?(?:-(?:none|sm|md|lg|xl|2xl|3xl|full|\[[^\]]+\]|\d+))?\b/g,
    ],
    tokenMap: {
      "8px": "var(--radius-xs)",
      "12px": "var(--radius-sm)",
      "16px": "var(--radius-md)",
      "20px": "var(--radius-lg)",
      "24px": "var(--radius-xl)",
      "999px": "var(--radius-pill)",
      "rounded-xl": "var(--radius-lg)",
      "rounded-2xl": "var(--radius-xl)",
      "rounded-3xl": "var(--radius-xl)",
      "rounded-full": "var(--radius-pill)",
    },
  },
  {
    key: "controlHeight",
    label: "control height inconsistencies",
    regexes: [
      /\b(?:height|minHeight|maxHeight):\s*["'`]([^"'`]+)["'`]/g,
      /\b(?:h|min-h|max-h)-(\[[^\]]+\]|\d+)/g,
    ],
    tokenMap: {
      "34px": "var(--control-height-xs)",
      "40px": "var(--control-height-sm)",
      "44px": "var(--control-height)",
    },
  },
  {
    key: "pageWidth",
    label: "page/container width inconsistencies",
    regexes: [
      /\b(?:width|minWidth|maxWidth):\s*["'`]([^"'`]+)["'`]/g,
      /\b(?:w|min-w|max-w)-(\[[^\]]+\]|\d+xl|\d+)/g,
    ],
    tokenMap: {
      "900px": "var(--page-width-form)",
      "1200px": "var(--page-width-content)",
      "1440px": "var(--page-content-max-width)",
      "1680px": "var(--page-max-width)",
      "720px": "tokenize or keep local if modal-specific",
      "820px": "tokenize or keep local if modal-specific",
      "1000px": "consider var(--page-width-content)",
    },
  },
  {
    key: "surface",
    label: "surface/background inconsistencies",
    regexes: [
      /\b(?:background|backgroundColor|boxShadow|border|borderColor):\s*["'`]([^"'`]+)["'`]/g,
      /\b(?:bg|border|shadow)-(\[[^\]]+\]|[a-zA-Z0-9/-]+)/g,
    ],
    tokenMap: {
      "bg-white": "var(--surface)",
      "bg-gray-100": "var(--surface-light)",
      "bg-[var(--surface)]": "var(--surface)",
      "border-[var(--surface-light)]": "var(--control-border-color)",
      "shadow-lg": "var(--shadow-lg)",
    },
  },
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist" || entry.name === "build") {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
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

function normalizeValue(raw) {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, " ");
}

function collectMatches(content, regex) {
  const matches = [];
  let match;
  while ((match = regex.exec(content))) {
    const value = normalizeValue(match[1] || match[0]);
    matches.push({ value, index: match.index });
  }
  return matches;
}

function lineForIndex(content, index) {
  return content.slice(0, index).split("\n").length;
}

const files = SCAN_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));
const results = Object.fromEntries(CATEGORY_CONFIG.map((config) => [config.key, new Map()]));
const pageOverrides = new Set();

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const relativePath = path.relative(ROOT, file);

  if (
    /style=\{\{[^}]*\b(?:padding|maxWidth|background|borderRadius|height|width|gap)\b[^}]*["'`](?!var\(--)/s.test(content) ||
    /className="[^"]*(?:rounded-(?!\[var)|max-w-(?!\[var)|p-(?:\d)|px-(?:\d)|py-(?:\d)|gap-(?:\d)|bg-white|bg-gray-100|border-gray-(?:200|300))/.test(content)
  ) {
    pageOverrides.add(relativePath);
  }

  for (const config of CATEGORY_CONFIG) {
    for (const regex of config.regexes) {
      const matches = collectMatches(content, new RegExp(regex.source, regex.flags));
      for (const match of matches) {
        const bucket = results[config.key];
        if (!bucket.has(match.value)) {
          bucket.set(match.value, []);
        }
        bucket.get(match.value).push({
          file: relativePath,
          line: lineForIndex(content, match.index),
          suggestion: config.tokenMap[match.value] || null,
        });
      }
    }
  }
}

function summariseCategory(config) {
  const values = Array.from(results[config.key].entries())
    .filter(([, entries]) => entries.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  return {
    key: config.key,
    label: config.label,
    repeatedValues: values.map(([value, entries]) => ({
      value,
      count: entries.length,
      suggestion: entries.find((entry) => entry.suggestion)?.suggestion || null,
      locations: entries.slice(0, 12),
    })),
  };
}

const report = {
  scannedAt: new Date().toISOString(),
  scannedDirectories: SCAN_DIRS,
  totalFiles: files.length,
  categories: CATEGORY_CONFIG.map(summariseCategory),
  pageLevelOverrides: Array.from(pageOverrides).sort(),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
