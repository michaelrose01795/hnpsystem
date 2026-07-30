import { getClientIp, getUserAgent } from "@/lib/auth/rateLimit";
import { getAuditActor } from "@/lib/database/auditActivity";
import { parseUserAgent } from "@/lib/audit/device";
import { sanitiseRoute } from "@/lib/audit/privacy";

export const parsePositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const resolveSessionActor = async (session) => {
  const userId = parsePositiveInteger(session?.user?.id);
  if (!userId) return null;
  return getAuditActor(userId);
};

export const getRequestAuditMetadata = (req, clientHints = {}) => {
  const userAgent = getUserAgent(req);
  return {
    ip: getClientIp(req),
    userAgent,
    device: parseUserAgent(userAgent, clientHints),
  };
};

export const normaliseOutcome = (value) =>
  ["success", "failure", "cancelled", "unknown"].includes(value)
    ? value
    : "unknown";

export const normaliseClientEvent = ({ event, actor, sessionId, ip }) => ({
  session_id: sessionId,
  actor_user_id: actor.userId,
  actor_name: actor.name,
  actor_role: actor.role,
  actor_department: actor.department,
  occurred_at: event.occurredAt || new Date().toISOString(),
  event_name: String(event.eventName || "").trim().slice(0, 100),
  action_category: String(event.actionCategory || "interaction").trim().slice(0, 80),
  feature: event.feature ? String(event.feature).slice(0, 100) : null,
  route: sanitiseRoute(event.route),
  page_title: event.pageTitle ? String(event.pageTitle).slice(0, 180) : null,
  previous_page: sanitiseRoute(event.previousPage),
  page_entered_at: event.pageEnteredAt || null,
  page_left_at: event.pageLeftAt || null,
  duration_ms: Math.min(86_400_000, Math.max(0, Number(event.durationMs) || 0)) || null,
  action_label: event.actionLabel ? String(event.actionLabel).slice(0, 240) : null,
  record_type: event.recordType ? String(event.recordType).slice(0, 100) : null,
  record_id: event.recordId ? String(event.recordId).slice(0, 180) : null,
  outcome: normaliseOutcome(event.outcome),
  request_id: event.requestId || null,
  dedupe_key: event.dedupeKey ? String(event.dedupeKey).slice(0, 240) : null,
  before_data: event.beforeData || null,
  after_data: event.afterData || null,
  metadata: event.metadata || {},
  ip_address: ip || null,
});

const csvCell = (value) => {
  if (value === null || value === undefined) return "";
  let text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export function auditEventsToCsv(rows = []) {
  const columns = [
    ["occurred_at", "Occurred at"],
    ["actor_name", "User"],
    ["actor_role", "Role"],
    ["actor_department", "Department"],
    ["session_id", "Session"],
    ["event_name", "Event"],
    ["action_category", "Category"],
    ["feature", "Feature"],
    ["route", "Route"],
    ["page_title", "Page title"],
    ["action_label", "Action"],
    ["record_type", "Record type"],
    ["record_id", "Record ID"],
    ["outcome", "Outcome"],
    ["duration_ms", "Duration ms"],
    ["device_category", "Device"],
    ["operating_system", "Operating system"],
    ["browser", "Browser"],
    ["app_mode", "App mode"],
    ["session_ip_address", "IP address"],
    ["metadata", "Metadata"],
    ["before_data", "Before"],
    ["after_data", "After"],
  ];
  return [
    columns.map(([, label]) => csvCell(label)).join(","),
    ...rows.map((row) => {
      const session = Array.isArray(row.audit_sessions)
        ? row.audit_sessions[0]
        : row.audit_sessions;
      const exportRow = {
        ...row,
        device_category: session?.device_category,
        operating_system: session?.operating_system,
        browser: [session?.browser_name, session?.browser_version].filter(Boolean).join(" "),
        app_mode: session?.app_mode,
        session_ip_address: session?.ip_address,
      };
      return columns.map(([key]) => csvCell(exportRow[key])).join(",");
    }),
  ].join("\r\n");
}
