// file location: src/pages/api/reports/preferences.js
//
// Per-user reporting preferences (Phase-1 §10).
//   GET /api/reports/preferences        → the caller's prefs (or null)
//   PUT /api/reports/preferences        { defaultDepartment, defaultRange, defaultDashboard, density, units }

import { withReportingAuth } from "@/lib/reporting/api";
import { getUserPreferences, putUserPreferences } from "@/lib/database/reporting/savedViews";

async function handler(req, res, rctx) {
  const userId = Number(rctx.session?.user?.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return rctx.sendError("A canonical user id is required for preferences", 401);
  }

  if (req.method === "GET") {
    const prefs = await getUserPreferences(userId);
    return rctx.sendOk({ data: { preferences: prefs } });
  }

  if (req.method === "PUT") {
    const result = await putUserPreferences(userId, req.body || {});
    if (!result.ok) return rctx.sendError(result.error || result.skipped || "could not save preferences", 400);
    return rctx.sendOk({ data: { saved: true } });
  }

  res.setHeader("Allow", ["GET", "PUT"]);
  return rctx.sendError("Method not allowed", 405);
}

export default withReportingAuth(handler, { methods: ["GET", "PUT"] });
