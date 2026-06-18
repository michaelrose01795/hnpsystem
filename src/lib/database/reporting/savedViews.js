// file location: src/lib/database/reporting/savedViews.js
//
// Saved views + per-user preferences data layer (Phase-1 §10). A saved view is a
// report/dashboard reference + its normalised filter + layout, recallable. All
// operations are scoped to the canonical owner user id; cross-user reads are
// limited to `scope='shared'` rows. Graceful degradation when tables are absent.

import { supabase, supabaseService } from "@/lib/database/supabaseClient";
import { reportingTableExists } from "./tableAvailability";

const VIEWS = "report_saved_view";
const PREFS = "report_user_preferences";

export async function listSavedViews(ownerUserId, { includeShared = true } = {}) {
  if (!(await reportingTableExists(VIEWS))) return [];
  try {
    let q = supabase.from(VIEWS).select("*");
    if (includeShared) {
      q = q.or(`owner_user_id.eq.${Number(ownerUserId)},scope.eq.shared`);
    } else {
      q = q.eq("owner_user_id", Number(ownerUserId));
    }
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

export async function createSavedView({ ownerUserId, name, scope = "personal", targetRef, filter, layout }) {
  if (!supabaseService) return { ok: false, skipped: "no service client" };
  if (!(await reportingTableExists(VIEWS))) return { ok: false, skipped: "table not applied" };
  try {
    const { data, error } = await supabaseService
      .from(VIEWS)
      .insert([
        {
          owner_user_id: Number(ownerUserId),
          name,
          scope: scope === "shared" ? "shared" : "personal",
          target_ref: targetRef || null,
          filter: filter || null,
          layout: layout || null,
          updated_at: new Date().toISOString(),
        },
      ])
      .select("*")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, view: data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function updateSavedView(viewId, ownerUserId, patch = {}) {
  if (!supabaseService) return { ok: false, skipped: "no service client" };
  if (!(await reportingTableExists(VIEWS))) return { ok: false, skipped: "table not applied" };
  const update = { updated_at: new Date().toISOString() };
  if (patch.name != null) update.name = patch.name;
  if (patch.scope != null) update.scope = patch.scope === "shared" ? "shared" : "personal";
  if (patch.targetRef != null) update.target_ref = patch.targetRef;
  if (patch.filter !== undefined) update.filter = patch.filter;
  if (patch.layout !== undefined) update.layout = patch.layout;
  try {
    const { error } = await supabaseService
      .from(VIEWS)
      .update(update)
      .eq("view_id", Number(viewId))
      .eq("owner_user_id", Number(ownerUserId)); // owner-scoped: cannot edit others'
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function deleteSavedView(viewId, ownerUserId) {
  if (!supabaseService) return { ok: false, skipped: "no service client" };
  if (!(await reportingTableExists(VIEWS))) return { ok: false, skipped: "table not applied" };
  try {
    const { error } = await supabaseService
      .from(VIEWS)
      .delete()
      .eq("view_id", Number(viewId))
      .eq("owner_user_id", Number(ownerUserId));
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function getUserPreferences(userId) {
  if (!(await reportingTableExists(PREFS))) return null;
  try {
    const { data, error } = await supabase
      .from(PREFS)
      .select("*")
      .eq("user_id", Number(userId))
      .maybeSingle();
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}

export async function putUserPreferences(userId, prefs = {}) {
  if (!supabaseService) return { ok: false, skipped: "no service client" };
  if (!(await reportingTableExists(PREFS))) return { ok: false, skipped: "table not applied" };
  try {
    const { error } = await supabaseService.from(PREFS).upsert(
      [
        {
          user_id: Number(userId),
          default_department: prefs.defaultDepartment ?? null,
          default_range: prefs.defaultRange ?? null,
          default_dashboard: prefs.defaultDashboard ?? null,
          density: prefs.density ?? null,
          units: prefs.units ?? null,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "user_id" }
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export default listSavedViews;
