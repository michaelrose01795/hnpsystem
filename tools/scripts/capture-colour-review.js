#!/usr/bin/env node
// file location: tools/scripts/capture-colour-review.js
//
// Visual companion to tools/scripts/check-colour-system.js.
//
// check:colours proves the NUMBERS — every surface step and text pairing
// clears its floor for all 9 accents x 2 modes. This proves the PAGES: it
// renders the real staff stylesheets (theme.css + staffglobal.css + every
// family file) against a fixture exercising each component family in each of
// its states, paints the tokens through the shared derivation in
// themeRuntime.js, and screenshots the result per accent and mode.
//
// It renders a static fixture rather than driving the running app on purpose:
//   - hover / active / disabled / selected states are all visible at once,
//     which you cannot get from a live page screenshot;
//   - it needs no auth, no database and no dev server;
//   - the app's own theme switch reads the signed-in user's stored preference,
//     so localStorage alone cannot force a mode in a live page.
//
// Run: npm run review:colours     Output: e2e/.colour-review/
//
// This is a review aid, not a gate — it is deliberately NOT wired into
// predev/prebuild. Requires playwright (already a devDependency).

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = process.cwd();
const STYLES = path.join(ROOT, "src/styles");
// Dot-prefixed so every repo walker (check-borders, check-design-governance,
// the Next build) skips it. Written on demand and removed afterwards.
const FIXTURE = path.join(STYLES, ".colour-review-fixture.html");
const OUT = path.join(ROOT, "e2e", ".colour-review");

// Accent x mode pairs worth eyeballing. Red is the default; Stone and Slate are
// the low-chroma worst case in light mode; the rest spot-check hue range.
const COMBOS = [
  ["red", "light"], ["red", "dark"],
  ["beige", "light"], ["beige", "dark"],
  ["grey", "light"], ["blue", "light"],
  ["green", "light"], ["yellow", "light"],
  ["pink", "dark"], ["orange", "light"], ["purple", "dark"],
];

const FIXTURE_HTML = `<!doctype html>
<html class="staff-scope">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="./theme.css">
<link rel="stylesheet" href="./staffglobal.css">
<style>
  body { font-family: system-ui, sans-serif; }
  .grid { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; opacity: .6; margin: 0 0 8px; color: var(--text-1); }
  .lbl { font-size: 11px; opacity: .55; color: var(--text-1); width: 100%; }
  table.app-data-table { width: 100%; border-collapse: collapse; }
  table.app-data-table td, table.app-data-table th { padding: 8px 10px; text-align: left; color: var(--text-1); border-bottom: var(--separating-line); }
</style>
</head>
<body>
<div class="app-page-shell" style="padding:16px">
  <div class="app-page-card">
    <div class="app-page-stack">

      <div class="app-section-card">
        <h3>Section card (theme layer) &mdash; buttons, every state</h3>
        <div class="grid">
          <button class="app-btn app-btn--primary">Primary</button>
          <button class="app-btn app-btn--primary" data-demo-state="hover">Primary hover</button>
          <button class="app-btn app-btn--primary" data-demo-state="active">Primary active</button>
          <button class="app-btn app-btn--primary" disabled>Primary disabled</button>
          <button class="app-btn app-btn--primary is-active">Primary selected</button>
        </div>
        <div class="grid" style="margin-top:10px">
          <button class="app-btn app-btn--secondary">Secondary</button>
          <button class="app-btn app-btn--ghost">Ghost</button>
          <button class="app-btn app-btn--theme">Theme</button>
          <button class="app-btn app-btn--danger">Danger</button>
          <button class="app-btn app-btn--danger" disabled>Danger disabled</button>
        </div>
        <div class="grid" style="margin-top:10px">
          <input class="app-input" placeholder="Input on a theme layer" style="max-width:260px">
          <input class="app-input" value="Disabled input" disabled style="max-width:200px">
          <input type="checkbox" checked>
          <input type="checkbox">
          <input type="checkbox" disabled>
          <span class="app-toggle app-toggle--switch"></span>
          <span class="app-toggle app-toggle--switch is-checked"></span>
        </div>
      </div>

      <div class="app-section-card">
        <h3>Nested alternation &mdash; the inner card must flip back to surface</h3>
        <div class="app-section-card">
          <span class="lbl">nested .app-section-card (renders --surface)</span>
          <div class="grid">
            <button class="app-btn app-btn--primary">Primary (accent fill again)</button>
            <input class="app-input" placeholder="Input here" style="max-width:220px">
          </div>
        </div>
      </div>

      <div class="app-section-card">
        <h3>Badges</h3>
        <div class="grid">
          <span class="app-badge app-badge--neutral">Neutral</span>
          <span class="app-badge app-badge--accent-soft">Accent soft</span>
          <span class="app-badge app-badge--accent-strong">Accent strong</span>
          <span class="app-badge app-badge--success">Success</span>
          <span class="app-badge app-badge--success-strong">Success strong</span>
          <span class="app-badge app-badge--warning">Warning</span>
          <span class="app-badge app-badge--warning-strong">Warning strong</span>
          <span class="app-badge app-badge--danger">Danger</span>
          <span class="app-badge app-badge--danger-strong">Danger strong</span>
        </div>
      </div>

      <div class="app-section-card">
        <h3>Tabs</h3>
        <div class="grid">
          <button class="app-tab app-tab--pill">Tab one</button>
          <button class="app-tab app-tab--pill" aria-selected="true">Selected</button>
          <button class="app-tab app-tab--pill" aria-disabled="true">Disabled</button>
        </div>
      </div>

      <div class="app-section-card">
        <h3>Table on a theme layer &mdash; rows + in-row actions</h3>
        <table class="app-data-table">
          <thead><tr><th>Job</th><th>Customer</th><th>Status</th><th></th></tr></thead>
          <tbody>
            <tr><td>J-10241</td><td>A. Whitmore</td><td><span class="app-badge app-badge--success">Complete</span></td><td><button class="app-table-action-btn">Open</button></td></tr>
            <tr><td>J-10242</td><td>R. Deane</td><td><span class="app-badge app-badge--warning">Waiting</span></td><td><button class="app-table-action-btn">Open</button></td></tr>
            <tr><td>J-10243</td><td>S. Kowalczyk</td><td><span class="app-badge app-badge--danger">Declined</span></td><td><button class="app-table-action-btn">Open</button></td></tr>
          </tbody>
        </table>
      </div>

    </div>
  </div>
</div>
</body>
</html>
`;

function loadRuntime() {
  const src = fs
    .readFileSync(path.join(STYLES, "themeRuntime.js"), "utf8")
    .replace(/export (const|function)/g, "$1");
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(src + "\nthis.o={buildThemeRuntime};", ctx);
  return ctx.o.buildThemeRuntime;
}

(async () => {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    console.error("playwright is not installed - run `npm install` first.");
    process.exit(1);
  }

  const buildThemeRuntime = loadRuntime();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(FIXTURE, FIXTURE_HTML);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
    const url = "file:///" + FIXTURE.replace(/\\/g, "/");

    for (const [accent, mode] of COMBOS) {
      const rt = buildThemeRuntime({ resolvedMode: mode, accentName: accent });
      await page.goto(url);
      await page.evaluate(
        ([tokens, m, shell]) => {
          const root = document.documentElement;
          for (const [k, v] of Object.entries(tokens)) root.style.setProperty(k, v);
          root.setAttribute("data-theme", m);
          root.style.colorScheme = m;
          root.style.backgroundColor = shell;
          document.body.style.backgroundColor = shell;
        },
        [rt.legacy, mode, rt.shellBackground]
      );
      await page.waitForTimeout(150);
      const file = path.join(OUT, `colour-review-${accent}-${mode}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`  ${accent}/${mode}  shell ${rt.shellBackground}  -> ${path.relative(ROOT, file)}`);
    }
  } finally {
    await browser.close();
    fs.rmSync(FIXTURE, { force: true });
  }

  console.log(`\nWrote ${COMBOS.length} screenshots to ${path.relative(ROOT, OUT)}`);
})();
