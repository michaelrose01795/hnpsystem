// file location: tools/scripts/buildAppKnowledge.js
//
// Knowledge index refresh script for the HNP System App Guide.
//
// Run with:
//   node scripts/buildAppKnowledge.js
//
// What this script does:
//   1. Reads the navigation config to extract all routes and their allowed roles
//   2. Scans src/pages/api for API route file names (gives a sense of features)
//   3. Reads the existing knowledgeIndex.json as a base
//   4. Merges in any new routes found from the navigation that aren't already in the index
//   5. Writes the updated index back to src/features/appGuide/knowledgeIndex.json
//
// This keeps the knowledge index in sync with the navigation config.
// For deep content updates (descriptions, how-tos, etc.) edit knowledgeIndex.json directly.
//
// NOTE: This script uses CommonJS require() so it runs with plain `node` without transpiling.

const fs = require("fs");
const path = require("path");

// ─── Paths ────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..");
const NAV_CONFIG_PATH = path.join(ROOT, "src", "config", "navigation.js");
const KNOWLEDGE_INDEX_PATH = path.join(ROOT, "src", "features", "appGuide", "knowledgeIndex.json");
const API_DIR = path.join(ROOT, "src", "pages", "api");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(message) {
  console.log(`[buildAppKnowledge] ${message}`);
}

function warn(message) {
  console.warn(`[buildAppKnowledge] WARN: ${message}`);
}

/**
 * Read and parse the knowledge index JSON file.
 */
function readKnowledgeIndex() {
  try {
    const raw = fs.readFileSync(KNOWLEDGE_INDEX_PATH, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    warn(`Could not read existing knowledge index: ${err.message}`);
    return { _meta: {}, entries: [] };
  }
}

/**
 * Parse the navigation.js config file using a simple regex approach.
 * Extracts { label, href, roles } from each item in sidebarSections.
 * Does not use require() on the file to avoid ESM/CJS issues.
 */
function extractNavigationItems() {
  let source;
  try {
    source = fs.readFileSync(NAV_CONFIG_PATH, "utf8");
  } catch (err) {
    warn(`Could not read navigation config: ${err.message}`);
    return [];
  }

  const items = [];
  // Match item objects: { label: "...", href: "...", roles: [...] }
  const itemPattern = /\{\s*label:\s*["']([^"']+)["']\s*,\s*href:\s*(["'][^"']*["']|null)\s*(?:,\s*roles:\s*\[([^\]]*)\])?\s*(?:,\s*action:\s*["'][^"']*["'])?\s*\}/g;
  let match;
  while ((match = itemPattern.exec(source)) !== null) {
    const label = match[1];
    const hrefRaw = match[2].trim();
    const href = hrefRaw === "null" ? null : hrefRaw.replace(/["']/g, "");
    const rolesRaw = match[3] || "";
    const roles = rolesRaw
      .split(",")
      .map((r) => r.trim().replace(/["']/g, "").toLowerCase())
      .filter(Boolean);

    if (href) {
      items.push({ label, href, roles });
    }
  }

  return items;
}

/**
 * Scan the API directory and return a list of route file paths.
 * Useful for building an overview of available API features.
 */
function scanApiRoutes() {
  const routes = [];
  function walk(dir, prefix = "/api") {
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath, `${prefix}/${entry}`);
      } else if (entry.endsWith(".js") && !entry.startsWith("_")) {
        const routeName = entry.replace(/\.js$/, "").replace(/\[([^\]]+)\]/, ":$1");
        routes.push(`${prefix}/${routeName}`);
      }
    }
  }
  walk(API_DIR);
  return routes;
}

/**
 * Convert a navigation item to a slugified entry ID.
 */
function labelToId(label) {
  return "page-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Merge navigation items into the existing knowledge index.
 * Only adds entries that don't already exist (by route match).
 */
function mergeNavigationItems(index, navItems) {
  const existingRoutes = new Set(
    index.entries
      .filter((e) => e.route)
      .map((e) => e.route)
  );

  let added = 0;

  for (const item of navItems) {
    if (!item.href || existingRoutes.has(item.href)) {
      continue; // already in the index
    }

    const newEntry = {
      id: labelToId(item.label),
      type: "page",
      title: item.label,
      keywords: item.label.toLowerCase().split(/\s+/),
      route: item.href,
      roles: item.roles,
      description: `${item.label} page in the HNP System.`,
      details: "",
      relatedIds: [],
    };

    index.entries.push(newEntry);
    existingRoutes.add(item.href);
    added++;
    log(`Added new entry: ${item.label} (${item.href})`);
  }

  if (added === 0) {
    log("No new navigation items to add — knowledge index is up to date.");
  } else {
    log(`Added ${added} new entries from navigation config.`);
  }

  return index;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  log("Starting knowledge index rebuild...");

  // 1. Read existing index
  const index = readKnowledgeIndex();
  log(`Loaded ${index.entries.length} existing entries.`);

  // 2. Extract navigation items
  const navItems = extractNavigationItems();
  log(`Found ${navItems.length} navigation items in ${NAV_CONFIG_PATH}`);

  // 3. Scan API routes (informational only — logged, not written to index)
  const apiRoutes = scanApiRoutes();
  log(`Found ${apiRoutes.length} API route files in src/pages/api`);

  // 4. Merge navigation items into the index
  const updatedIndex = mergeNavigationItems(index, navItems);

  // 5. Update metadata
  updatedIndex._meta = {
    ...updatedIndex._meta,
    version: updatedIndex._meta?.version || "1.0",
    description:
      "HNP System in-app knowledge index. Used by the App Guide assistant to answer user questions about the application. Regenerate with: node scripts/buildAppKnowledge.js",
    generatedAt: new Date().toISOString(),
    entryCount: updatedIndex.entries.length,
  };

  // 6. Write back
  try {
    fs.writeFileSync(
      KNOWLEDGE_INDEX_PATH,
      JSON.stringify(updatedIndex, null, 2),
      "utf8"
    );
    log(`Knowledge index written to ${KNOWLEDGE_INDEX_PATH}`);
    log(`Total entries: ${updatedIndex.entries.length}`);
  } catch (err) {
    console.error(`[buildAppKnowledge] ERROR writing knowledge index: ${err.message}`);
    process.exit(1);
  }

  log("Done.");
}

main();
