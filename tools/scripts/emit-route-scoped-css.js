// file location: tools/scripts/emit-route-scoped-css.js
//
// Emits the two global stylesheets that only a handful of routes actually use as
// standalone static assets, so the rest of the app stops paying for them.
//
// The problem this solves
// -----------------------
// Next's Pages Router only accepts global CSS imported from _app, and everything
// _app imports is bundled into the stylesheet EVERY route loads. Measured against
// production, that put 82 KB of render-blocking CSS on all 162 routes:
//
//   custglobal.css   ~121 KB source — every rule is scoped to `html.website-scope`,
//                    which only /website and /website/* ever set on <html>.
//   trackingMap.css    ~8 KB source — the site-map diagram on /tracking.
//
// (Portalled dropdown menus carry a `website-scope` class of their own on staff
// pages, but every rule in custglobal.css is anchored on `html.website-scope`, so
// none of them can match unless the ROOT element is scoped. Staff pages render
// identically without this file — that is what makes moving it safe.)
//
// A previous attempt to import custglobal.css from the customer layout was
// reverted because Next rejects global CSS outside _app. This takes the other
// documented route out: emit it as a plain static asset and <link> it only from
// the routes that need it (see _document.js for the first-paint link and _app.js
// for the client-navigation link).
//
// Output is content-hashed in the filename so the assets stay immutably
// cacheable and a change to the source can never be served stale.
//
// Runs from predev / prebuild.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public", "route-css");
const MANIFEST = path.join(ROOT, "src", "config", "routeScopedCss.generated.json");

// key → source file. The key is what _app.js / _document.js look up.
const SHEETS = {
  website: "src/styles/custglobal.css",
  trackingMap: "src/features/tracking/map/trackingMap.css",
};

let transform = null;
try {
  ({ transform } = require("lightningcss"));
} catch {
  // Minification is an optimisation, not a correctness requirement. Without
  // lightningcss the source is emitted verbatim and still works.
}

const minify = (code, filename) => {
  if (!transform) return code;
  try {
    const { code: out } = transform({
      filename,
      code: Buffer.from(code),
      minify: true,
      // Match what the Next pipeline targeted; no syntax lowering surprises.
      targets: { chrome: 100 << 16, firefox: 100 << 16, safari: 15 << 16 },
    });
    return out.toString();
  } catch (error) {
    console.warn(`[route-css] minify failed for ${filename}, emitting source:`, error.message);
    return code;
  }
};

const run = () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Drop previously emitted files so old hashes do not accumulate in public/.
  for (const stale of fs.readdirSync(OUT_DIR)) {
    if (stale.endsWith(".css")) fs.unlinkSync(path.join(OUT_DIR, stale));
  }

  const manifest = {};

  for (const [key, relativeSource] of Object.entries(SHEETS)) {
    const source = path.join(ROOT, relativeSource);
    if (!fs.existsSync(source)) {
      throw new Error(`[route-css] missing source stylesheet: ${relativeSource}`);
    }

    const raw = fs.readFileSync(source, "utf8");
    const out = minify(raw, source);
    const hash = crypto.createHash("sha256").update(out).digest("hex").slice(0, 12);
    const fileName = `${key}.${hash}.css`;

    fs.writeFileSync(path.join(OUT_DIR, fileName), out, "utf8");
    manifest[key] = `/route-css/${fileName}`;

    const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
    console.log(`[route-css] ${relativeSource} → ${manifest[key]}  (${kb(raw.length)} → ${kb(out.length)})`);
  }

  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`[route-css] manifest → ${path.relative(ROOT, MANIFEST)}`);
};

run();
