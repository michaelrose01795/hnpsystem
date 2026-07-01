// file location: src/lib/support/supportExport.test.js
import { describe, expect, it } from "vitest";
import { buildGithubIssue, buildDevBundle, buildMarkdownReport, reportDeepLink } from "@/lib/support/supportExport";

const report = {
  id: "11111111-2222-3333-4444-555555555555",
  title: "VHC save fails",
  description: "Saving throws 500",
  category: "bug",
  severity: "high",
  status: "new",
  route: "/vhc/1",
  source_file: "src/components/VHC/VhcDetailsPanel.js",
  source_line: 1254,
  reporter_username: "tester",
  created_at: "2026-07-01T00:00:00Z",
  diagnostics: {
    build: { version: "2026.7", commit_sha: "abcdef1234", commit_ref: "main" },
    fingerprint: { route: "/vhc/1" },
    console_errors: [{ level: "error", msg: "x" }],
    failed_requests: [{ method: "POST", url: "/api/vhc/save", status: 500 }],
    investigation: {
      summary: "## VHC incident\nboom",
      versionHistory: { isRegression: true, firstSeenVersion: "2026.6" },
      priority: "P1",
      debuggingOrder: ["Reproduce the request"],
      regressionTests: ["Handle 500 gracefully"],
      codeState: { drift: { drifted: true, note: "moved" } },
      ownership: { primary: "api", api: ["/api/vhc/save"] },
      rootCauses: [{ cause: "500 on save", confidence: 0.6 }],
      inspectFirst: { files: ["a.js"] },
    },
  },
};

describe("reportDeepLink", () => {
  it("builds an absolute deep link", () => {
    expect(reportDeepLink(report, "https://app.test/")).toBe(`https://app.test/dev/support-reports/${report.id}`);
  });
});

describe("buildGithubIssue", () => {
  it("builds a title, body and labels from the report + investigation", () => {
    const issue = buildGithubIssue(report, { baseUrl: "https://app.test" });
    expect(issue.title).toMatch(/^\[Support\] VHC save fails \(HIGH\)/);
    expect(issue.body).toContain("## VHC incident");
    expect(issue.body).toContain("src/components/VHC/VhcDetailsPanel.js:1254");
    expect(issue.body).toContain("Code drift");
    expect(issue.body).toContain(reportDeepLink(report, "https://app.test"));
    expect(issue.labels).toEqual(expect.arrayContaining(["support", "bug", "severity:high", "P1", "regression"]));
  });
  it("falls back to the description when no investigation summary", () => {
    const issue = buildGithubIssue({ id: "x", description: "just broke", category: "bug" });
    expect(issue.body).toContain("just broke");
    expect(issue.title).toContain("just broke");
  });
});

describe("buildDevBundle", () => {
  it("extracts the useful subset with counts", () => {
    const { bundle, text } = buildDevBundle(report);
    expect(bundle.id).toBe(report.id);
    expect(bundle.codeOwnership.file).toBe("src/components/VHC/VhcDetailsPanel.js");
    expect(bundle.counts.failedRequests).toBe(1);
    expect(bundle.counts.consoleErrors).toBe(1);
    expect(() => JSON.parse(text)).not.toThrow();
  });
});

describe("buildMarkdownReport", () => {
  it("produces a readable summary with a link", () => {
    const md = buildMarkdownReport(report, { baseUrl: "https://app.test" });
    expect(md).toContain("# VHC save fails");
    expect(md).toContain("Link: https://app.test/dev/support-reports/");
  });
});
