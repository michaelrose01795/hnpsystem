// file location: src/lib/database/reporting/dimActor.js
//
// PRIORITY 2 — Actor attribution support (canonical-id bridge, Phase-2 §8.4, D4).
//
// The system has two user identities: int `users.user_id` (most tables) and uuid
// `auth.users.id` (parts_catalog, parts_job_items.allocated_by,
// parts_stock_movements.performed_by). Reporting must resolve BOTH to one
// canonical id before per-user attribution is trustworthy (Risk R2).
//
// This helper resolves either id to the canonical user id via `dim_actor`. When
// `dim_actor` is not yet populated it degrades to the int users.user_id (the
// canonical space today) and looks up auth uuids against `users.auth_uuid` /
// `users.auth_id` where present. The resolver mirrors the dual-write/fallback
// convention used in src/lib/canonical/fields.js.

import { supabase } from "@/lib/database/supabaseClient";
import { reportingTableExists } from "./tableAvailability";

const TABLE = "dim_actor";

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
};

const isUuid = (v) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// Resolve a canonical actor record from any available identifier.
// Returns { canonicalUserId, usersUserId, authUuid, role, department } or null.
export async function resolveCanonicalActor({ userId = null, authUuid = null } = {}) {
  const intId = toInt(userId);
  const uuid = isUuid(authUuid) ? authUuid : isUuid(userId) ? userId : null;

  const haveDim = await reportingTableExists(TABLE);
  if (haveDim) {
    let query = supabase.from(TABLE).select("*").limit(1);
    if (intId) query = query.eq("users_user_id", intId);
    else if (uuid) query = query.eq("auth_uuid", uuid);
    else return null;
    const { data, error } = await query.maybeSingle();
    if (!error && data) {
      return {
        canonicalUserId: data.canonical_user_id,
        usersUserId: data.users_user_id,
        authUuid: data.auth_uuid,
        role: data.current_role_name,
        department: data.current_department,
      };
    }
  }

  // --- Fallback (dim_actor absent or no row): the int users.user_id IS the
  // canonical space today. Resolve a uuid against the users table if possible.
  if (intId) {
    return { canonicalUserId: intId, usersUserId: intId, authUuid: uuid, role: null, department: null };
  }
  if (uuid) {
    // Best-effort: try to find the int user_id bridged to this auth uuid.
    try {
      const { data } = await supabase
        .from("users")
        .select("user_id, role, department")
        .or(`auth_uuid.eq.${uuid},auth_id.eq.${uuid}`)
        .limit(1)
        .maybeSingle();
      if (data?.user_id) {
        return {
          canonicalUserId: data.user_id,
          usersUserId: data.user_id,
          authUuid: uuid,
          role: data.role || null,
          department: data.department || null,
        };
      }
    } catch {
      /* users may not carry an auth uuid column — fall through */
    }
    // Unresolved uuid: keep it, but no canonical int id (per-user KPIs blocked, R2).
    return { canonicalUserId: null, usersUserId: null, authUuid: uuid, role: null, department: null };
  }
  return null;
}

export default resolveCanonicalActor;
