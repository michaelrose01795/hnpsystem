// file location: src/lib/database/supportReleases.js
//
// Phase 10 — data layer for release approval / deployment-readiness records
// (support_release_approvals). One canonical row per release_key (upsert). Same
// privacy model; service-role behind dev-gated routes. Degrades gracefully.

import { supabaseService } from "@/lib/database/supabaseClient";
import { supportTableExists } from "@/lib/database/supportTableProbe";

const TABLE = "support_release_approvals";

export async function listReleaseApprovals() {
  if (!supabaseService || !(await supportTableExists(TABLE))) return { ok: true, data: [] };
  try {
    const { data, error } = await supabaseService.from(TABLE).select("*").order("updated_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

const STATUSES = new Set(["pending", "approved", "blocked"]);

/**
 * Record (or update) an approval decision for a release.
 * @param {object} input { releaseKey, appVersion, commitSha, status, readinessScore, notes, approverKey }
 */
export async function upsertReleaseApproval(input = {}) {
  if (!supabaseService) return { ok: false, error: "Service client not configured." };
  if (!(await supportTableExists(TABLE))) return { ok: false, error: "Release approvals table not applied." };
  if (!input.releaseKey) return { ok: false, error: "A release key is required." };
  const status = STATUSES.has(input.status) ? input.status : "pending";
  const row = {
    release_key: String(input.releaseKey),
    app_version: input.appVersion ?? null,
    commit_sha: input.commitSha ?? null,
    status,
    readiness_score: Number.isFinite(input.readinessScore) ? Math.round(input.readinessScore) : null,
    approver_key: input.approverKey ?? null,
    notes: input.notes ?? null,
    meta: input.meta && typeof input.meta === "object" ? input.meta : {},
    updated_at: new Date().toISOString(),
  };
  try {
    const { data, error } = await supabaseService
      .from(TABLE)
      .upsert([row], { onConflict: "release_key" })
      .select("*")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}
