// file location: tools/scripts/dev-with-route-css.js
//
// `npm run dev` entry: runs `next dev` with the route-scoped stylesheet emitter
// in watch mode beside it, so edits to src/styles/custglobal.css (served to
// /website as a hashed static file, see emit-route-scoped-css.js) show up on the
// next page refresh instead of only after restarting the dev server.
//
// Cross-platform: plain child processes, no shell `&`. Extra CLI args are passed
// through to `next dev` (e.g. `npm run dev -- -p 3001`).

const { spawn } = require("child_process");
const path = require("path");

const root = process.cwd();
const node = process.execPath;
const nextBin = require.resolve("next/dist/bin/next", { paths: [root] });

const children = [
  spawn(node, [path.join(__dirname, "emit-route-scoped-css.js"), "--watch"], { stdio: "inherit", cwd: root }),
  spawn(node, [nextBin, "dev", ...process.argv.slice(2)], { stdio: "inherit", cwd: root }),
];

const stopAll = (code) => {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code ?? 0);
};

// If Next exits (or crashes), stop the watcher too; Ctrl+C stops both.
children[1].on("exit", (code) => stopAll(code));
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
