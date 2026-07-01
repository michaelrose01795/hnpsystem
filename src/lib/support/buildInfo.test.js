// file location: src/lib/support/buildInfo.test.js
//
// Phase 5 — version / code-state pinning. Covers deployed-code-state resolution
// (env → build block), source-map hash verification, drift detection between the
// captured code state and the live deployment, the first/last version-seen range
// (cross-release regression tracking), and end-to-end build stamping of a report
// insert through the untrusted submit boundary.
import { describe, expect, it } from "vitest";
import {
  readBuildInfo,
  verifySectionMap,
  detectCodeDrift,
  describeBuild,
} from "@/lib/support/buildInfo";
import { versionRange, buildFingerprint } from "@/lib/support/incidentClustering";
import { buildReportInsert } from "@/lib/support/reportSubmission";
import { buildInvestigation } from "@/lib/support/investigation";

const ENV = {
  NEXT_PUBLIC_APP_VERSION: "2026.7.0",
  NEXT_PUBLIC_COMMIT_SHA: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
  NEXT_PUBLIC_COMMIT_REF: "main",
  NEXT_PUBLIC_BUILD_ID: "a1b2c3d4e5f6",
  NEXT_PUBLIC_DEPLOY_ENV: "production",
  NEXT_PUBLIC_DEPLOY_URL: "hnpsystem.vercel.app",
  NEXT_PUBLIC_DEPLOYED_AT: "2026-07-01T09:00:00.000Z",
  NEXT_PUBLIC_SECTION_MAP_HASH: "roecgn",
};

describe("readBuildInfo — deployed code state", () => {
  it("resolves the full build block from NEXT_PUBLIC_* env + runtime map hash", () => {
    const b = readBuildInfo(ENV, { sectionMapHash: "roecgn" });
    expect(b).toMatchObject({
      version: "2026.7.0",
      commit_sha: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
      commit_short: "a1b2c3d",
      commit_ref: "main",
      build_id: "a1b2c3d4e5f6",
      deploy_env: "production",
      deploy_url: "hnpsystem.vercel.app",
      deployed_at: "2026-07-01T09:00:00.000Z",
      section_map_hash: "roecgn",
      section_map_expected: "roecgn",
    });
  });

  it("falls back to raw VERCEL_GIT_* when NEXT_PUBLIC_* are unset", () => {
    const b = readBuildInfo({
      VERCEL_GIT_COMMIT_SHA: "deadbeefdeadbeef",
      VERCEL_GIT_COMMIT_REF: "feature/x",
      VERCEL_ENV: "preview",
      VERCEL_URL: "preview-xyz.vercel.app",
    });
    expect(b.commit_sha).toBe("deadbeefdeadbeef");
    expect(b.commit_short).toBe("deadbee");
    expect(b.commit_ref).toBe("feature/x");
    expect(b.deploy_env).toBe("preview");
    expect(b.deploy_url).toBe("preview-xyz.vercel.app");
  });

  it("drops undefined keys and clamps overlong values", () => {
    const b = readBuildInfo({ NEXT_PUBLIC_COMMIT_REF: "x".repeat(500) });
    expect(b.commit_ref).toHaveLength(200);
    expect("commit_sha" in b).toBe(false);
    expect("deploy_url" in b).toBe(false);
  });

  it("returns an empty object for an env with no build metadata", () => {
    expect(readBuildInfo({})).toEqual({});
  });
});

describe("verifySectionMap — deployed map matches the shipped map", () => {
  it("reports match when runtime hash equals the CI-expected hash", () => {
    expect(verifySectionMap({ section_map_hash: "abc", section_map_expected: "abc" })).toEqual({
      status: "match",
      actual: "abc",
      expected: "abc",
    });
  });
  it("reports drift when they differ", () => {
    expect(verifySectionMap({ section_map_hash: "abc", section_map_expected: "zzz" }).status).toBe("drift");
  });
  it("reports unknown when either hash is missing", () => {
    expect(verifySectionMap({ section_map_hash: "abc" }).status).toBe("unknown");
    expect(verifySectionMap({}).status).toBe("unknown");
  });
});

describe("detectCodeDrift — captured vs live deployment", () => {
  const captured = { commit_sha: "aaaa1111", version: "1.0.0", commit_ref: "main", section_map_hash: "m1" };

  it("flags drift when the deployed commit moved on since capture", () => {
    const d = detectCodeDrift(captured, { commit_sha: "bbbb2222", version: "1.1.0", section_map_hash: "m2" });
    expect(d.drifted).toBe(true);
    expect(d.status).toBe("commit-changed");
    expect(d.mapChanged).toBe(true);
    expect(d.capturedCommit).toBe("aaaa1111");
    expect(d.currentCommit).toBe("bbbb2222");
    expect(d.note).toMatch(/re-resolve/i);
  });

  it("reports same-commit (no drift) when commits match and the map is unchanged", () => {
    const d = detectCodeDrift(captured, { commit_sha: "aaaa1111", section_map_hash: "m1" });
    expect(d.drifted).toBe(false);
    expect(d.status).toBe("same-commit");
    expect(d.mapChanged).toBe(false);
  });

  it("flags a same-commit map change (stale generated map)", () => {
    const d = detectCodeDrift(captured, { commit_sha: "aaaa1111", section_map_hash: "m9" });
    expect(d.status).toBe("same-commit");
    expect(d.mapChanged).toBe(true);
    expect(d.drifted).toBe(true);
  });

  it("returns unknown when either commit is missing", () => {
    expect(detectCodeDrift(captured, {}).status).toBe("unknown");
    expect(detectCodeDrift({}, { commit_sha: "x" }).status).toBe("unknown");
  });
});

describe("describeBuild", () => {
  it("renders a compact label", () => {
    expect(describeBuild({ version: "2026.7", commit_short: "a1b2c3d", commit_ref: "main" })).toBe(
      "2026.7 a1b2c3d @ main"
    );
    expect(describeBuild({})).toBe("unknown build");
  });
});

describe("versionRange — first/last app version seen (cross-release tracking)", () => {
  const snapshot = {
    route: { asPath: "/vhc/123", pathname: "/vhc/[id]" },
    code_ownership: { section_key: "vhc-panel" },
    unhandled_errors: [{ message: "Cannot read 'id' of undefined", componentStack: "\n  in VhcPanel" }],
    failed_requests: [{ method: "POST", url: "/api/vhc/save", status: 500 }],
  };
  const fp = buildFingerprint(snapshot);
  // Prior reports sharing the same fingerprint across two earlier versions.
  const priors = [
    { id: "r1", fingerprint: fp, appVersion: "1.0.0", commitSha: "c1", createdAt: "2026-01-01T00:00:00Z" },
    { id: "r2", fingerprint: fp, appVersion: "1.2.0", commitSha: "c2", createdAt: "2026-03-01T00:00:00Z" },
    // An unrelated incident that must NOT be pulled into the range.
    { id: "r3", fingerprint: buildFingerprint({ route: { asPath: "/hr" } }), appVersion: "1.1.0", createdAt: "2026-02-01T00:00:00Z" },
  ];

  it("identifies the first and latest version an incident was reproduced on", () => {
    const range = versionRange(fp, priors, { version: "2.0.0", commitSha: "c9", at: "2026-07-01T00:00:00Z" });
    expect(range.occurrences).toBe(3); // r1 + r2 + current (r3 excluded)
    expect(range.firstSeenVersion).toBe("1.0.0");
    expect(range.lastSeenVersion).toBe("2.0.0");
    expect(range.spansMultipleVersions).toBe(true);
    expect(range.isRegression).toBe(true);
    expect(range.versions).toEqual(expect.arrayContaining(["1.0.0", "1.2.0", "2.0.0"]));
  });

  it("a brand-new incident is just the current version, not a regression", () => {
    const range = versionRange(fp, [], { version: "2.0.0", commitSha: "c9", at: "2026-07-01T00:00:00Z" });
    expect(range.occurrences).toBe(1);
    expect(range.firstSeenVersion).toBe("2.0.0");
    expect(range.lastSeenVersion).toBe("2.0.0");
    expect(range.isRegression).toBe(false);
  });
});

describe("build stamping — end to end through the submit boundary", () => {
  it("stamps app_version / commit columns from the captured build block", () => {
    const built = buildReportInsert({
      body: {
        description: "It broke",
        category: "bug",
        diagnostics: {
          route: { asPath: "/vhc/1" },
          build: readBuildInfo(ENV, { sectionMapHash: "roecgn" }),
        },
      },
      session: { user: { id: "42", name: "Tester", roles: ["admin"] } },
    });
    expect(built.ok).toBe(true);
    expect(built.input.appVersion).toBe("2026.7.0");
    expect(built.input.commitSha).toBe("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0");
    expect(built.input.commitRef).toBe("main");
    expect(built.input.buildId).toBe("a1b2c3d4e5f6");
  });
});

describe("investigation — records build metadata, drift, and version range", () => {
  const snapshot = {
    route: { asPath: "/vhc/1", pathname: "/vhc/[id]" },
    code_ownership: { section_key: "vhc-panel" },
    unhandled_errors: [{ message: "boom", componentStack: "\n  in VhcPanel" }],
    build: { version: "1.0.0", commit_sha: "aaaa1111", commit_ref: "main", section_map_hash: "m1", section_map_expected: "m1" },
  };

  it("embeds captured/deployed build, drift, source-map status and version history", () => {
    const inv = buildInvestigation(snapshot, {
      now: "2026-07-01T00:00:00Z",
      currentBuild: { commit_sha: "bbbb2222", version: "1.1.0", section_map_hash: "m2" },
      priorReports: [],
    });
    expect(inv.codeState.capturedBuild.commit_sha).toBe("aaaa1111");
    expect(inv.codeState.deployedBuild.commit_sha).toBe("bbbb2222");
    expect(inv.codeState.drift.drifted).toBe(true);
    expect(inv.codeState.sourceMap.status).toBe("match");
    expect(inv.versionHistory.firstSeenVersion).toBe("1.0.0");
    expect(inv.summary).toMatch(/Deployed code state/);
  });
});
