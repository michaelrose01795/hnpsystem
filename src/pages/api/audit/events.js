import { withRoleGuard } from "@/lib/auth/roleGuard";
import {
  getOwnedAuditSession,
  recordAuditEvents,
} from "@/lib/database/auditActivity";
import {
  getRequestAuditMetadata,
  normaliseClientEvent,
  resolveSessionActor,
} from "@/lib/audit/api";

async function handler(req, res, session) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  try {
    const actor = await resolveSessionActor(session);
    if (!actor) return res.status(204).end();
    const sessionId = String(req.body?.sessionId || "");
    const auditSession = await getOwnedAuditSession(sessionId, actor.userId);
    if (!auditSession || auditSession.status !== "active") {
      return res.status(409).json({ success: false, message: "The activity session is not active." });
    }

    const rawEvents = Array.isArray(req.body?.events)
      ? req.body.events
      : req.body?.event
      ? [req.body.event]
      : [];
    if (!rawEvents.length || rawEvents.length > 50) {
      return res.status(400).json({ success: false, message: "Between 1 and 50 events are required." });
    }
    const { ip } = getRequestAuditMetadata(req);
    const events = rawEvents
      .filter((event) => event?.eventName)
      .map((event) => normaliseClientEvent({ event, actor, sessionId, ip }));
    const ids = await recordAuditEvents(events);
    return res.status(202).json({ success: true, accepted: ids.length });
  } catch (error) {
    console.error("/api/audit/events error", error);
    return res.status(500).json({ success: false, message: "Unable to record activity events." });
  }
}

export default withRoleGuard(handler);
