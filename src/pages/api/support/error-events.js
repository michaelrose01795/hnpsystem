// file location: src/pages/api/support/error-events.js
//
// Ingest endpoint for AUTOMATIC in-app error capture.
//
// POST — any signed-in user. Called by src/lib/support/autoErrorLog.js whenever
// the in-app error experience catches something: a render crash, a window
// runtime error / unhandled rejection, an API or data-load failure, a permission
// denial, or a framework page error. Fired WHETHER OR NOT the user goes on to
// press "Report a problem", so the technical trail exists either way.
//
// GET  — developer-only listing of what has been captured (same DEV_PLATFORM
//        gate as the support report list).
//
// Privacy + trust model, matching /api/support/reports:
//   • Identity (user id / username / roles) is taken from the SESSION, never
//     from the request body — a client cannot log an event as someone else.
//   • The payload is re-sanitised server-side inside the DB helper; the client
//     already scrubbed once but is untrusted.
//   • The request's own User-Agent is read from the headers, not the body.
//   • Rate-limited per user (falling back to IP) so a runaway client loop cannot
//     flood the table. A rejected caller gets a plain 429 — the client swallows
//     it, so a throttled log never surfaces to the user as a second error.
//
// This route never fails loudly: capture must not be able to break the thing it
// is observing, so a persistence failure returns 202 (accepted, not stored)
// rather than a 500 the client would treat as another error.

import createHandler from "@/lib/api/createHandler";
import {
  recordSupportErrorEvent,
  listSupportErrorEvents,
} from "@/lib/database/supportErrorEvents";
import { hasDevPlatformAccess, normalizeRoles } from "@/lib/auth/roles";
import {
  checkRateLimit,
  rateLimitKey,
  pruneRateStore,
  createRateStore,
} from "@/lib/support/rateLimit";

export const config = {
  api: {
    // A stack + component stack is the bulk of the payload; 256 KB is ample and
    // well under the diagnostics cap used by the report route.
    bodyParser: { sizeLimit: "256kb" },
  },
};

// Automatic capture is machine-driven, so it gets its own store and a higher
// ceiling than the human report route — but still bounded. The client
// de-duplicates first, so a well-behaved page never approaches this.
const errorEventRateStore = createRateStore();
const ERROR_EVENT_RATE_LIMIT = Object.freeze({
  windowMs: 60 * 1000,
  max: 30,
  abuseThreshold: 200,
  retainMs: 10 * 60 * 1000,
});

const clientIp = (req) => {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || null;
};

const toInt = (value) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) ? n : null;
};

async function handlePost(req, res, session) {
  const ip = clientIp(req);
  const rl = checkRateLimit({
    key: rateLimitKey({ userId: session?.user?.id, ip }),
    store: errorEventRateStore,
    limit: ERROR_EVENT_RATE_LIMIT,
  });
  pruneRateStore(errorEventRateStore, Date.now(), ERROR_EVENT_RATE_LIMIT);

  if (!rl.allowed) {
    res.setHeader("Retry-After", Math.ceil(rl.retryAfterMs / 1000));
    return res.status(429).json({ success: false, message: "Too many error events." });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};

  const result = await recordSupportErrorEvent({
    // --- from the client (untrusted, re-sanitised in the helper) ---
    referenceCode: body.referenceCode,
    fingerprint: body.fingerprint,
    kind: body.kind,
    boundaryLevel: body.boundaryLevel,
    variant: body.variant,
    message: body.message,
    stack: body.stack,
    componentStack: body.componentStack,
    component: body.component,
    statusCode: toInt(body.statusCode),
    route: body.route,
    sectionKey: body.sectionKey,
    device: body.device,
    context: body.context,
    appVersion: body.appVersion,
    commitSha: body.commitSha,
    commitRef: body.commitRef,
    buildId: body.buildId,
    deploymentEnv: body.deploymentEnv,

    // --- server-resolved, never from the body ---
    userId: toInt(session?.user?.id),
    // Same resolution order as buildReportInsert(), so an auto-logged event and
    // a user-filed report name the same person the same way.
    username: session?.user?.name || session?.user?.email || null,
    roles: normalizeRoles(
      Array.isArray(session?.user?.roles) ? session.user.roles : []
    ),
    userAgent: req.headers["user-agent"] || null,
  });

  if (!result.success) {
    // Accepted but not stored. Deliberately not a 500: the client must not treat
    // a logging failure as another error to log.
    return res.status(202).json({ success: false, stored: false });
  }

  return res.status(201).json({
    success: true,
    stored: true,
    deduped: Boolean(result.deduped),
    id: result.data?.id || null,
    referenceCode: result.data?.reference_code || null,
  });
}

// GET /api/support/error-events — developer Support Centre view of the captured
// trail. Gated here (not by createHandler's allow-list) because the POST above
// must stay open to every signed-in user, exactly as /api/support/reports does.
async function handleGet(req, res, session) {
  if (!hasDevPlatformAccess(session?.user?.roles || [])) {
    return res.status(403).json({ success: false, message: "Insufficient permissions" });
  }

  const q = req.query || {};
  const result = await listSupportErrorEvents({
    limit: q.limit,
    kind: q.kind,
    route: q.route,
    referenceCode: q.referenceCode,
    fingerprint: q.fingerprint,
    reportId: q.reportId,
  });

  if (!result.success) {
    return res.status(500).json({ success: false, message: "Query failed" });
  }
  return res.status(200).json({ success: true, data: result.data, count: result.count });
}

export default createHandler({
  // Empty allow-list = any authenticated user (withRoleGuard). The GET re-gates
  // itself to developers above.
  allowedRoles: [],
  methods: { POST: handlePost, GET: handleGet },
});
