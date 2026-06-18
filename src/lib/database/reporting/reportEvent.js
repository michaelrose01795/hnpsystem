// file location: src/lib/database/reporting/reportEvent.js
//
// The event spine data layer (report_event, Phase-2 §3). Append-only, immutable.
//
// Two responsibilities:
//   1. insertReportEvent / queryReportEvents — raw read/write of the spine.
//   2. emitReportEvent — the FAN-OUT helper (Phase-2 §11.4 / ADR-18): one call
//      from an operational write path writes the report_event AND (optionally)
//      a *_status_history row AND (for audit-required events) an audit_log row.
//
// Emit is NON-BLOCKING and best-effort: it must never throw into or slow down the
// operational transaction (ADR-18 / Risk R10), mirroring writeAuditLog's
// swallow-on-failure. A reconciliation monitor (Phase-2 §13.3) catches gaps.
//
// Emitting from operational paths is gated by the `reporting_emit_enabled` flag.
// Until a later phase wires emits into write paths the helper is an inert no-op,
// so importing it is safe everywhere.

import { supabase, supabaseService } from "@/lib/database/supabaseClient";
import { reportingTableExists } from "./tableAvailability";
import { writeStatusHistory } from "./statusHistory";
import { writeAuditLog } from "@/lib/audit/auditLog";
import { getReportingFlag } from "@/lib/reporting/config/flags";
import {
  getEvent,
  isEventAuditRequired,
  validateEvent,
} from "@/lib/reporting/config/eventCatalogue";
import { isDepartmentCode } from "@/lib/reporting/config/departments";

const TABLE = "report_event";

const nowIso = () => new Date().toISOString();

// Build a deterministic event_uuid per (entity, event_name, occurred_at) so
// re-emits dedupe (Phase-2 §3.2). Uses a stable string hash → uuid-shaped value.
function deterministicUuid(parts) {
  const str = parts.filter((p) => p != null).join("|");
  // FNV-1a 32-bit, expanded into a uuid-shaped string. Not cryptographic — just
  // a stable dedupe key; the DB unique index enforces idempotency.
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const hex = h.toString(16).padStart(8, "0");
  let h2 = h ^ 0x9e3779b9;
  for (let i = str.length - 1; i >= 0; i -= 1) {
    h2 ^= str.charCodeAt(i);
    h2 = Math.imul(h2, 0x01000193) >>> 0;
  }
  const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `${hex}-${hex2.slice(0, 4)}-5${hex2.slice(4, 7)}-8${hex.slice(0, 3)}-${hex}${hex2.slice(0, 4)}`;
}

// Normalise an event input into a report_event row. Pulls catalogue defaults
// (category, owner department, related departments) when the caller omits them.
function buildEventRow(input = {}) {
  const entry = getEvent(input.eventName) || {};
  const occurredAt = input.occurredAt || nowIso();
  const ownerDepartment =
    input.ownerDepartment && isDepartmentCode(input.ownerDepartment)
      ? input.ownerDepartment
      : entry.ownerDepartment || "system";
  return {
    event_uuid:
      input.eventUuid ||
      deterministicUuid([input.entityType, input.entityId, input.eventName, occurredAt]),
    occurred_at: occurredAt,
    recorded_at: nowIso(),
    event_name: input.eventName,
    event_category: input.eventCategory || entry.category || null,
    domain: input.domain || entry.domain || null,
    entity_type: input.entityType || null,
    entity_id: input.entityId == null ? null : String(input.entityId),
    parent_entity_type: input.parentEntityType || null,
    parent_entity_id: input.parentEntityId == null ? null : String(input.parentEntityId ?? ""),
    from_state: input.fromState ?? null,
    to_state: input.toState ?? null,
    actor_kind: input.actorKind || (input.actorUserId ? "user" : "system"),
    actor_user_id: Number.isFinite(Number(input.actorUserId)) ? Number(input.actorUserId) : null,
    actor_auth_uuid: input.actorAuthUuid || null,
    actor_role: input.actorRole || null,
    owner_department: ownerDepartment,
    related_departments: Array.isArray(input.relatedDepartments)
      ? input.relatedDepartments
      : entry.related || [],
    amount_gbp: input.amountGbp ?? null,
    quantity: input.quantity ?? null,
    duration_seconds: input.durationSeconds ?? null,
    payload: input.payload && typeof input.payload === "object" ? input.payload : null,
    source: input.source || "emit",
    formula_context: input.formulaContext || null,
  };
}

// Raw insert of a report_event row. Best-effort; returns { ok }.
export async function insertReportEvent(input) {
  if (!supabaseService) return { ok: false, skipped: "no service client" };
  if (!(await reportingTableExists(TABLE))) return { ok: false, skipped: "table not applied" };
  try {
    const row = buildEventRow(input);
    const { error } = await supabaseService
      .from(TABLE)
      .upsert([row], { onConflict: "event_uuid", ignoreDuplicates: true });
    if (error) {
      console.warn("[reporting] insertReportEvent failed:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, eventUuid: row.event_uuid };
  } catch (err) {
    console.warn("[reporting] insertReportEvent threw:", err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

// Read events for a normalised window. `filter` = { from, to, domain, ownerDepartment,
// eventName, entityType, entityId, actorUserId, limit }. Returns [] on any error
// or when the spine is absent (graceful degradation).
export async function queryReportEvents(filter = {}) {
  if (!(await reportingTableExists(TABLE))) return [];
  try {
    let q = supabase.from(TABLE).select("*");
    if (filter.from) q = q.gte("occurred_at", filter.from);
    if (filter.to) q = q.lte("occurred_at", filter.to);
    if (filter.domain) q = q.eq("domain", filter.domain);
    if (filter.ownerDepartment) q = q.eq("owner_department", filter.ownerDepartment);
    if (filter.eventName) q = q.eq("event_name", filter.eventName);
    if (filter.entityType) q = q.eq("entity_type", filter.entityType);
    if (filter.entityId != null) q = q.eq("entity_id", String(filter.entityId));
    if (filter.actorUserId != null) q = q.eq("actor_user_id", Number(filter.actorUserId));
    q = q.order("occurred_at", { ascending: true }).limit(filter.limit || 5000);
    const { data, error } = await q;
    if (error) {
      console.warn("[reporting] queryReportEvents failed:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn("[reporting] queryReportEvents threw:", err?.message || err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// emitReportEvent — the fan-out (Phase-2 §11.4 / ADR-18).
//
//   emitReportEvent({
//     event:   { eventName, entityType, entityId, fromState, toState, actorUserId, actorRole, ownerDepartment, amountGbp, payload },
//     history: { entityKey, entityId, fromStatus, toStatus, changedBy, reason, department, meta },   // optional
//     audit:   { action, entityType, entityId, diff, reason },                                       // optional override
//   })
//
// Returns a result object but NEVER throws — the caller writes one line and the
// operational transaction is unaffected by reporting failures.
// ---------------------------------------------------------------------------
export async function emitReportEvent({ event, history = null, audit = null } = {}) {
  // Inert until emits are switched on for a write path (flag-gated rollout).
  if (!getReportingFlag("reporting_emit_enabled")) {
    return { ok: false, skipped: "emit disabled" };
  }
  if (!event?.eventName) {
    return { ok: false, skipped: "no eventName" };
  }

  const result = { event: null, history: null, audit: null };

  try {
    // Validate against the catalogue (Phase-2 §13.1). Invalid events are logged
    // but still attempted (drift detection), never silently dropped.
    const validation = validateEvent({
      eventName: event.eventName,
      eventCategory: event.eventCategory,
      ownerDepartment: event.ownerDepartment,
    });
    if (!validation.ok) {
      console.warn("[reporting] emit validation:", validation.errors.join("; "));
    }

    // 1. status history (authoritative lifecycle), if requested.
    if (history && history.entityKey) {
      result.history = await writeStatusHistory(history.entityKey, history);
    }

    // 2. report_event (analytics fact).
    result.event = await insertReportEvent(event);

    // 3. audit_log (tamper-evident) for audit-required events.
    const needsAudit = audit || isEventAuditRequired(event.eventName);
    if (needsAudit) {
      await writeAuditLog({
        action: (audit?.action || event.eventName).toString().toLowerCase(),
        actorUserId: Number.isFinite(Number(event.actorUserId)) ? Number(event.actorUserId) : null,
        actorRole: event.actorRole || null,
        entityType: audit?.entityType || event.entityType || null,
        entityId: audit?.entityId ?? event.entityId ?? null,
        diff: audit?.diff || event.payload || null,
        reason: audit?.reason || event.reason || null,
      });
      result.audit = { ok: true };
    }

    return { ok: true, ...result };
  } catch (err) {
    // Swallow — emit is non-blocking (ADR-18 / R10).
    console.warn("[reporting] emitReportEvent threw (swallowed):", err?.message || err);
    return { ok: false, error: err?.message || String(err), ...result };
  }
}

export default emitReportEvent;
