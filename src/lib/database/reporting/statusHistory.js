// file location: src/lib/database/reporting/statusHistory.js
//
// PRIORITY 3 support — Status normalisation at the capture point.
//
// Generic per-entity status-history writer/reader (Phase-2 §6). One table per
// entity (parts_job_items_status_history, vhc_item_status_history, ...) following
// the generic pattern, modelled on the existing job_status_history.
//
// All writes normalise from/to status through statusMaps.js so history is stored
// in canonical form (Phase-2 §13.2). App-emitted, no triggers.

import { supabase, supabaseService } from "@/lib/database/supabaseClient";
import { reportingTableExists } from "./tableAvailability";
import { getEntity } from "@/lib/reporting/config/entities";
import { normaliseStatus } from "@/lib/reporting/config/statusMaps";

// Write one status-history row for an entity. `entityKey` is a key from the
// entities registry (e.g. "part", "vhc_item", "invoice"). Best-effort; returns
// { ok }. Used by emitReportEvent's fan-out and directly by emit helpers.
export async function writeStatusHistory(entityKey, row = {}) {
  const entity = getEntity(entityKey);
  if (!entity) return { ok: false, skipped: `unknown entity "${entityKey}"` };
  const table = entity.historyTable;
  if (!supabaseService) return { ok: false, skipped: "no service client" };
  if (!(await reportingTableExists(table))) return { ok: false, skipped: "table not applied" };

  try {
    const record = {
      entity_id: row.entityId == null ? null : row.entityId,
      from_status: normaliseStatus(entity.statusModelKey || entityKey, row.fromStatus),
      to_status: normaliseStatus(entity.statusModelKey || entityKey, row.toStatus),
      changed_by: Number.isFinite(Number(row.changedBy)) ? Number(row.changedBy) : null,
      actor_kind: row.actorKind || (row.changedBy ? "user" : "system"),
      reason: row.reason || null,
      department: row.department || entity.department || null,
      changed_at: row.changedAt || new Date().toISOString(),
      meta: row.meta && typeof row.meta === "object" ? row.meta : null,
    };
    const { error } = await supabaseService.from(table).insert([record]);
    if (error) {
      console.warn(`[reporting] writeStatusHistory(${table}) failed:`, error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    console.warn(`[reporting] writeStatusHistory(${table}) threw:`, err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

// Read status-history rows for an entity instance (or a whole window). Returns []
// on any error / when the table is absent (graceful degradation).
export async function queryStatusHistory(entityKey, { entityId, from, to, limit = 5000 } = {}) {
  const entity = getEntity(entityKey);
  if (!entity) return [];
  const table = entity.historyTable;
  if (!(await reportingTableExists(table))) return [];
  try {
    let q = supabase.from(table).select("*");
    if (entityId != null) q = q.eq("entity_id", entityId);
    if (from) q = q.gte("changed_at", from);
    if (to) q = q.lte("changed_at", to);
    q = q.order("changed_at", { ascending: true }).limit(limit);
    const { data, error } = await q;
    if (error) {
      console.warn(`[reporting] queryStatusHistory(${table}) failed:`, error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn(`[reporting] queryStatusHistory(${table}) threw:`, err?.message || err);
    return [];
  }
}

export default writeStatusHistory;
