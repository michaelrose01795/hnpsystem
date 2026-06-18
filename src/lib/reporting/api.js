// file location: src/lib/reporting/api.js
//
// API auth + context wrapper for /api/reports/* (Phase-1 §9.3 route gate).
// Composes the EXISTING withRoleGuard (so reporting reuses one access backbone —
// ADR-7) with reporting concerns: it resolves the permission SCOPE from the
// session, normalises the FILTER from the request, and hands the handler a ready
// reporting context plus envelope senders.
//
//   export default withReportingAuth(async (req, res, rctx) => {
//     const result = await getKpiValue("vhc.red_items", rctx);
//     rctx.sendOk({ data: result, provenance: result.provenance, scope: rctx.scope });
//   });
//
// `allow: []` (the default) means any AUTHENTICATED user passes the route gate;
// the permission SCOPE then decides what data they actually receive. Pass `allow`
// to additionally restrict a whole endpoint to specific roles.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { resolveScope } from "./permissionScope";
import { normaliseFilter } from "./filters";
import { buildEnvelope, buildErrorEnvelope } from "./envelope";
import { getReportingFlag } from "./config/flags";

export function withReportingAuth(handler, { allow = [], methods = ["GET"] } = {}) {
  return withRoleGuard(
    async (req, res, session) => {
      // Method gate (kept consistent with the existing API convention).
      if (!methods.includes(req.method)) {
        res.setHeader("Allow", methods);
        return res.status(405).json(buildErrorEnvelope("Method not allowed"));
      }

      if (!getReportingFlag("reporting_enabled")) {
        // Master switch off → respond with an empty, non-erroring envelope.
        return res.status(200).json(
          buildEnvelope({ data: null, warnings: ["reporting platform is disabled"] })
        );
      }

      try {
        const scope = resolveScope(session);
        const rawInput = req.method === "GET" ? req.query : { ...(req.query || {}), ...(req.body || {}) };
        const filter = normaliseFilter(rawInput);

        const rctx = {
          req,
          res,
          session,
          scope,
          filter,
          // Standard envelope senders.
          sendOk: (payload = {}) =>
            res.status(200).json(buildEnvelope({ scope, rangeApplied: filter.dateRange, ...payload })),
          sendError: (message, code = 400) =>
            res.status(code).json(buildErrorEnvelope(message)),
        };

        return await handler(req, res, rctx);
      } catch (err) {
        console.error("[reporting] route error:", err?.message || err);
        return res.status(500).json(buildErrorEnvelope(err?.message || "Reporting error"));
      }
    },
    { allow }
  );
}

export default withReportingAuth;
