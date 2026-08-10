#!/usr/bin/env node
// Branch workflow helper (see docs/Notes/branching-and-deployments.md).
//
//   node tools/scripts/branch-flow.js sync      → get this device up to date on `development`
//   node tools/scripts/branch-flow.js release   → merge approved `development` into `main` and push
//
// Branch contract:
//   development → every push builds a Vercel Preview deployment
//   main        → every push builds the Vercel Production deployment
//
// Both commands refuse to run with a dirty working tree so nothing is lost when
// moving between devices.

const { execFileSync } = require("child_process");

const DEV_BRANCH = "development";
const PROD_BRANCH = "main";

function git(args, { capture = false } = {}) {
  return execFileSync("git", args, {
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
  });
}

function gitOut(args) {
  return git(args, { capture: true }).trim();
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function assertCleanTree() {
  if (gitOut(["status", "--porcelain"])) {
    fail("Working tree has uncommitted changes. Commit or stash them first.");
  }
}

function currentBranch() {
  return gitOut(["rev-parse", "--abbrev-ref", "HEAD"]);
}

function sync() {
  assertCleanTree();
  git(["fetch", "origin", "--prune"]);
  if (currentBranch() !== DEV_BRANCH) git(["checkout", DEV_BRANCH]);
  git(["pull", "--ff-only", "origin", DEV_BRANCH]);
  console.log(`\n✔ On ${DEV_BRANCH}, up to date with origin.\n`);
}

function release() {
  assertCleanTree();
  git(["fetch", "origin", "--prune"]);

  // Make sure local development matches origin before promoting it.
  if (currentBranch() !== DEV_BRANCH) git(["checkout", DEV_BRANCH]);
  git(["pull", "--ff-only", "origin", DEV_BRANCH]);

  const ahead = gitOut(["rev-list", "--count", `origin/${PROD_BRANCH}..${DEV_BRANCH}`]);
  if (ahead === "0") {
    console.log(`\n✔ ${PROD_BRANCH} already contains everything on ${DEV_BRANCH}. Nothing to release.\n`);
    return;
  }

  console.log(`\nReleasing ${ahead} commit(s) from ${DEV_BRANCH} → ${PROD_BRANCH} (Production):\n`);
  git(["log", "--oneline", `origin/${PROD_BRANCH}..${DEV_BRANCH}`]);

  git(["checkout", PROD_BRANCH]);
  git(["pull", "--ff-only", "origin", PROD_BRANCH]);
  git(["merge", "--no-ff", DEV_BRANCH, "-m", `Release ${DEV_BRANCH} into ${PROD_BRANCH}`]);
  git(["push", "origin", PROD_BRANCH]);
  git(["checkout", DEV_BRANCH]);

  console.log(`\n✔ Pushed to ${PROD_BRANCH}. Vercel is now building the Production deployment.\n`);
}

const command = process.argv[2];
if (command === "sync") sync();
else if (command === "release") release();
else fail("Usage: node tools/scripts/branch-flow.js <sync|release>");
