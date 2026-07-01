// file location: src/lib/dev-platform/githubCorrelation.js
//
// Phase 10 — PURE GitHub deep-link + correlation helpers. No network, no token.
// Turns a report's already-captured build columns (commit_sha, source_file,
// source_line) into GitHub URLs pinned to the EXACT deployed commit, so a
// developer jumps from a report straight to the line of code as it shipped.
// node-testable; used both client- and server-side.

/** Parse an "owner/repo" string. Returns null if malformed. */
export function parseRepo(repo) {
  const m = String(repo || "").trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], slug: `${m[1]}/${m[2]}` };
}

const base = (repo) => {
  const p = parseRepo(repo);
  return p ? `https://github.com/${p.slug}` : null;
};

/** Deep link to a file (optionally at a line) pinned to a commit/ref. */
export function blobUrl(repo, ref, file, line) {
  const b = base(repo);
  if (!b || !file) return null;
  const path = String(file).replace(/^\.?\//, "");
  const at = ref ? String(ref) : "HEAD";
  return `${b}/blob/${at}/${path}${line ? `#L${line}` : ""}`;
}

export function commitUrl(repo, sha) {
  const b = base(repo);
  return b && sha ? `${b}/commit/${sha}` : null;
}

export function compareUrl(repo, from, to) {
  const b = base(repo);
  if (!b || !from || !to) return null;
  return `${b}/compare/${from}...${to}`;
}

export function issueSearchUrl(repo, query) {
  const b = base(repo);
  if (!b) return null;
  return `${b}/issues?q=${encodeURIComponent(query || "")}`;
}

export function newIssueUrl(repo, { title = "", body = "", labels = [] } = {}) {
  const b = base(repo);
  if (!b) return null;
  const params = new URLSearchParams();
  if (title) params.set("title", title);
  if (body) params.set("body", body);
  if (labels.length) params.set("labels", labels.join(","));
  const qs = params.toString();
  return `${b}/issues/new${qs ? `?${qs}` : ""}`;
}

/**
 * Correlate a report to GitHub: the commit it was captured on, the source
 * file:line pinned to that commit, and a pre-scoped issue search. Returns a map
 * of {label -> url} (null-valued entries omitted).
 *
 * @param {object} report  detail or light row (commit_sha, source_file, source_line, ...)
 * @param {{ repo?: string }} [opts]
 * @returns {{ repo:string|null, links:Array<{type:string,label:string,url:string}> }}
 */
export function correlateReport(report = {}, opts = {}) {
  const repo = opts.repo || null;
  const sha = report.commit_sha || report?.diagnostics?.build?.commit_sha || null;
  const ref = report.commit_ref || report?.diagnostics?.build?.commit_ref || null;
  const file = report.source_file || report?.diagnostics?.code_ownership?.file || null;
  const line = report.source_line ?? report?.diagnostics?.code_ownership?.line ?? null;

  const candidates = [
    file ? { type: "blob", label: `Source: ${file}${line ? `:${line}` : ""} @ ${sha ? String(sha).slice(0, 7) : ref || "HEAD"}`, url: blobUrl(repo, sha || ref, file, line) } : null,
    sha ? { type: "commit", label: `Deployed commit ${String(sha).slice(0, 7)}`, url: commitUrl(repo, sha) } : null,
    { type: "issue-search", label: "Search related issues", url: issueSearchUrl(repo, report.title || report.route || "support") },
  ];
  return { repo: parseRepo(repo)?.slug || null, links: candidates.filter((c) => c && c.url) };
}
