// file location: src/pages/api/support/reports.js
//
// Phase 3 — authenticated submit endpoint for the Help & Diagnostics ("support")
// feature. Any signed-in user may file a report; the admin viewer (Phase 6) adds
// the GET/PATCH routes later.
//
// Flow (privacy-first, plan §4 / §10):
//   1. Decode + validate the user-previewed screenshot data URL up front, so a
//      malformed image is a clean 400 and never leaves an orphan report.
//   2. Re-sanitise the diagnostics blob server-side (the client is untrusted)
//      and take the reporter identity from the session, not the request body
//      (buildReportInsert()).
//   3. Persist via the support DB helper ONLY — never raw Supabase here.
//   4. Upload the screenshot to the PRIVATE support-reports bucket, then attach
//      its path. Upload failure does not fail the report (it is already saved).
//   5. Write the append-only audit log entry for the create.
//
// Body shape (JSON): { title?, description, category, diagnostics, screenshots? }
// where `diagnostics` is the sanitised snapshot from the support context and
// `screenshots` is an optional array of base64 image data URLs (a legacy single
// `screenshot` string is still accepted).

import createHandler from "@/lib/api/createHandler";
import {
  createSupportReport,
  setSupportReportScreenshots,
  listRecentReportFingerprints,
  listSupportReports,
  getSupportReportStats,
} from "@/lib/database/support";
import { hasDevPlatformAccess } from "@/lib/auth/roles";
import { normaliseListFilters } from "@/lib/support/triageValidation";
import {
  uploadSupportScreenshot,
} from "@/lib/storage/supportMediaBucketService";
import { buildReportInsert, decodeScreenshots } from "@/lib/support/reportSubmission";
import {
  checkRateLimit,
  rateLimitKey,
  pruneRateStore,
  defaultSupportRateStore,
} from "@/lib/support/rateLimit";
import { getOrBuildInvestigation } from "@/lib/support/investigationCache";
import { readBuildInfo } from "@/lib/support/buildInfo";
import { getSectionSourceMapHash } from "@/lib/dev-layout/sectionSourceMap";
import { isWithinSizeCap } from "@/lib/support/sanitise";
import { writeAuditLog } from "@/lib/audit/auditLog";
import { sendSupportReportNotification } from "@/lib/support/supportReportNotifier";

export const config = {
  api: {
    // Diagnostics is capped at 256 KB; a 5 MB screenshot is ~6.8 MB once
    // base64-encoded. 8 MB leaves headroom for the JSON envelope.
    bodyParser: { sizeLimit: "8mb" },
  },
};

const clientIp = (req) => {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || null;
};

const toInt = (value) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) ? n : null;
};

// The POST endpoint is open to any authenticated user (report submission), but
// the GET list is developer-only. createHandler applies one allow-list to the
// whole route, so the list gates itself here against the strict DEV_PLATFORM_ROLES
// (`dev`) — Phase 8 re-gate. The reporter POST below is untouched.
const isDeveloper = (session) =>
  hasDevPlatformAccess(session?.user?.roles || []);

// GET /api/support/reports — developer Support Centre list (+ optional stats).
async function handleGet(req, res, session) {
  if (!isDeveloper(session)) {
    return res.status(403).json({ success: false, message: "Insufficient permissions" });
  }
  const q = req.query || {};
  const filters = normaliseListFilters(q);
  const result = await listSupportReports(filters);
  if (!result.success) {
    return res.status(500).json({ success: false, message: result.error?.message || "Query failed" });
  }

  const payload = { success: true, data: result.data, count: result.count };
  if (q.withStats === "1" || q.withStats === "true") {
    const stats = await getSupportReportStats();
    if (stats.success) payload.stats = stats.stats;
  }
  return res.status(200).json(payload);
}

async function handlePost(req, res, session) {
  // 0. Rate limit + abuse detection (Phase 7). Keyed by the authenticated user id
  //    (falling back to client IP) so a caller cannot dodge the limit by rotating
  //    one or the other. A rejected caller gets a 429 + Retry-After; a caller that
  //    keeps hammering past the abuse threshold is audit-logged once so an admin
  //    can see the pattern. Records no request content — only key + timestamps.
  const ip = clientIp(req);
  const rlKey = rateLimitKey({ userId: session?.user?.id, ip });
  const rl = checkRateLimit({ key: rlKey, store: defaultSupportRateStore });
  pruneRateStore(defaultSupportRateStore);
  if (!rl.allowed) {
    if (rl.abuse) {
      // Best-effort audit; never blocks the 429 response.
      await writeAuditLog({
        action: "support_report_rate_limited",
        actorUserId: toInt(session?.user?.id),
        actorRole: session?.user?.roles?.[0] || null,
        entityType: "support_report",
        entityId: null,
        diff: { reason: "abuse", hits: rl.count },
        ip,
        userAgent: req.headers["user-agent"] || null,
      }).catch(() => {});
    }
    res.setHeader("Retry-After", Math.ceil(rl.retryAfterMs / 1000));
    return res.status(429).json({
      success: false,
      message: "You're sending reports too quickly. Please wait a moment and try again.",
    });
  }

  // 1. Validate the screenshots before creating anything (accepts the new
  //    `screenshots` array; falls back to a legacy single `screenshot`).
  const shots = decodeScreenshots(req.body?.screenshots ?? req.body?.screenshot);
  if (!shots.ok) {
    return res.status(400).json({ success: false, message: shots.error });
  }

  // 2. Validate + assemble the insert (re-sanitises diagnostics, identity from session).
  const built = buildReportInsert({ body: req.body, session });
  if (!built.ok) {
    return res.status(400).json({ success: false, message: built.error });
  }
  const { input } = built;

  // 2b. Developer-only INVESTIGATION. Built from the already-sanitised diagnostics
  //     plus lightweight fingerprints of recent reports (for "similar previous
  //     incidents"), then embedded in the diagnostics blob — which is RLS-locked
  //     and never returned to the reporter, so the investigation stays dev-only.
  //     Best-effort: never block report creation, and never let it push the blob
  //     over the size cap (drop it rather than fail the report).
  try {
    const priorReports = await listRecentReportFingerprints(50);
    // The code state THIS server is currently running, so the investigation can
    // detect drift between what the reporter captured and the live deployment
    // (Phase 5). Non-secret; re-sanitised with the rest of the blob.
    const currentBuild = readBuildInfo(process.env, { sectionMapHash: getSectionSourceMapHash() });
    const { investigation } = getOrBuildInvestigation(input.diagnostics, {
      priorReports,
      currentBuild,
      now: new Date().toISOString(),
    });
    const enriched = { ...input.diagnostics, investigation, fingerprint: investigation.fingerprint };
    if (isWithinSizeCap(enriched)) input.diagnostics = enriched;
  } catch (error) {
    console.error("[support] investigation build failed:", error?.message || error);
  }

  // 3. Persist (helper re-sanitises + size-caps a third time, then inserts).
  const created = await createSupportReport(input);
  if (!created.success) {
    return res
      .status(500)
      .json({ success: false, message: created.error?.message || "Could not save your report." });
  }
  const reportId = created.data?.id;

  // 4. Upload the screenshots (best-effort — the report is already saved). Each
  //    upload is independent; any that fail are simply omitted from the list.
  let screenshotCount = 0;
  if (shots.files.length && reportId) {
    const uploadedPaths = [];
    for (const file of shots.files) {
      try {
        const { storagePath } = await uploadSupportScreenshot(file, reportId);
        uploadedPaths.push(storagePath);
      } catch (error) {
        console.error("[support] screenshot upload failed:", error?.message || error);
      }
    }
    if (uploadedPaths.length) {
      const updated = await setSupportReportScreenshots(reportId, uploadedPaths);
      if (updated.success) screenshotCount = uploadedPaths.length;
    }
  }

  // 5. Append-only audit log (never throws; failures are logged internally).
  await writeAuditLog({
    action: "support_report_create",
    actorUserId: input.reporterUserId,
    actorRole: input.reporterRoles?.[0] || null,
    entityType: "support_report",
    entityId: reportId,
    diff: {
      category: input.category,
      route: input.route,
      section_key: input.sectionKey,
      screenshot_count: screenshotCount,
    },
    ip: clientIp(req),
    userAgent: req.headers["user-agent"] || null,
  });

  // 6. Best-effort internal notification email (Phase 11). Carries only the
  //    already-sanitised persisted columns (never the diagnostics blob), and
  //    NEVER throws — the report is already saved, so email failure/absence of
  //    SMTP must not affect the response.
  await sendSupportReportNotification({
    req,
    report: {
      id: reportId,
      ...input,
      status: created.data?.status,
      severity: created.data?.severity,
      created_at: created.data?.created_at,
    },
    screenshotCount,
  });

  return res.status(201).json({
    success: true,
    data: { id: reportId, screenshotCount },
  });
}

// allowedRoles: [] → any authenticated session may submit (withRoleGuard treats
// an empty allow-list as "authenticated is sufficient").
export default createHandler({
  allowedRoles: [],
  methods: { POST: handlePost, GET: handleGet },
});
