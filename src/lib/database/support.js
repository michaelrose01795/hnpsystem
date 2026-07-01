// file location: src/lib/database/support.js
//
// Database helper for the Help & Diagnostics ("support") feature. ALL Supabase
// access for support_reports lives here — never in pages/components/API bodies.
//
// The support_reports table is RLS-locked with no permissive policies, so these
// helpers use the service-role client (RLS-exempt). They are server-only.
//
// Privacy: createSupportReport re-runs the shared sanitiser on the diagnostics
// blob (defence in depth — the client already scrubbed once) and rejects any
// blob over the size cap before it touches the database.

import { supabaseService, supabase as supabaseFallback } from "@/lib/database/supabaseClient";
import { sanitiseDiagnostics, isWithinSizeCap } from "@/lib/support/sanitise";

// Prefer service-role (server-side, RLS-exempt). Fall back to the default
// client for stub/CI environments where the service key is absent.
function getClient() {
  return supabaseService || supabaseFallback;
}

// Columns returned to admins. `diagnostics` is included only on detail reads.
const LIST_COLUMNS =
  "id, title, description, category, screenshot_path, screenshot_paths, reporter_user_id, reporter_username, reporter_roles, status, severity, assigned_to, route, section_key, source_file, source_line, app_version, commit_sha, commit_ref, build_id, created_at, updated_at";
const DETAIL_COLUMNS = `${LIST_COLUMNS}, diagnostics`;

const CATEGORIES = new Set(["bug", "question", "suggestion", "visual", "data", "other"]);

/**
 * Create a support report. Sanitises diagnostics server-side and enforces the
 * size cap before insert.
 *
 * @param {{
 *   title?: string,
 *   description: string,
 *   category?: string,
 *   screenshotPath?: string,
 *   screenshotPaths?: string[],
 *   reporterUserId?: number|null,
 *   reporterUsername?: string,
 *   reporterRoles?: string[],
 *   route?: string,
 *   sectionKey?: string,
 *   sourceFile?: string,
 *   sourceLine?: number|null,
 *   appVersion?: string,
 *   commitSha?: string,
 *   commitRef?: string,
 *   buildId?: string,
 *   diagnostics?: object,
 * }} input
 * @returns {Promise<{ success: boolean, data?: object, error?: { message: string } }>}
 */
export async function createSupportReport(input) {
  try {
    const description = String(input?.description || "").trim();
    if (!description) {
      throw new Error("Description is required");
    }

    const category = CATEGORIES.has(input?.category) ? input.category : "bug";

    // Defence in depth: re-scrub server-side and cap the size. The client is
    // untrusted even though it already sanitised once.
    const diagnostics = sanitiseDiagnostics(input?.diagnostics || {});
    if (!isWithinSizeCap(diagnostics)) {
      throw new Error("Diagnostics payload exceeds the size limit");
    }

    const reporterUserId =
      Number.isInteger(input?.reporterUserId) ? input.reporterUserId : null;
    const reporterRoles = Array.isArray(input?.reporterRoles)
      ? input.reporterRoles.map((r) => String(r)).slice(0, 50)
      : null;

    const screenshotPaths = Array.isArray(input?.screenshotPaths)
      ? input.screenshotPaths.filter((p) => typeof p === "string" && p).map((p) => p.slice(0, 500))
      : [];

    const row = {
      title: input?.title ? String(input.title).slice(0, 300) : null,
      description,
      category,
      // Keep the legacy single column populated with the first image for
      // backward compatibility; screenshot_paths carries the full ordered list.
      screenshot_path: input?.screenshotPath || screenshotPaths[0] || null,
      screenshot_paths: screenshotPaths.length ? screenshotPaths : null,
      reporter_user_id: reporterUserId,
      reporter_username: input?.reporterUsername
        ? String(input.reporterUsername).slice(0, 200)
        : null,
      reporter_roles: reporterRoles,
      route: input?.route ? String(input.route).slice(0, 500) : null,
      section_key: input?.sectionKey ? String(input.sectionKey).slice(0, 300) : null,
      source_file: input?.sourceFile ? String(input.sourceFile).slice(0, 500) : null,
      source_line: Number.isInteger(input?.sourceLine) ? input.sourceLine : null,
      app_version: input?.appVersion ? String(input.appVersion).slice(0, 50) : null,
      commit_sha: input?.commitSha ? String(input.commitSha).slice(0, 80) : null,
      commit_ref: input?.commitRef ? String(input.commitRef).slice(0, 200) : null,
      build_id: input?.buildId ? String(input.buildId).slice(0, 200) : null,
      diagnostics,
    };

    const { data, error } = await getClient()
      .from("support_reports")
      .insert([row])
      .select(DETAIL_COLUMNS)
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("[support] createSupportReport error:", error?.message || error);
    return { success: false, error: { message: error?.message || "Insert failed" } };
  }
}

/**
 * Attach a screenshot path to an existing report (used after upload).
 * @param {string} id
 * @param {string} screenshotPath
 * @returns {Promise<{ success: boolean, data?: object, error?: { message: string } }>}
 */
export async function setSupportReportScreenshot(id, screenshotPath) {
  try {
    const { data, error } = await getClient()
      .from("support_reports")
      .update({ screenshot_path: screenshotPath || null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(DETAIL_COLUMNS)
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("[support] setSupportReportScreenshot error:", error?.message || error);
    return { success: false, error: { message: error?.message || "Update failed" } };
  }
}

/**
 * Attach the full ordered list of screenshot paths to a report (used after the
 * uploads complete). Also keeps the legacy `screenshot_path` pointed at the first.
 * @param {string} id
 * @param {string[]} screenshotPaths
 * @returns {Promise<{ success: boolean, data?: object, error?: { message: string } }>}
 */
export async function setSupportReportScreenshots(id, screenshotPaths) {
  try {
    const paths = Array.isArray(screenshotPaths)
      ? screenshotPaths.filter((p) => typeof p === "string" && p).map((p) => p.slice(0, 500))
      : [];
    const { data, error } = await getClient()
      .from("support_reports")
      .update({
        screenshot_path: paths[0] || null,
        screenshot_paths: paths.length ? paths : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(DETAIL_COLUMNS)
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("[support] setSupportReportScreenshots error:", error?.message || error);
    return { success: false, error: { message: error?.message || "Update failed" } };
  }
}

/**
 * List reports for the admin viewer (no diagnostics blob — keep the list light).
 * @param {{ status?: string, category?: string, severity?: string, limit?: number, offset?: number }} [filters]
 * @returns {Promise<{ success: boolean, data: object[], count: number, error?: { message: string } }>}
 */
export async function listSupportReports(filters = {}) {
  try {
    const limit = Number.isInteger(filters.limit) ? Math.min(filters.limit, 200) : 50;
    const offset = Number.isInteger(filters.offset) ? filters.offset : 0;

    let query = getClient()
      .from("support_reports")
      .select(LIST_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.category) query = query.eq("category", filters.category);
    if (filters.severity) query = query.eq("severity", filters.severity);

    const { data, error, count } = await query;
    if (error) throw error;
    return { success: true, data: data || [], count: count || 0 };
  } catch (error) {
    console.error("[support] listSupportReports error:", error?.message || error);
    return { success: false, data: [], count: 0, error: { message: error?.message || "Query failed" } };
  }
}

/**
 * Fetch a single report including the diagnostics blob (admin detail view).
 * @param {string} id
 * @returns {Promise<{ success: boolean, data?: object, error?: { message: string } }>}
 */
export async function getSupportReport(id) {
  try {
    if (!id) throw new Error("Report id is required");
    const { data, error } = await getClient()
      .from("support_reports")
      .select(DETAIL_COLUMNS)
      .eq("id", id)
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("[support] getSupportReport error:", error?.message || error);
    return { success: false, error: { message: error?.message || "Query failed" } };
  }
}

const STATUSES = new Set(["new", "triaged", "in_progress", "resolved", "wont_fix", "duplicate"]);
const SEVERITIES = new Set(["unset", "low", "medium", "high", "critical"]);

/**
 * Triage update — status / severity / assignee only. Validates enum values.
 * @param {string} id
 * @param {{ status?: string, severity?: string, assignedTo?: number|null }} updates
 * @returns {Promise<{ success: boolean, data?: object, error?: { message: string } }>}
 */
export async function updateSupportReport(id, updates = {}) {
  try {
    if (!id) throw new Error("Report id is required");
    const patch = { updated_at: new Date().toISOString() };

    if (updates.status !== undefined) {
      if (!STATUSES.has(updates.status)) throw new Error(`Invalid status: ${updates.status}`);
      patch.status = updates.status;
    }
    if (updates.severity !== undefined) {
      if (!SEVERITIES.has(updates.severity)) throw new Error(`Invalid severity: ${updates.severity}`);
      patch.severity = updates.severity;
    }
    if (updates.assignedTo !== undefined) {
      patch.assigned_to = Number.isInteger(updates.assignedTo) ? updates.assignedTo : null;
    }

    const { data, error } = await getClient()
      .from("support_reports")
      .update(patch)
      .eq("id", id)
      .select(DETAIL_COLUMNS)
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("[support] updateSupportReport error:", error?.message || error);
    return { success: false, error: { message: error?.message || "Update failed" } };
  }
}
