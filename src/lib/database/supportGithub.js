// file location: src/lib/database/supportGithub.js
//
// Phase 10 — data layer for two-way GitHub linkage (support_github_links). Same
// privacy model as the rest of support: RLS on with no policies, so all access
// is via the service-role client behind dev-gated routes. Degrades gracefully
// when the migration has not been applied (returns empty / skip).

import { supabaseService } from "@/lib/database/supabaseClient";
import { supportTableExists } from "@/lib/database/supportTableProbe";

const TABLE = "support_github_links";

/** All GitHub links for a report (issues / PRs / commits), newest first. */
export async function listGithubLinks(reportId) {
  if (!supabaseService || !(await supportTableExists(TABLE))) return { ok: true, data: [] };
  try {
    const { data, error } = await supabaseService
      .from(TABLE)
      .select("*")
      .eq("report_id", reportId)
      .order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Upsert a link (report_id + kind + url is unique). `link` = normalised artifact
 * { kind, number, sha, url, title, state } + repo + created_by.
 */
export async function saveGithubLink(reportId, link = {}, { createdBy = null } = {}) {
  if (!supabaseService) return { ok: false, error: "Service client not configured." };
  if (!(await supportTableExists(TABLE))) return { ok: false, error: "GitHub links table not applied." };
  if (!link.url || !link.repo) return { ok: false, error: "A GitHub link requires a repo and url." };
  const row = {
    report_id: reportId,
    kind: link.kind || "issue",
    repo: link.repo,
    number: link.number ?? null,
    sha: link.sha ?? null,
    url: link.url,
    title: link.title ?? null,
    state: link.state ?? null,
    meta: link.meta && typeof link.meta === "object" ? link.meta : {},
    created_by: createdBy,
    updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  };
  try {
    const { data, error } = await supabaseService
      .from(TABLE)
      .upsert([row], { onConflict: "report_id,kind,url" })
      .select("*")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/** Refresh a stored link's live GitHub state (title/state) after a sync call. */
export async function updateGithubLinkState(id, { title, state, meta } = {}) {
  if (!supabaseService || !(await supportTableExists(TABLE))) return { ok: false, error: "GitHub links table not applied." };
  const patch = { updated_at: new Date().toISOString(), synced_at: new Date().toISOString() };
  if (title !== undefined) patch.title = title;
  if (state !== undefined) patch.state = state;
  if (meta !== undefined) patch.meta = meta;
  try {
    const { data, error } = await supabaseService.from(TABLE).update(patch).eq("id", id).select("*").maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function deleteGithubLink(id) {
  if (!supabaseService || !(await supportTableExists(TABLE))) return { ok: false, error: "GitHub links table not applied." };
  try {
    const { error } = await supabaseService.from(TABLE).delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/** All links across a set of reports (for the intelligence / list overlay). */
export async function listGithubLinksForReports(reportIds = []) {
  if (!supabaseService || !(await supportTableExists(TABLE)) || !reportIds.length) return { ok: true, data: [] };
  try {
    const { data, error } = await supabaseService.from(TABLE).select("*").in("report_id", reportIds);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}
