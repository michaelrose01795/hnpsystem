// file location: src/pages/api/dev/staff-style-review/locate.js
//
// Resolves an audit source reference (file + line) into on-page locator hints
// for the Staff Style Review "Search" button. Read-only: it opens the repo
// source file, hands the surrounding lines to the pure extractor, and adds the
// nearest dev-layout section keys so the client can scope its search.
import fs from "fs";
import path from "path";
import createHandler from "@/lib/api/createHandler";
import { DEV_PLATFORM_ROLE } from "@/lib/auth/roles";
import { extractLocatorHints } from "@/lib/staff-style-review/highlightLocator";
import { DEV_LAYOUT_SECTION_SOURCE_MAP } from "@/lib/dev-layout/sectionSourceMap.generated";

// Only repo source files are readable, and only by exact shape — no traversal,
// no absolute paths, no reaching outside src/.
const SOURCE_PATH_PATTERN = /^src\/[A-Za-z0-9_\-./[\]]+\.(?:js|jsx|ts|tsx)$/;
const MAX_SECTION_KEYS = 4;

function isSafeSourcePath(candidate) {
  if (!SOURCE_PATH_PATTERN.test(candidate)) return false;
  if (candidate.includes("..")) return false;
  const root = path.join(process.cwd(), "src");
  const resolved = path.resolve(process.cwd(), candidate);
  return resolved.startsWith(root + path.sep);
}

// The audited line rarely coincides with a section registration, so take the
// nearest registrations above and below it in the same file.
function nearestSectionKeys(file, lineNumber) {
  const entries = DEV_LAYOUT_SECTION_SOURCE_MAP
    .filter((entry) => entry.file === file && entry.key)
    .map((entry) => ({ key: entry.key, line: entry.line, distance: Math.abs(Number(entry.line) - lineNumber) }))
    .sort((left, right) => left.distance - right.distance);

  const seen = new Set();
  return entries
    .filter((entry) => (seen.has(entry.key) ? false : seen.add(entry.key)))
    .slice(0, MAX_SECTION_KEYS)
    .map((entry) => ({ key: entry.key, line: entry.line }));
}

async function handleGet(req, res) {
  const file = String(req.query.file || "").trim().replace(/\\/g, "/");
  const line = Number.parseInt(String(req.query.line || ""), 10);

  if (!isSafeSourcePath(file)) {
    return res.status(400).json({ success: false, message: "A repository source path under src/ is required." });
  }
  if (!Number.isInteger(line) || line < 1) {
    return res.status(400).json({ success: false, message: "A positive line number is required." });
  }

  let contents;
  try {
    contents = fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
  } catch {
    return res.status(404).json({ success: false, message: `Source file ${file} could not be read on the server.` });
  }

  const lines = contents.split(/\r?\n/);
  if (line > lines.length) {
    return res.status(404).json({ success: false, message: `${file} has no line ${line}; the audit reference is stale.` });
  }

  return res.status(200).json({
    success: true,
    data: {
      file,
      line,
      sourceLine: lines[line - 1]?.trim() || "",
      hints: extractLocatorHints(lines, line),
      sectionKeys: nearestSectionKeys(file, line),
    },
  });
}

export default createHandler({
  allowedRoles: [DEV_PLATFORM_ROLE],
  methods: { GET: handleGet },
});
