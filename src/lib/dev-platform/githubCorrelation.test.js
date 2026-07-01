// file location: src/lib/dev-platform/githubCorrelation.test.js
import { describe, expect, it } from "vitest";
import {
  parseRepo,
  blobUrl,
  commitUrl,
  compareUrl,
  issueSearchUrl,
  newIssueUrl,
  correlateReport,
} from "@/lib/dev-platform/githubCorrelation";

describe("parseRepo", () => {
  it("parses a plain owner/repo string", () => {
    expect(parseRepo("humphries/hnpsystem")).toEqual({
      owner: "humphries",
      repo: "hnpsystem",
      slug: "humphries/hnpsystem",
    });
  });

  it("parses a full github URL and strips a trailing .git", () => {
    expect(parseRepo("https://github.com/humphries/hnpsystem")).toEqual({
      owner: "humphries",
      repo: "hnpsystem",
      slug: "humphries/hnpsystem",
    });
    expect(parseRepo("https://github.com/humphries/hnpsystem.git")).toEqual({
      owner: "humphries",
      repo: "hnpsystem",
      slug: "humphries/hnpsystem",
    });
  });

  it("returns null for malformed / empty input", () => {
    expect(parseRepo("")).toBeNull();
    expect(parseRepo(null)).toBeNull();
    expect(parseRepo("no-slash")).toBeNull();
    expect(parseRepo("too/many/parts")).toBeNull();
    expect(parseRepo("owner/")).toBeNull();
  });
});

describe("blobUrl", () => {
  it("pins a file + line at a sha", () => {
    expect(blobUrl("owner/repo", "abc1234", "src/pages/index.js", 42)).toBe(
      "https://github.com/owner/repo/blob/abc1234/src/pages/index.js#L42"
    );
  });

  it("pins a file at a ref without a line", () => {
    expect(blobUrl("owner/repo", "main", "src/pages/index.js")).toBe(
      "https://github.com/owner/repo/blob/main/src/pages/index.js"
    );
  });

  it("strips a leading ./ or / from the file path and defaults ref to HEAD", () => {
    expect(blobUrl("owner/repo", null, "./src/a.js", 3)).toBe(
      "https://github.com/owner/repo/blob/HEAD/src/a.js#L3"
    );
    expect(blobUrl("owner/repo", null, "/src/a.js")).toBe(
      "https://github.com/owner/repo/blob/HEAD/src/a.js"
    );
  });

  it("returns null when repo is missing or file is missing", () => {
    expect(blobUrl("", "main", "src/a.js")).toBeNull();
    expect(blobUrl("owner/repo", "main", "")).toBeNull();
  });
});

describe("commitUrl", () => {
  it("builds a commit URL", () => {
    expect(commitUrl("owner/repo", "deadbeef")).toBe(
      "https://github.com/owner/repo/commit/deadbeef"
    );
  });

  it("returns null when repo or sha is missing", () => {
    expect(commitUrl("", "deadbeef")).toBeNull();
    expect(commitUrl("owner/repo", "")).toBeNull();
  });
});

describe("compareUrl", () => {
  it("builds a compare URL", () => {
    expect(compareUrl("owner/repo", "v1", "v2")).toBe(
      "https://github.com/owner/repo/compare/v1...v2"
    );
  });

  it("returns null when repo, from, or to is missing", () => {
    expect(compareUrl("", "v1", "v2")).toBeNull();
    expect(compareUrl("owner/repo", "", "v2")).toBeNull();
    expect(compareUrl("owner/repo", "v1", "")).toBeNull();
  });
});

describe("issueSearchUrl", () => {
  it("builds an encoded issue-search URL", () => {
    expect(issueSearchUrl("owner/repo", "login broken")).toBe(
      "https://github.com/owner/repo/issues?q=login%20broken"
    );
  });

  it("encodes an empty query to an empty q param", () => {
    expect(issueSearchUrl("owner/repo")).toBe(
      "https://github.com/owner/repo/issues?q="
    );
  });

  it("returns null when repo is missing", () => {
    expect(issueSearchUrl("", "x")).toBeNull();
  });
});

describe("newIssueUrl", () => {
  it("builds a new-issue URL with title, body and labels", () => {
    const url = newIssueUrl("owner/repo", {
      title: "Bug: crash",
      body: "steps here",
      labels: ["bug", "p1"],
    });
    expect(url).toContain("https://github.com/owner/repo/issues/new?");
    expect(url).toContain("title=Bug%3A+crash");
    expect(url).toContain("body=steps+here");
    expect(url).toContain("labels=bug%2Cp1");
  });

  it("omits the query string when no options are supplied", () => {
    expect(newIssueUrl("owner/repo")).toBe(
      "https://github.com/owner/repo/issues/new"
    );
  });

  it("returns null when repo is missing", () => {
    expect(newIssueUrl("", { title: "x" })).toBeNull();
  });
});

describe("correlateReport", () => {
  it("returns links pinned to commit_sha: source blob, commit link, issue search", () => {
    const report = {
      commit_sha: "abc1234def",
      source_file: "src/pages/index.js",
      source_line: 42,
      title: "Login broken",
    };
    const { repo, links } = correlateReport(report, { repo: "owner/repo" });
    expect(repo).toBe("owner/repo");

    const byType = Object.fromEntries(links.map((l) => [l.type, l]));

    // source blob pinned to the exact commit + line
    expect(byType.blob.url).toBe(
      "https://github.com/owner/repo/blob/abc1234def/src/pages/index.js#L42"
    );
    expect(byType.blob.label).toContain("src/pages/index.js:42");
    expect(byType.blob.label).toContain("abc1234"); // short sha

    // commit link
    expect(byType.commit.url).toBe(
      "https://github.com/owner/repo/commit/abc1234def"
    );
    expect(byType.commit.label).toContain("abc1234");

    // issue search scoped to the report title
    expect(byType["issue-search"].url).toBe(
      "https://github.com/owner/repo/issues?q=Login%20broken"
    );
  });

  it("omits null-url entries when repo is missing (blob + commit dropped, search dropped too)", () => {
    const report = {
      commit_sha: "abc1234",
      source_file: "src/a.js",
      source_line: 1,
      title: "x",
    };
    const { repo, links } = correlateReport(report, {});
    expect(repo).toBeNull();
    // With no repo every builder returns null, so no links survive the filter.
    expect(links).toEqual([]);
  });

  it("drops the blob/commit entries when there is no sha or source file", () => {
    const report = { title: "Only a title" };
    const { links } = correlateReport(report, { repo: "owner/repo" });
    const types = links.map((l) => l.type);
    expect(types).not.toContain("blob");
    expect(types).not.toContain("commit");
    // issue search still present and scoped to the title
    expect(types).toContain("issue-search");
    const search = links.find((l) => l.type === "issue-search");
    expect(search.url).toBe(
      "https://github.com/owner/repo/issues?q=Only%20a%20title"
    );
  });

  it("reads the commit sha from diagnostics.build.commit_sha when top-level is absent", () => {
    const report = {
      diagnostics: {
        build: { commit_sha: "feed1234beef" },
        code_ownership: { file: "src/lib/x.js", line: 9 },
      },
      route: "/dashboard",
    };
    const { links } = correlateReport(report, { repo: "owner/repo" });
    const byType = Object.fromEntries(links.map((l) => [l.type, l]));

    expect(byType.commit.url).toBe(
      "https://github.com/owner/repo/commit/feed1234beef"
    );
    // blob pinned to the diagnostics build sha + code_ownership file/line
    expect(byType.blob.url).toBe(
      "https://github.com/owner/repo/blob/feed1234beef/src/lib/x.js#L9"
    );
    // issue search falls back to route when no title
    expect(byType["issue-search"].url).toBe(
      "https://github.com/owner/repo/issues?q=%2Fdashboard"
    );
  });
});
