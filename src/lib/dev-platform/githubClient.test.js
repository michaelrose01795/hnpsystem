// file location: src/lib/dev-platform/githubClient.test.js
import { describe, expect, it, vi } from "vitest";
import {
  getGithubConfig,
  createGithubClient,
  normaliseArtifact,
} from "@/lib/dev-platform/githubClient";

// Build a fake fetch that records every call and returns a canned response.
function makeFetch({ ok = true, status = 200, json = {} } = {}) {
  const calls = [];
  const fetchImpl = vi.fn(async (url, init) => {
    calls.push({ url, init });
    return {
      ok,
      status,
      json: async () => json,
    };
  });
  fetchImpl.calls = calls;
  return fetchImpl;
}

describe("getGithubConfig", () => {
  it("reads SUPPORT_GITHUB_TOKEN + SUPPORT_GITHUB_REPO and marks configured", () => {
    const cfg = getGithubConfig({
      SUPPORT_GITHUB_TOKEN: "tok",
      SUPPORT_GITHUB_REPO: "owner/repo",
    });
    expect(cfg.token).toBe("tok");
    expect(cfg.repo).toBe("owner/repo");
    expect(cfg.apiBase).toBe("https://api.github.com");
    expect(cfg.configured).toBe(true);
  });

  it("falls back to GITHUB_TOKEN and NEXT_PUBLIC_GITHUB_REPO", () => {
    const cfg = getGithubConfig({
      GITHUB_TOKEN: "tok2",
      NEXT_PUBLIC_GITHUB_REPO: "acme/app",
    });
    expect(cfg.token).toBe("tok2");
    expect(cfg.repo).toBe("acme/app");
    expect(cfg.configured).toBe(true);
  });

  it("prefers the SUPPORT_* vars over the fallbacks", () => {
    const cfg = getGithubConfig({
      SUPPORT_GITHUB_TOKEN: "primary",
      GITHUB_TOKEN: "fallback",
      SUPPORT_GITHUB_REPO: "a/b",
      NEXT_PUBLIC_GITHUB_REPO: "c/d",
    });
    expect(cfg.token).toBe("primary");
    expect(cfg.repo).toBe("a/b");
  });

  it("honours a custom api base", () => {
    const cfg = getGithubConfig({
      SUPPORT_GITHUB_TOKEN: "tok",
      SUPPORT_GITHUB_REPO: "owner/repo",
      SUPPORT_GITHUB_API_BASE: "https://ghe.internal/api/v3",
    });
    expect(cfg.apiBase).toBe("https://ghe.internal/api/v3");
  });

  it("is NOT configured when the token is missing", () => {
    expect(
      getGithubConfig({ SUPPORT_GITHUB_REPO: "owner/repo" }).configured
    ).toBe(false);
  });

  it("is NOT configured when the repo is missing", () => {
    expect(getGithubConfig({ SUPPORT_GITHUB_TOKEN: "tok" }).configured).toBe(
      false
    );
  });

  it("is NOT configured when the repo is malformed", () => {
    expect(
      getGithubConfig({
        SUPPORT_GITHUB_TOKEN: "tok",
        SUPPORT_GITHUB_REPO: "not-a-repo",
      }).configured
    ).toBe(false);
  });
});

describe("createGithubClient — unconfigured", () => {
  it("isConfigured() is false with no token and never calls fetch", async () => {
    const fetchImpl = makeFetch();
    const client = createGithubClient({
      token: null,
      repo: "owner/repo",
      fetchImpl,
    });
    expect(client.isConfigured()).toBe(false);

    const created = await client.createIssue({ title: "x" });
    expect(created).toEqual({
      ok: false,
      status: 0,
      error: expect.stringContaining("not configured"),
    });

    const req = await client.request("GET", "/repos/owner/repo/issues/1");
    expect(req.ok).toBe(false);
    expect(req.status).toBe(0);
    expect(req.error).toContain("not configured");

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it("isConfigured() is false when the repo is malformed", () => {
    const client = createGithubClient({
      token: "tok",
      repo: "bad-repo",
      fetchImpl: makeFetch(),
    });
    expect(client.isConfigured()).toBe(false);
    expect(client.config.configured).toBe(false);
    expect(client.config.repo).toBeNull();
  });
});

describe("createGithubClient — createIssue", () => {
  it("POSTs to /repos/owner/repo/issues with a Bearer header + JSON body and normalises the artifact", async () => {
    const fetchImpl = makeFetch({
      ok: true,
      status: 201,
      json: {
        number: 7,
        html_url: "https://github.com/owner/repo/issues/7",
        title: "Login broken",
        state: "open",
      },
    });
    const client = createGithubClient({
      token: "tok",
      repo: "owner/repo",
      apiBase: "https://api.github.com",
      fetchImpl,
    });
    expect(client.isConfigured()).toBe(true);

    const res = await client.createIssue({
      title: "Login broken",
      body: "steps",
      labels: ["bug"],
    });

    expect(res).toEqual({
      ok: true,
      artifact: {
        kind: "issue",
        number: 7,
        sha: null,
        url: "https://github.com/owner/repo/issues/7",
        title: "Login broken",
        state: "open",
      },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const { url, init } = fetchImpl.calls[0];
    expect(url).toBe("https://api.github.com/repos/owner/repo/issues");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({
      title: "Login broken",
      body: "steps",
      labels: ["bug"],
    });
  });

  it("returns { ok:false, status, error } on a non-2xx response", async () => {
    const fetchImpl = makeFetch({
      ok: false,
      status: 422,
      json: { message: "Validation Failed" },
    });
    const client = createGithubClient({
      token: "tok",
      repo: "owner/repo",
      fetchImpl,
    });

    const res = await client.createIssue({ title: "x" });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(422);
    expect(res.error).toBe("Validation Failed");
  });
});

describe("createGithubClient — read endpoints hit the right paths", () => {
  it("getIssue GETs /repos/owner/repo/issues/:number", async () => {
    const fetchImpl = makeFetch({ json: { number: 3, state: "open" } });
    const client = createGithubClient({
      token: "tok",
      repo: "owner/repo",
      fetchImpl,
    });
    await client.getIssue(3);
    expect(fetchImpl.calls[0].url).toBe(
      "https://api.github.com/repos/owner/repo/issues/3"
    );
    expect(fetchImpl.calls[0].init.method).toBe("GET");
  });

  it("getPull GETs /repos/owner/repo/pulls/:number", async () => {
    const fetchImpl = makeFetch({ json: { number: 9, state: "open" } });
    const client = createGithubClient({
      token: "tok",
      repo: "owner/repo",
      fetchImpl,
    });
    await client.getPull(9);
    expect(fetchImpl.calls[0].url).toBe(
      "https://api.github.com/repos/owner/repo/pulls/9"
    );
    expect(fetchImpl.calls[0].init.method).toBe("GET");
  });

  it("getCommit GETs /repos/owner/repo/commits/:sha", async () => {
    const fetchImpl = makeFetch({ json: { sha: "abc123" } });
    const client = createGithubClient({
      token: "tok",
      repo: "owner/repo",
      fetchImpl,
    });
    await client.getCommit("abc123");
    expect(fetchImpl.calls[0].url).toBe(
      "https://api.github.com/repos/owner/repo/commits/abc123"
    );
    expect(fetchImpl.calls[0].init.method).toBe("GET");
  });

  it("syncArtifact routes to the correct endpoint per kind", async () => {
    const fetchImpl = makeFetch({ json: { number: 1, sha: "s" } });
    const client = createGithubClient({
      token: "tok",
      repo: "owner/repo",
      fetchImpl,
    });

    await client.syncArtifact("pull_request", 12);
    await client.syncArtifact("commit", "sha1");
    await client.syncArtifact("issue", 5);

    expect(fetchImpl.calls.map((c) => c.url)).toEqual([
      "https://api.github.com/repos/owner/repo/pulls/12",
      "https://api.github.com/repos/owner/repo/commits/sha1",
      "https://api.github.com/repos/owner/repo/issues/5",
    ]);
  });
});

describe("normaliseArtifact", () => {
  it("maps a commit", () => {
    expect(
      normaliseArtifact("commit", {
        sha: "abc123",
        html_url: "https://github.com/owner/repo/commit/abc123",
        commit: { message: "Fix bug\n\nlong body" },
      })
    ).toEqual({
      kind: "commit",
      sha: "abc123",
      number: null,
      url: "https://github.com/owner/repo/commit/abc123",
      title: "Fix bug",
      state: null,
    });
  });

  it("maps a plain issue", () => {
    expect(
      normaliseArtifact("issue", {
        number: 4,
        html_url: "https://github.com/owner/repo/issues/4",
        title: "An issue",
        state: "closed",
      })
    ).toEqual({
      kind: "issue",
      number: 4,
      sha: null,
      url: "https://github.com/owner/repo/issues/4",
      title: "An issue",
      state: "closed",
    });
  });

  it("maps an issue carrying a pull_request key to kind pull_request", () => {
    const art = normaliseArtifact("issue", {
      number: 8,
      title: "A PR",
      state: "open",
      pull_request: { url: "https://api.github.com/..." },
    });
    expect(art.kind).toBe("pull_request");
    expect(art.number).toBe(8);
  });

  it("maps a merged PR to state 'merged'", () => {
    const art = normaliseArtifact("pull_request", {
      number: 11,
      title: "Merged PR",
      state: "closed",
      merged: true,
    });
    expect(art.kind).toBe("pull_request");
    expect(art.state).toBe("merged");
  });

  it("treats merged=false as a pull_request that is not merged", () => {
    const art = normaliseArtifact("issue", {
      number: 12,
      title: "Open PR",
      state: "open",
      merged: false,
    });
    expect(art.kind).toBe("pull_request");
    expect(art.state).toBe("open");
  });
});
