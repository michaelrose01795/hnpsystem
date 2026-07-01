// file location: src/pages/api/support/intelligence.js
//
// Phase 9 — Developer Platform INTELLIGENCE aggregation endpoint. Dev-gated
// (DEV_PLATFORM_ROLES / `dev`) by createHandler — the same strict gate as the
// rest of the Support Centre APIs. It reads a bounded window of the LIGHT report
// rows (never the RLS-locked diagnostics blob) and runs the pure aggregation
// engines SERVER-SIDE, returning ready-to-render analytics so the dashboards do
// no heavy work on the client. The read is audit-logged (dev_platform_view).
//
//   GET /api/support/intelligence?window=1000&view=all|intelligence|releases|ownership
//
// Response: { success, generatedAt, reportCount,
//             intelligence, releases, ownership, directory }
// Performance/tracing is NOT here — it is derived client-side from the live
// captureDiagnostics() snapshot (Live Ops bundle), so it never leaves the device.

import createHandler from "@/lib/api/createHandler";
import { listReportsForIntelligence } from "@/lib/database/support";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { buildIntelligence } from "@/lib/dev-platform/intelligence";
import { buildReleaseIntelligence } from "@/lib/dev-platform/releaseIntelligence";
import { buildOwnershipMap } from "@/lib/dev-platform/ownershipGraph";
import { buildDeveloperDirectory } from "@/lib/dev-platform/developerDirectory";
import { recordDevPlatformAudit } from "@/lib/support/devPlatformAudit";

const toInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) ? n : fallback;
};

async function handleGet(req, res, session) {
  const q = req.query || {};
  const window = Math.min(Math.max(toInt(q.window, 1000), 1), 5000);
  const view = typeof q.view === "string" ? q.view : "all";

  const result = await listReportsForIntelligence({ window });
  if (!result.success) {
    return res.status(500).json({ success: false, message: result.error?.message || "Query failed" });
  }
  const reports = result.data;
  const now = Date.now();

  const payload = {
    success: true,
    generatedAt: new Date(now).toISOString(),
    reportCount: reports.length,
    windowCount: result.count,
  };
  if (view === "all" || view === "intelligence") payload.intelligence = buildIntelligence(reports, { now });
  if (view === "all" || view === "releases") payload.releases = buildReleaseIntelligence(reports, { now });
  if (view === "all" || view === "ownership") payload.ownership = buildOwnershipMap(reports, { now });
  if (view === "all") {
    payload.directory = buildDeveloperDirectory(reports, {
      currentUser: { id: session?.user?.id, username: session?.user?.username || session?.user?.name },
    });
  }

  // Content-free read audit (the aggregates carry no secrets, but access to the
  // developer intelligence surface is worth recording — mirrors the Support
  // Centre's dev_platform_view discipline).
  await recordDevPlatformAudit("dev_platform_view", {
    req,
    session,
    diff: { surface: "intelligence", view, reportCount: reports.length },
  });

  return res.status(200).json(payload);
}

export default createHandler({
  allowedRoles: DEV_PLATFORM_ROLES,
  methods: { GET: handleGet },
});
