import { withRoleGuard } from "@/lib/auth/roleGuard";
import {
  endAuditSession,
  startAuditSession,
  touchAuditSession,
} from "@/lib/database/auditActivity";
import {
  getRequestAuditMetadata,
  resolveSessionActor,
} from "@/lib/audit/api";

async function handler(req, res, session) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  try {
    const actor = await resolveSessionActor(session);
    if (!actor) {
      return res.status(204).end();
    }
    const action = String(req.body?.action || "").toLowerCase();

    if (action === "start") {
      const request = getRequestAuditMetadata(req, req.body?.deviceHints || {});
      const auditSession = await startAuditSession({
        clientSessionId: req.body?.clientSessionId,
        actor,
        ip: request.ip,
        userAgent: request.userAgent,
        device: request.device,
        appMode: req.body?.appMode,
      });
      return res.status(200).json({ success: true, data: auditSession });
    }

    if (action === "heartbeat") {
      const auditSession = await touchAuditSession({
        sessionId: req.body?.sessionId,
        userId: actor.userId,
      });
      return res.status(200).json({ success: true, data: auditSession });
    }

    if (action === "end") {
      const status = ["logged_out", "expired", "unexpected_close"].includes(req.body?.status)
        ? req.body.status
        : "unexpected_close";
      const auditSession = await endAuditSession({
        sessionId: req.body?.sessionId,
        userId: actor.userId,
        status,
        endReason: String(req.body?.endReason || status).slice(0, 100),
      });
      return res.status(200).json({ success: true, data: auditSession });
    }

    return res.status(400).json({ success: false, message: "Invalid audit session action." });
  } catch (error) {
    console.error("/api/audit/session error", error);
    return res.status(500).json({ success: false, message: "Unable to update the activity session." });
  }
}

export default withRoleGuard(handler);
