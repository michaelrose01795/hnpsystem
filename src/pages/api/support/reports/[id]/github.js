// file location: src/pages/api/support/reports/[id]/github.js
//
// Phase 10 — two-way GitHub integration for a single report. Dev-gated
// (DEV_PLATFORM_ROLES). All GitHub API calls go through the server-side
// githubClient (token never reaches the client). Every mutation is audit-logged.
//
//   GET    /api/support/reports/[id]/github                       → list linked artifacts
//   POST   /api/support/reports/[id]/github  { action: "create" } → create a GitHub issue from the report + link it
//                                            { action: "link", url } → attach an existing issue/PR/commit by URL
//                                            { action: "sync", linkId } → refresh a linked artifact's live state
//   DELETE /api/support/reports/[id]/github?linkId=…               → unlink
//
// "link" works WITHOUT a token (it just parses the URL); "create" + "sync"
// require the token — when unconfigured they return a clear 400 rather than
// failing opaquely.

import createHandler from "@/lib/api/createHandler";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { getSupportReport } from "@/lib/database/support";
import {
  listGithubLinks,
  saveGithubLink,
  updateGithubLinkState,
  deleteGithubLink,
} from "@/lib/database/supportGithub";
import { createGithubClient, getGithubConfig } from "@/lib/dev-platform/githubClient";
import { buildGithubIssue } from "@/lib/support/supportExport";
import { devOwnerKey } from "@/lib/database/supportSavedViews";
import { recordDevPlatformAudit } from "@/lib/support/devPlatformAudit";

const idOf = (req) => (typeof req.query.id === "string" ? req.query.id : Array.isArray(req.query.id) ? req.query.id[0] : null);

// Parse a github.com issue / PR / commit URL into a link record (no network).
function parseGithubUrl(url) {
  const m = String(url || "").match(/github\.com\/([\w.-]+\/[\w.-]+)\/(issues|pull|commit)\/([\w]+)/);
  if (!m) return null;
  const [, repo, seg, ref] = m;
  if (seg === "commit") return { kind: "commit", repo, sha: ref, number: null, url };
  return { kind: seg === "pull" ? "pull_request" : "issue", repo, number: Number(ref), sha: null, url };
}

async function handleGet(req, res) {
  const result = await listGithubLinks(idOf(req));
  if (!result.ok) return res.status(500).json({ success: false, message: result.error || "Query failed" });
  const cfg = getGithubConfig();
  return res.status(200).json({ success: true, data: result.data, configured: cfg.configured, repo: cfg.repo || null });
}

async function handlePost(req, res, session) {
  const id = idOf(req);
  const owner = devOwnerKey(session);
  const { action } = req.body || {};

  if (action === "link") {
    const parsed = parseGithubUrl((req.body || {}).url);
    if (!parsed) return res.status(400).json({ success: false, message: "Provide a valid github.com issue/PR/commit URL." });
    const saved = await saveGithubLink(id, parsed, { createdBy: owner });
    if (!saved.ok) return res.status(400).json({ success: false, message: saved.error });
    await recordDevPlatformAudit("dev_platform_action", { req, session, entityId: id, diff: { action: "github_link", kind: parsed.kind } });
    return res.status(201).json({ success: true, data: saved.data });
  }

  if (action === "create") {
    const client = createGithubClient();
    if (!client.isConfigured()) {
      return res.status(400).json({ success: false, message: "GitHub integration is not configured. Set SUPPORT_GITHUB_TOKEN and SUPPORT_GITHUB_REPO." });
    }
    const report = await getSupportReport(id);
    if (!report.success) return res.status(404).json({ success: false, message: "Report not found." });
    const issue = buildGithubIssue(report.data, { baseUrl: "" });
    const created = await client.createIssue(issue);
    if (!created.ok) return res.status(502).json({ success: false, message: created.error || "GitHub issue creation failed." });
    const saved = await saveGithubLink(id, { ...created.artifact, repo: client.config.repo }, { createdBy: owner });
    if (!saved.ok) return res.status(400).json({ success: false, message: saved.error });
    await recordDevPlatformAudit("dev_platform_action", { req, session, entityId: id, diff: { action: "github_create_issue", number: created.artifact?.number } });
    return res.status(201).json({ success: true, data: saved.data, artifact: created.artifact });
  }

  if (action === "sync") {
    const { linkId } = req.body || {};
    const links = await listGithubLinks(id);
    const link = (links.data || []).find((l) => l.id === linkId);
    if (!link) return res.status(404).json({ success: false, message: "Link not found." });
    const client = createGithubClient();
    if (!client.isConfigured()) {
      return res.status(400).json({ success: false, message: "GitHub integration is not configured; cannot sync live state." });
    }
    const ref = link.kind === "commit" ? link.sha : link.number;
    const synced = await client.syncArtifact(link.kind, ref);
    if (!synced.ok) return res.status(502).json({ success: false, message: synced.error || "GitHub sync failed." });
    const updated = await updateGithubLinkState(link.id, { title: synced.artifact?.title, state: synced.artifact?.state });
    if (!updated.ok) return res.status(400).json({ success: false, message: updated.error });
    await recordDevPlatformAudit("dev_platform_action", { req, session, entityId: id, diff: { action: "github_sync", state: synced.artifact?.state } });
    return res.status(200).json({ success: true, data: updated.data });
  }

  return res.status(400).json({ success: false, message: "Unknown action. Use create, link or sync." });
}

async function handleDelete(req, res, session) {
  const linkId = typeof req.query.linkId === "string" ? req.query.linkId : null;
  if (!linkId) return res.status(400).json({ success: false, message: "linkId is required." });
  const result = await deleteGithubLink(linkId);
  if (!result.ok) return res.status(400).json({ success: false, message: result.error });
  await recordDevPlatformAudit("dev_platform_action", { req, session, entityId: idOf(req), diff: { action: "github_unlink", linkId } });
  return res.status(200).json({ success: true });
}

export default createHandler({
  allowedRoles: DEV_PLATFORM_ROLES,
  methods: { GET: handleGet, POST: handlePost, DELETE: handleDelete },
});
