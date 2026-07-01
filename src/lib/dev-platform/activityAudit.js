// file location: src/lib/dev-platform/activityAudit.js
//
// Phase 10 — PURE shaping of hash-chained audit_log rows into a developer
// ACTIVITY FEED, plus a coverage report (which platform action types have been
// observed) that backs the "comprehensive developer-action audit sweep" test.
// Reads only already-redacted audit rows (writeAuditLog redacts secrets before
// persistence) — no new privacy surface. node-testable.

const arr = (v) => (Array.isArray(v) ? v : []);
const pick = (row, ...keys) => {
  for (const k of keys) if (row?.[k] != null) return row[k];
  return null;
};

// Every Developer Platform action the platform is expected to audit. The
// coverage test asserts each of these is actually written somewhere in the code
// so no dev action goes unlogged.
export const EXPECTED_DEV_ACTIONS = [
  "dev_platform_session",
  "dev_platform_view",
  "dev_platform_action",
];

// Friendly categorisation + label for a raw action string.
const CATEGORY = [
  [/session/i, "Session"],
  [/view|read|list|detail/i, "Access"],
  [/comment/i, "Comment"],
  [/triage|update|bulk|reopen|assign|status|severity/i, "Triage"],
  [/github|issue|link|sync/i, "Integration"],
  [/notification|preference|saved_view|approval|knowledge/i, "Configuration"],
];
function categorise(action) {
  for (const [re, label] of CATEGORY) if (re.test(action || "")) return label;
  return "Other";
}

function summarise(row, action) {
  const diff = row?.diff || {};
  const bits = [];
  if (diff.action) bits.push(String(diff.action).replace(/_/g, " "));
  else if (diff.kind) bits.push(String(diff.kind).replace(/_/g, " "));
  if (diff.status) bits.push(`→ ${diff.status}`);
  if (diff.count != null) bits.push(`(${diff.count})`);
  return bits.length ? bits.join(" ") : action.replace(/_/g, " ");
}

/**
 * Shape raw audit rows into activity items (newest first).
 * Defensive about column spelling (actor_user_id vs actorUserId, etc.).
 * @param {object[]} rows
 * @returns {Array<{id,action,category,actorUserId,actorRole,entityType,entityId,at,summary}>}
 */
export function shapeActivity(rows = []) {
  return arr(rows)
    .map((row) => {
      const action = pick(row, "action") || "unknown";
      return {
        id: pick(row, "id", "audit_id"),
        action,
        category: categorise(action),
        actorUserId: pick(row, "actor_user_id", "actorUserId"),
        actorRole: pick(row, "actor_role", "actorRole"),
        entityType: pick(row, "entity_type", "entityType"),
        entityId: pick(row, "entity_id", "entityId"),
        at: pick(row, "occurred_at", "created_at", "createdAt", "at"),
        summary: summarise(row, action),
      };
    })
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
}

/**
 * Coverage of expected dev actions against what has actually been logged.
 * @param {object[]} rows audit rows
 * @param {string[]} [expected]
 * @returns {{ covered:string[], missing:string[], complete:boolean, byAction:object }}
 */
export function activityCoverage(rows = [], expected = EXPECTED_DEV_ACTIONS) {
  const byAction = {};
  for (const row of arr(rows)) {
    const a = row?.action;
    if (!a) continue;
    byAction[a] = (byAction[a] || 0) + 1;
  }
  const covered = expected.filter((a) => byAction[a] > 0);
  const missing = expected.filter((a) => !byAction[a]);
  return { covered, missing, complete: missing.length === 0, byAction };
}

/** Group activity items by UTC day for a timeline view. */
export function groupActivityByDay(activities = []) {
  const groups = [];
  const index = new Map();
  for (const item of arr(activities)) {
    const day = String(item.at || "").slice(0, 10) || "unknown";
    if (!index.has(day)) {
      index.set(day, { day, items: [] });
      groups.push(index.get(day));
    }
    index.get(day).items.push(item);
  }
  return groups.sort((a, b) => b.day.localeCompare(a.day));
}
