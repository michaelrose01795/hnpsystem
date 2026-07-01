// file location: src/lib/support/notificationRules.js
//
// Phase 10 — PURE notification rule matching + notification composition. Given a
// platform EVENT (a report was created / went critical / recurred as a
// regression / was assigned; a release was blocked) and the set of subscription
// rules, decide who is notified and build the notification rows to persist.
//
// PURE + node-testable (no I/O, no window). The delivery layer (a DB helper)
// takes buildNotifications()' output and inserts one support_notifications row
// per recipient. Content-free of secrets — titles/bodies reference identities,
// routes and counts only.

const arr = (v) => (Array.isArray(v) ? v : []);

export const NOTIFICATION_EVENTS = [
  "report.created",
  "report.critical",
  "report.regression",
  "report.assigned",
  "release.blocked",
  "release.approved",
];

const SEVERITY_ORDER = { info: 0, unset: 0, low: 1, medium: 2, high: 3, critical: 4 };
const sevRank = (s) => SEVERITY_ORDER[String(s || "").toLowerCase()] ?? 0;

// Team-wide default rules: sensible baseline so notifications work before any
// developer customises their subscriptions. `owner_key: "*"` fans out to every
// known recipient (resolved by the delivery layer).
export const DEFAULT_NOTIFICATION_RULES = [
  { owner_key: "*", event: "report.critical", filters: {}, channels: ["inapp"], enabled: true },
  { owner_key: "*", event: "report.regression", filters: {}, channels: ["inapp"], enabled: true },
  { owner_key: "*", event: "release.blocked", filters: {}, channels: ["inapp"], enabled: true },
];

/**
 * Does a single rule match an event? Supported filters:
 *   minSeverity  — event severity must rank >= this
 *   category     — string or string[] the event category must be in
 *   routePrefix  — event route must start with this
 *   isRegression — boolean; event.isRegression must equal it
 *   assigneeKey  — only match when the event's assignee equals this (used with
 *                  owner_key so "notify me about my assignments" works)
 */
export function matchRule(rule, event) {
  if (!rule || rule.enabled === false) return false;
  if (rule.event !== event?.type) return false;
  const f = rule.filters || {};

  if (f.minSeverity && sevRank(event.severity) < sevRank(f.minSeverity)) return false;
  if (f.category != null) {
    const cats = Array.isArray(f.category) ? f.category.map(String) : [String(f.category)];
    if (!cats.includes(String(event.category))) return false;
  }
  if (f.routePrefix && !String(event.route || "").startsWith(String(f.routePrefix))) return false;
  if (typeof f.isRegression === "boolean" && Boolean(event.isRegression) !== f.isRegression) return false;
  if (f.assigneeKey != null && String(event.assigneeKey) !== String(f.assigneeKey)) return false;

  return true;
}

// Human-readable title/body for each event type (no secrets — identities/counts only).
export function describeEvent(event = {}) {
  const sev = event.severity ? String(event.severity).toUpperCase() : "";
  const subject = event.title || event.route || "a report";
  switch (event.type) {
    case "report.created":
      return { severity: "info", title: `New report: ${subject}`, body: `${event.category || "issue"} reported${event.route ? ` on ${event.route}` : ""}.` };
    case "report.critical":
      return { severity: "critical", title: `Critical: ${subject}`, body: `A ${sev} issue was captured${event.route ? ` on ${event.route}` : ""}.` };
    case "report.regression":
      return { severity: "warning", title: `Regression: ${subject}`, body: `This incident recurred across releases${event.firstSeenVersion ? ` (first seen ${event.firstSeenVersion})` : ""}.` };
    case "report.assigned":
      return { severity: "info", title: `Assigned to you: ${subject}`, body: `A report was assigned to you${event.route ? ` on ${event.route}` : ""}.` };
    case "release.blocked":
      return { severity: "critical", title: `Release blocked: ${event.releaseKey || "release"}`, body: `Deployment readiness scored ${event.score ?? "?"}/100 with blockers.` };
    case "release.approved":
      return { severity: "success", title: `Release approved: ${event.releaseKey || "release"}`, body: `Approved${event.approverKey ? ` by ${event.approverKey}` : ""}.` };
    default:
      return { severity: "info", title: subject, body: event.body || "" };
  }
}

/**
 * Build the notification rows for an event by matching it against all rules.
 * De-dupes so a recipient never gets the same event twice.
 *
 * @param {object} event  { type, severity, category, route, title, link, entityType, entityId, isRegression, assigneeKey, releaseKey, score }
 * @param {object[]} rules subscription rules (may include owner_key "*")
 * @param {{ recipients?: string[] }} [opts] recipients that "*" fans out to
 * @returns {Array<{owner_key,kind,title,body,link,severity,entity_type,entity_id,channels}>}
 */
export function buildNotifications(event = {}, rules = [], opts = {}) {
  const desc = describeEvent(event);
  const recipients = arr(opts.recipients);
  const perRecipient = new Map(); // owner_key -> channels Set

  for (const rule of arr(rules)) {
    if (!matchRule(rule, event)) continue;
    const targets = rule.owner_key === "*" ? recipients : [rule.owner_key];
    for (const key of targets) {
      if (!key) continue;
      // "report.assigned" only ever goes to the assignee, even via a "*" rule.
      if (event.type === "report.assigned" && event.assigneeKey != null && String(key) !== String(event.assigneeKey)) continue;
      if (!perRecipient.has(key)) perRecipient.set(key, new Set());
      arr(rule.channels).forEach((c) => perRecipient.get(key).add(c));
    }
  }

  return Array.from(perRecipient.entries()).map(([owner_key, channels]) => ({
    owner_key,
    kind: event.type,
    title: desc.title,
    body: event.body || desc.body,
    link: event.link || null,
    severity: desc.severity,
    entity_type: event.entityType || null,
    entity_id: event.entityId != null ? String(event.entityId) : null,
    channels: Array.from(channels.size ? channels : ["inapp"]),
  }));
}
