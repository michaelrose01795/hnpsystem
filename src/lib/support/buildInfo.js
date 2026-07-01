// file location: src/lib/support/buildInfo.js
//
// Help & Diagnostics ("support") — Phase 5: version / code-state pinning.
//
// PURE, dependency-injected helpers that resolve the exact DEPLOYED code state
// (app version, commit SHA/ref, build id, deployment environment/URL, build
// timestamp, and the shipped section-source-map hash) and compare two code
// states to detect DRIFT. Everything here is non-secret deploy metadata:
//   - reads only NEXT_PUBLIC_* / injected env (surfaced by next.config.mjs),
//   - never touches tokens, cookies, or process secrets,
//   - stays node-testable because the env + section-map hash are injected.
//
// The captured `build` block rides inside the diagnostics snapshot and is
// re-run through the shared sanitiser with everything else, so this module adds
// no new privacy surface. See docs/Support/help-diagnostics.md §8.

const clamp = (value, max) => {
  if (value == null) return undefined;
  const s = String(value).trim();
  if (!s) return undefined;
  return s.length > max ? s.slice(0, max) : s;
};

// Short, human-friendly commit (first 7 chars) — matches Vercel / GitHub UIs.
const shortSha = (sha) => (sha ? String(sha).slice(0, 7) : undefined);

/**
 * Resolve the deployed code state from the environment (client OR server).
 *
 * On the client, next.config.mjs inlines the NEXT_PUBLIC_* values at build time.
 * On the server, the same NEXT_PUBLIC_* values are present in process.env, plus
 * the raw VERCEL_GIT_* fallbacks. Both are injectable for tests.
 *
 * @param {Record<string,string|undefined>} [env] defaults to process.env
 * @param {{ sectionMapHash?: string }} [opts] runtime section-map hash (the map
 *        actually shipped in this bundle — see getSectionSourceMapHash()).
 * @returns {{
 *   version?: string, commit_sha?: string, commit_short?: string,
 *   commit_ref?: string, build_id?: string, deploy_env?: string,
 *   deploy_url?: string, deployed_at?: string,
 *   section_map_hash?: string, section_map_expected?: string
 * }}
 */
export function readBuildInfo(env = typeof process !== "undefined" ? process.env : {}, opts = {}) {
  const e = env || {};
  const commitSha = clamp(e.NEXT_PUBLIC_COMMIT_SHA || e.VERCEL_GIT_COMMIT_SHA, 80);
  const build = {
    version: clamp(e.NEXT_PUBLIC_APP_VERSION || e.npm_package_version, 50),
    commit_sha: commitSha,
    commit_short: shortSha(commitSha),
    commit_ref: clamp(e.NEXT_PUBLIC_COMMIT_REF || e.VERCEL_GIT_COMMIT_REF, 200),
    build_id: clamp(e.NEXT_PUBLIC_BUILD_ID, 200),
    deploy_env: clamp(e.NEXT_PUBLIC_DEPLOY_ENV || e.VERCEL_ENV, 40),
    deploy_url: clamp(e.NEXT_PUBLIC_DEPLOY_URL || e.VERCEL_URL, 300),
    deployed_at: clamp(e.NEXT_PUBLIC_DEPLOYED_AT, 40),
    // The map actually shipped in THIS bundle (runtime), vs the hash CI expected
    // for the deployed commit (env). A mismatch means the generated map is stale.
    section_map_hash: clamp(opts.sectionMapHash, 40),
    section_map_expected: clamp(e.NEXT_PUBLIC_SECTION_MAP_HASH, 40),
  };
  // Drop undefined keys so the blob stays tight (matters against the size cap).
  Object.keys(build).forEach((k) => build[k] === undefined && delete build[k]);
  return build;
}

/**
 * Verify the section-source-map that resolved a report's file:line is the SAME
 * map CI recorded for the deployed commit. `unknown` when either hash is absent
 * (e.g. a build that predates Phase 5, or an env that wasn't stamped in CI).
 *
 * @param {object} build a build block from readBuildInfo() / a captured snapshot
 * @returns {{ status: "match"|"drift"|"unknown", actual?: string, expected?: string }}
 */
export function verifySectionMap(build = {}) {
  const actual = build?.section_map_hash || undefined;
  const expected = build?.section_map_expected || undefined;
  if (!actual || !expected) return { status: "unknown", actual, expected };
  return { status: actual === expected ? "match" : "drift", actual, expected };
}

/**
 * Detect code drift between the code state a report was CAPTURED against and the
 * CURRENT deployment. When they differ, the captured file:line / section map may
 * no longer point at the same source, so the developer viewer should re-resolve
 * against the current commit before trusting it.
 *
 * @param {object} capturedBuild the `build` block stored in the report snapshot
 * @param {object} currentBuild  readBuildInfo() for the live deployment
 * @returns {{
 *   drifted: boolean,
 *   status: "unknown"|"same-commit"|"commit-changed",
 *   mapChanged: boolean,
 *   capturedCommit?: string, currentCommit?: string,
 *   capturedVersion?: string, currentVersion?: string,
 *   capturedRef?: string, currentRef?: string,
 *   note: string
 * }}
 */
export function detectCodeDrift(capturedBuild = {}, currentBuild = {}) {
  const capturedCommit = capturedBuild?.commit_sha || undefined;
  const currentCommit = currentBuild?.commit_sha || undefined;
  const capturedMap = capturedBuild?.section_map_hash || undefined;
  const currentMap = currentBuild?.section_map_hash || undefined;
  const mapChanged = Boolean(capturedMap && currentMap && capturedMap !== currentMap);

  const base = {
    mapChanged,
    capturedCommit,
    currentCommit,
    capturedVersion: capturedBuild?.version || undefined,
    currentVersion: currentBuild?.version || undefined,
    capturedRef: capturedBuild?.commit_ref || undefined,
    currentRef: currentBuild?.commit_ref || undefined,
  };

  if (!capturedCommit || !currentCommit) {
    return {
      ...base,
      drifted: mapChanged,
      status: "unknown",
      note: mapChanged
        ? "Commit unknown but the section map changed — treat captured file:line as approximate."
        : "Deployed commit could not be determined for one side; cannot confirm drift.",
    };
  }
  if (capturedCommit === currentCommit) {
    return {
      ...base,
      drifted: mapChanged,
      status: "same-commit",
      note: mapChanged
        ? "Same commit but a different section map — regenerate the map."
        : "Report was captured against the currently-deployed commit.",
    };
  }
  return {
    ...base,
    drifted: true,
    status: "commit-changed",
    note: `Code moved from ${shortSha(capturedCommit)} to ${shortSha(currentCommit)} since capture — re-resolve file:line against the current commit.`,
  };
}

/**
 * A short one-line label for a build, e.g. "v2026.7 (a1b2c3d @ main)".
 * @param {object} build
 * @returns {string}
 */
export function describeBuild(build = {}) {
  if (!build || typeof build !== "object") return "unknown build";
  const bits = [];
  if (build.version) bits.push(build.version);
  const sha = build.commit_short || (build.commit_sha ? shortSha(build.commit_sha) : null);
  if (sha) bits.push(build.commit_ref ? `${sha} @ ${build.commit_ref}` : sha);
  if (!bits.length && build.build_id) bits.push(`build ${build.build_id}`);
  return bits.length ? bits.join(" ") : "unknown build";
}
