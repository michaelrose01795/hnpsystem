// file location: src/lib/database/supportSavedViews.js
//
// Phase 8 — data layer for server-synced saved views + developer preferences
// (support_saved_views / support_user_preferences). Same privacy model as the
// rest of the support feature: RLS is on with NO permissive policies, so BOTH
// reads and writes use the service-role client (the anon key can't touch these
// tables). Every mutation is owner-scoped so a caller can never edit or delete
// another user's rows. Degrades gracefully (empty result / skipped) when the
// migration has not been applied yet.

import { supabaseService } from "@/lib/database/supabaseClient";
import {
  validateSavedViewInput,
  normalisePreferences,
} from "@/lib/support/savedViewValidation";

const VIEWS = "support_saved_views";
const PREFS = "support_user_preferences";

// Memoised existence probes (service-role, since anon can't see these tables).
const probes = new Map();
async function tableExists(table) {
  if (!supabaseService) return false;
  if (!probes.has(table)) {
    probes.set(
      table,
      (async () => {
        try {
          const { error } = await supabaseService.from(table).select("*", { head: true, count: "exact" }).limit(1);
          if (error) {
            const msg = `${error.code || ""} ${error.message || ""}`.toLowerCase();
            if (msg.includes("does not exist") || error.code === "42p01" || error.code === "pgrst205") return false;
            console.warn(`[support] table probe "${table}" inconclusive:`, error.message || error);
            return false;
          }
          return true;
        } catch (err) {
          console.warn(`[support] table probe "${table}" threw:`, err?.message || err);
          return false;
        }
      })()
    );
  }
  return probes.get(table);
}

// Test/admin helper to force a re-probe after applying the migration.
export function clearSupportTableCache() {
  probes.clear();
}

// Ownership key for the current session. The `dev` role is synthetic (no users
// row) so its key is the literal session id ('dev-platform'); a real numeric
// user carrying the dev role keys by their stringified id. Falls back to the
// synthetic key so a view always has a stable, non-empty owner.
export function devOwnerKey(session) {
  const id = session?.user?.id;
  return id != null && String(id).trim() ? String(id).trim() : "dev-platform";
}

// ---------------------------------------------------------------------------
// Saved views
// ---------------------------------------------------------------------------

// List a user's personal views plus every shared view for the surface.
export async function listSupportSavedViews(ownerKey, { surface = "support" } = {}) {
  if (!supabaseService) return { ok: true, data: [] };
  if (!(await tableExists(VIEWS))) return { ok: true, data: [] };
  try {
    const { data, error } = await supabaseService
      .from(VIEWS)
      .select("*")
      .eq("surface", surface)
      .or(`owner_key.eq.${ownerKey},scope.eq.shared`)
      .order("updated_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function createSupportSavedView(ownerKey, input = {}) {
  if (!supabaseService) return { ok: false, error: "Service client not configured." };
  if (!(await tableExists(VIEWS))) return { ok: false, error: "Saved views table not applied." };
  const valid = validateSavedViewInput(input, { requireName: true });
  if (!valid.ok) return valid;
  try {
    const { data, error } = await supabaseService
      .from(VIEWS)
      .insert([
        {
          owner_key: ownerKey,
          name: valid.value.name,
          scope: valid.value.scope,
          surface: valid.value.surface,
          filters: valid.value.filters,
          updated_at: new Date().toISOString(),
        },
      ])
      .select("*")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function updateSupportSavedView(viewId, ownerKey, patch = {}) {
  if (!supabaseService) return { ok: false, error: "Service client not configured." };
  if (!(await tableExists(VIEWS))) return { ok: false, error: "Saved views table not applied." };
  const valid = validateSavedViewInput(patch, { requireName: false });
  if (!valid.ok) return valid;
  const update = { updated_at: new Date().toISOString() };
  if (patch.name != null && valid.value.name) update.name = valid.value.name;
  if (patch.scope != null) update.scope = valid.value.scope;
  if (patch.surface != null) update.surface = valid.value.surface;
  if (patch.filters !== undefined) update.filters = valid.value.filters;
  try {
    const { data, error } = await supabaseService
      .from(VIEWS)
      .update(update)
      .eq("id", viewId)
      .eq("owner_key", ownerKey) // owner-scoped: cannot edit others' (shared views editable only by owner)
      .select("*")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "View not found or not owned by you." };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function deleteSupportSavedView(viewId, ownerKey) {
  if (!supabaseService) return { ok: false, error: "Service client not configured." };
  if (!(await tableExists(VIEWS))) return { ok: false, error: "Saved views table not applied." };
  try {
    const { data, error } = await supabaseService
      .from(VIEWS)
      .delete()
      .eq("id", viewId)
      .eq("owner_key", ownerKey)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "View not found or not owned by you." };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// ---------------------------------------------------------------------------
// Preferences (one row per user; upsert)
// ---------------------------------------------------------------------------

export async function getSupportUserPreferences(ownerKey) {
  if (!supabaseService) return { ok: true, data: normalisePreferences({}) };
  if (!(await tableExists(PREFS))) return { ok: true, data: normalisePreferences({}) };
  try {
    const { data, error } = await supabaseService
      .from(PREFS)
      .select("preferences")
      .eq("owner_key", ownerKey)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: normalisePreferences(data?.preferences || {}) };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function putSupportUserPreferences(ownerKey, prefs = {}) {
  if (!supabaseService) return { ok: false, error: "Service client not configured." };
  if (!(await tableExists(PREFS))) return { ok: false, error: "Preferences table not applied." };
  const normalised = normalisePreferences(prefs);
  try {
    const { error } = await supabaseService
      .from(PREFS)
      .upsert([{ owner_key: ownerKey, preferences: normalised, updated_at: new Date().toISOString() }], {
        onConflict: "owner_key",
      });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: normalised };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}
