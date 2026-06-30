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
// Body shape (JSON): { title?, description, category, diagnostics, screenshot? }
// where `diagnostics` is the sanitised snapshot from the support context and
// `screenshot` is an optional base64 image data URL.

import createHandler from "@/lib/api/createHandler";
import { createSupportReport, setSupportReportScreenshot } from "@/lib/database/support";
import {
  uploadSupportScreenshot,
} from "@/lib/storage/supportMediaBucketService";
import { buildReportInsert, decodeScreenshot } from "@/lib/support/reportSubmission";
import { writeAuditLog } from "@/lib/audit/auditLog";

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

async function handlePost(req, res, session) {
  // 1. Validate the screenshot before creating anything.
  const shot = decodeScreenshot(req.body?.screenshot);
  if (!shot.ok) {
    return res.status(400).json({ success: false, message: shot.error });
  }

  // 2. Validate + assemble the insert (re-sanitises diagnostics, identity from session).
  const built = buildReportInsert({ body: req.body, session });
  if (!built.ok) {
    return res.status(400).json({ success: false, message: built.error });
  }
  const { input } = built;

  // 3. Persist (helper re-sanitises + size-caps a third time, then inserts).
  const created = await createSupportReport(input);
  if (!created.success) {
    return res
      .status(500)
      .json({ success: false, message: created.error?.message || "Could not save your report." });
  }
  const reportId = created.data?.id;

  // 4. Upload the screenshot (best-effort — the report is already saved).
  let screenshotAttached = false;
  if (shot.file && reportId) {
    try {
      const { storagePath } = await uploadSupportScreenshot(shot.file, reportId);
      const updated = await setSupportReportScreenshot(reportId, storagePath);
      screenshotAttached = Boolean(updated.success);
    } catch (error) {
      console.error("[support] screenshot attach failed:", error?.message || error);
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
      has_screenshot: screenshotAttached,
    },
    ip: clientIp(req),
    userAgent: req.headers["user-agent"] || null,
  });

  return res.status(201).json({
    success: true,
    data: { id: reportId, screenshotAttached },
  });
}

// allowedRoles: [] → any authenticated session may submit (withRoleGuard treats
// an empty allow-list as "authenticated is sufficient").
export default createHandler({
  allowedRoles: [],
  methods: { POST: handlePost },
});
