// file location: src/lib/database/supportActivity.js
//
// Phase 10 — read side of the developer activity feed. Reads the shared,
// hash-chained audit_log (already redacted at write time by writeAuditLog) via
// the service role, scoped to Developer Platform + support actions so the feed
// shows engineering activity, not the whole app's audit trail. Read-only; the
// pure shaping/coverage lives in src/lib/dev-platform/activityAudit.js.

import { supabaseService } from "@/lib/database/supabaseClient";

// Entity types written by the platform's audit wrappers.
const PLATFORM_ENTITY_TYPES = ["dev_platform", "support_report"];

const COLUMNS = "id, occurred_at, actor_user_id, actor_role, action, entity_type, entity_id, diff";

/**
 * Recent Developer Platform activity rows (newest first).
 * @param {{ limit?: number, entityType?: string, actorUserId?: number }} [opts]
 */
export async function listPlatformActivity({ limit = 100, entityType, actorUserId } = {}) {
  if (!supabaseService) return { ok: true, data: [] };
  try {
    let q = supabaseService
      .from("audit_log")
      .select(COLUMNS)
      .order("occurred_at", { ascending: false })
      .limit(Math.min(Number.isInteger(limit) ? limit : 100, 500));
    if (entityType) q = q.eq("entity_type", entityType);
    else q = q.in("entity_type", PLATFORM_ENTITY_TYPES);
    if (Number.isInteger(actorUserId)) q = q.eq("actor_user_id", actorUserId);
    const { data, error } = await q;
    if (error) {
      // audit_log missing / inaccessible → empty feed rather than a hard error.
      const msg = `${error.code || ""} ${error.message || ""}`.toLowerCase();
      if (msg.includes("does not exist") || error.code === "42p01" || error.code === "pgrst205") return { ok: true, data: [] };
      return { ok: false, error: error.message };
    }
    return { ok: true, data: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}
