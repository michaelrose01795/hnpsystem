// file location: src/pages/api/reports/views.js
//
// CRUD for saved reporting views (Phase-1 §10). All operations are scoped to the
// caller's canonical user id (session.user.id). Personal views are private;
// scope='shared' views are readable by all reporting users.
//   GET    /api/reports/views
//   POST   /api/reports/views        { name, scope, targetRef, filter, layout }
//   PUT    /api/reports/views        { viewId, ...patch }
//   DELETE /api/reports/views?viewId=

import { withReportingAuth } from "@/lib/reporting/api";
import {
  listSavedViews,
  createSavedView,
  updateSavedView,
  deleteSavedView,
} from "@/lib/database/reporting/savedViews";

async function handler(req, res, rctx) {
  const ownerUserId = Number(rctx.session?.user?.id);
  if (!Number.isFinite(ownerUserId) || ownerUserId <= 0) {
    return rctx.sendError("A canonical user id is required for saved views", 401);
  }

  if (req.method === "GET") {
    const views = await listSavedViews(ownerUserId);
    return rctx.sendOk({ data: { views } });
  }

  if (req.method === "POST") {
    const { name, scope, targetRef, filter, layout } = req.body || {};
    if (!name) return rctx.sendError("`name` is required", 400);
    const result = await createSavedView({ ownerUserId, name, scope, targetRef, filter, layout });
    if (!result.ok) return rctx.sendError(result.error || result.skipped || "could not create view", 400);
    return rctx.sendOk({ data: { view: result.view } });
  }

  if (req.method === "PUT") {
    const { viewId, ...patch } = req.body || {};
    if (!viewId) return rctx.sendError("`viewId` is required", 400);
    const result = await updateSavedView(viewId, ownerUserId, patch);
    if (!result.ok) return rctx.sendError(result.error || result.skipped || "could not update view", 400);
    return rctx.sendOk({ data: { updated: true } });
  }

  if (req.method === "DELETE") {
    const viewId = req.query.viewId || req.body?.viewId;
    if (!viewId) return rctx.sendError("`viewId` is required", 400);
    const result = await deleteSavedView(viewId, ownerUserId);
    if (!result.ok) return rctx.sendError(result.error || result.skipped || "could not delete view", 400);
    return rctx.sendOk({ data: { deleted: true } });
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  return rctx.sendError("Method not allowed", 405);
}

export default withReportingAuth(handler, { methods: ["GET", "POST", "PUT", "DELETE"] });
