#!/usr/bin/env node
// file location: tools/scripts/check-encoding.js
// Fails when common UTF-8 mojibake check/cross symbols are committed to UI code.

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "../..");
const scanRoots = ["src"];
const extensions = new Set([".js", ".jsx", ".ts", ".tsx", ".css", ".md"]);

const forbidden = [
  { label: "mojibake check mark", value: "\u00e2\u0153\u201c" },
  { label: "mojibake heavy check mark", value: "\u00e2\u0153\u2026" },
  { label: "mojibake multiplication/cross", value: "\u00e2\u0153\u2022" },
  { label: "mojibake heavy cross", value: "\u00e2\u009d\u0152" },
  { label: "replacement character", value: "\ufffd" },
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (extensions.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

const hits = [];
for (const scanRoot of scanRoots) {
  const start = path.join(root, scanRoot);
  if (!fs.existsSync(start)) continue;
  for (const file of walk(start)) {
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      forbidden.forEach((pattern) => {
        if (line.includes(pattern.value)) {
          hits.push({
            file: path.relative(root, file),
            line: index + 1,
            label: pattern.label,
          });
        }
      });
    });
  }
}

if (hits.length) {
  console.error("Encoding check failed. Replace corrupted symbols with text or SVG icons:");
  hits.forEach((hit) => {
    console.error(`- ${hit.file}:${hit.line} (${hit.label})`);
  });
  process.exit(1);
}

console.log("Encoding check passed.");
