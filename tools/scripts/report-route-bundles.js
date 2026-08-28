// file location: tools/scripts/report-route-bundles.js
//
// First-load JS per page route, read out of the production build manifest.
//
// Next 16 + Turbopack only prints its own route/size table when stdout is a
// TTY, so `npm run build` piped to a file (CI, or an agent shell) shows route
// names with no sizes at all. This reproduces the number that matters for a
// performance pass - the bytes a cold visit to a route has to download before
// React runs - straight from .next/build-manifest.json, so a before/after
// comparison is reproducible and diffable.
//
// First load = the route's own chunks + the chunks every page pays for
// (rootMainFiles, polyfills and /_app). Chunks pulled in later by next/dynamic
// are deliberately excluded, which is exactly why deferring a modal moves the
// number and why an eagerly imported one does not.
//
// Usage:
//   npm run report:bundles                    # 20 heaviest routes
//   npm run report:bundles -- --all           # every route
//   npm run report:bundles -- /tech/          # routes matching a substring
//   npm run report:bundles -- --json          # machine-readable
//   npm run report:bundles -- --save <file>   # write JSON for a later --diff
//   npm run report:bundles -- --diff <file>   # compare against a saved run

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, ".next/build-manifest.json");

if (!fs.existsSync(MANIFEST)) {
  console.error("No .next/build-manifest.json - run `npm run build` first.");
  process.exit(1);
}

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const valueOf = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const filters = argv.filter((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--save" && argv[argv.indexOf(a) - 1] !== "--diff");

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));

const sizeOf = (file) => {
  try {
    return fs.statSync(path.join(ROOT, ".next", file)).size;
  } catch {
    return 0; // Server-only or already-pruned entry; contributes nothing to first load.
  }
};

// Chunks every page pays for, regardless of route.
const alwaysLoaded = new Set([
  ...(manifest.rootMainFiles || []),
  ...(manifest.polyfillFiles || []),
  ...(manifest.pages["/_app"] || []),
]);

const routes = Object.entries(manifest.pages)
  .filter(([route]) => route !== "/_app" && route !== "/_error" && route !== "/_document")
  .map(([route, files]) => {
    const all = new Set([...alwaysLoaded, ...files]);
    let js = 0;
    let css = 0;
    for (const file of all) {
      if (file.endsWith(".css")) css += sizeOf(file);
      else if (file.endsWith(".js")) js += sizeOf(file);
    }
    const routeOnly = files
      .filter((f) => f.endsWith(".js") && !alwaysLoaded.has(f))
      .reduce((total, f) => total + sizeOf(f), 0);
    return { route, firstLoadJs: js, routeOnlyJs: routeOnly, css };
  })
  .sort((a, b) => b.firstLoadJs - a.firstLoadJs);

const selected = filters.length
  ? routes.filter((r) => filters.some((f) => r.route.includes(f)))
  : flag("--all")
    ? routes
    : routes.slice(0, 20);

const savePath = valueOf("--save");
if (savePath) {
  fs.writeFileSync(savePath, `${JSON.stringify(routes, null, 2)}\n`, "utf8");
  console.log(`Wrote ${routes.length} route sizes to ${savePath}.`);
}

if (flag("--json")) {
  console.log(JSON.stringify(selected, null, 2));
  process.exit(0);
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
const pad = (text, width) => String(text).padStart(width);

const diffPath = valueOf("--diff");
const previous = diffPath ? new Map(JSON.parse(fs.readFileSync(diffPath, "utf8")).map((r) => [r.route, r])) : null;

console.log("");
console.log(`${pad("First Load JS", 14)}  ${pad("route-only", 11)}  ${pad("CSS", 9)}${previous ? `  ${pad("change", 12)}` : ""}  Route`);
for (const row of selected) {
  let change = "";
  if (previous) {
    const before = previous.get(row.route);
    if (!before) change = "  " + pad("new", 12);
    else {
      const delta = row.firstLoadJs - before.firstLoadJs;
      change = "  " + pad(delta === 0 ? "-" : `${delta > 0 ? "+" : ""}${(delta / 1024).toFixed(1)} kB`, 12);
    }
  }
  console.log(`${pad(kb(row.firstLoadJs), 14)}  ${pad(kb(row.routeOnlyJs), 11)}  ${pad(kb(row.css), 9)}${change}  ${row.route}`);
}
console.log("");
