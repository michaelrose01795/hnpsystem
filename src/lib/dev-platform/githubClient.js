// file location: src/lib/dev-platform/githubClient.js
//
// Phase 10 — server-side GitHub API client for two-way integration (create /
// fetch / sync issues, PRs, commits, deployments). Injectable `fetchImpl` +
// config so it is fully node-testable WITHOUT a real token or network. Reads its
// token from a SERVER-ONLY env var (never NEXT_PUBLIC), so no credential ever
// reaches the client bundle. Never throws on a non-2xx — returns { ok, status,
// data | error } so callers degrade gracefully when GitHub is unavailable or
// unconfigured.
//
// External config required to FUNCTION (documented in the manual actions):
//   SUPPORT_GITHUB_TOKEN   — a fine-grained PAT / app token with issues:write.
//   SUPPORT_GITHUB_REPO    — "owner/repo" (falls back to NEXT_PUBLIC_GITHUB_REPO).
// Until these are set, isConfigured() is false and the routes report "not
// configured" instead of attempting a call.

import { parseRepo } from "@/lib/dev-platform/githubCorrelation";

const DEFAULT_API_BASE = "https://api.github.com";

/**
 * Resolve GitHub config from an env bag (defaults to process.env). Token is
 * server-only; repo may come from the public repo var as a convenience.
 */
export function getGithubConfig(env = (typeof process !== "undefined" ? process.env : {})) {
  const token = env.SUPPORT_GITHUB_TOKEN || env.GITHUB_TOKEN || null;
  const repo = env.SUPPORT_GITHUB_REPO || env.NEXT_PUBLIC_GITHUB_REPO || null;
  const apiBase = env.SUPPORT_GITHUB_API_BASE || DEFAULT_API_BASE;
  return { token, repo, apiBase, configured: Boolean(token && parseRepo(repo)) };
}

function normaliseArtifact(kind, data = {}) {
  if (kind === "commit") {
    return {
      kind: "commit",
      sha: data.sha || null,
      number: null,
      url: data.html_url || null,
      title: data.commit?.message ? String(data.commit.message).split("\n")[0] : null,
      state: null,
    };
  }
  // issue OR pull_request (GitHub returns pull_request key on issues that are PRs)
  const isPr = kind === "pull_request" || Boolean(data.pull_request) || data.merged != null;
  return {
    kind: isPr ? "pull_request" : "issue",
    number: data.number ?? null,
    sha: null,
    url: data.html_url || null,
    title: data.title || null,
    state: data.merged ? "merged" : data.state || null,
  };
}

/**
 * Create a GitHub client bound to a config + fetch implementation.
 * @param {object} [cfg] { token, repo, apiBase, fetchImpl }
 */
export function createGithubClient(cfg = {}) {
  const config = { ...getGithubConfig(), ...cfg };
  const fetchImpl = cfg.fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
  const parsed = parseRepo(config.repo);

  function isConfigured() {
    return Boolean(config.token && parsed && fetchImpl);
  }

  async function request(method, path, body) {
    if (!isConfigured()) {
      return { ok: false, status: 0, error: "GitHub integration is not configured (missing token or repo)." };
    }
    const url = path.startsWith("http") ? path : `${config.apiBase}${path}`;
    try {
      const res = await fetchImpl(url, {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${config.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok) {
        return { ok: false, status: res.status, error: data?.message || `GitHub request failed (${res.status}).`, data };
      }
      return { ok: true, status: res.status, data };
    } catch (err) {
      return { ok: false, status: 0, error: err?.message || String(err) };
    }
  }

  const repoPath = parsed ? `/repos/${parsed.slug}` : "";

  return {
    isConfigured,
    config: { repo: parsed?.slug || null, apiBase: config.apiBase, configured: isConfigured() },

    async createIssue({ title, body, labels = [] } = {}) {
      const r = await request("POST", `${repoPath}/issues`, { title, body, labels });
      return r.ok ? { ok: true, artifact: normaliseArtifact("issue", r.data) } : r;
    },

    async getIssue(number) {
      const r = await request("GET", `${repoPath}/issues/${number}`);
      return r.ok ? { ok: true, artifact: normaliseArtifact("issue", r.data) } : r;
    },

    async getPull(number) {
      const r = await request("GET", `${repoPath}/pulls/${number}`);
      return r.ok ? { ok: true, artifact: normaliseArtifact("pull_request", r.data) } : r;
    },

    async getCommit(sha) {
      const r = await request("GET", `${repoPath}/commits/${sha}`);
      return r.ok ? { ok: true, artifact: normaliseArtifact("commit", r.data) } : r;
    },

    async addComment(number, body) {
      return request("POST", `${repoPath}/issues/${number}/comments`, { body });
    },

    // Refresh a stored link's live state (title/state) from GitHub.
    async syncArtifact(kind, ref) {
      if (kind === "pull_request") return this.getPull(ref);
      if (kind === "commit") return this.getCommit(ref);
      return this.getIssue(ref);
    },

    request,
  };
}

export { normaliseArtifact };
