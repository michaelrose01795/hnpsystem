// file location: src/pages/api/support/platform.js
//
// Phase 10 — Developer Platform aggregation for the Phase 10 dashboards that
// don't fit the Phase 9 intelligence route: deployment readiness, engineering
// productivity metrics, and the knowledge-centre derivation. Dev-gated
// (DEV_PLATFORM_ROLES) by createHandler. Reads the same bounded window of LIGHT
// report rows the intelligence route uses (never the RLS-locked blob), runs the
// pure engines SERVER-SIDE, and merges the persisted approvals / knowledge
// entries. Audit-logged (dev_platform_view).
//
//   GET /api/support/platform?view=all|readiness|productivity|knowledge&window=2000&days=30

import createHandler from "@/lib/api/createHandler";
import { listReportsForIntelligence } from "@/lib/database/support";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { buildDeploymentReadiness } from "@/lib/dev-platform/deploymentReadiness";
import { buildProductivityMetrics } from "@/lib/dev-platform/productivityMetrics";
import { buildKnowledgeCentre } from "@/lib/dev-platform/knowledgeCentre";
import { listReleaseApprovals } from "@/lib/database/supportReleases";
import { listKnowledgeEntries } from "@/lib/database/supportKnowledge";
import { recordDevPlatformAudit } from "@/lib/support/devPlatformAudit";

const toInt = (v, f) => {
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) ? n : f;
};

async function handleGet(req, res, session) {
  const q = req.query || {};
  const window = Math.min(Math.max(toInt(q.window, 2000), 1), 5000);
  const days = Math.min(Math.max(toInt(q.days, 30), 1), 365);
  const view = typeof q.view === "string" ? q.view : "all";

  const result = await listReportsForIntelligence({ window });
  if (!result.success) {
    return res.status(500).json({ success: false, message: result.error?.message || "Query failed" });
  }
  const reports = result.data;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const payload = { success: true, generatedAt: nowIso, reportCount: reports.length };

  if (view === "all" || view === "readiness") {
    const approvals = await listReleaseApprovals();
    payload.readiness = buildDeploymentReadiness(reports, { approvals: approvals.data || [] });
  }
  if (view === "all" || view === "productivity") {
    payload.productivity = buildProductivityMetrics(reports, { now: nowIso, windowDays: days });
  }
  if (view === "all" || view === "knowledge") {
    const entries = await listKnowledgeEntries();
    payload.knowledge = buildKnowledgeCentre(reports, entries.data || [], { now: nowIso });
  }

  await recordDevPlatformAudit("dev_platform_view", {
    req,
    session,
    diff: { surface: "platform", view, reportCount: reports.length },
  });

  return res.status(200).json(payload);
}

export default createHandler({
  allowedRoles: DEV_PLATFORM_ROLES,
  methods: { GET: handleGet },
});
