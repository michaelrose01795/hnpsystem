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
import { buildTriagePatch, sanitiseSearch } from "@/lib/support/triageValidation";

// Re-export the pure triage patch builder so existing importers keep working.
export { buildTriagePatch };

// Prefer service-role (server-side, RLS-exempt). Fall back to the default
// client for stub/CI environments where the service key is absent.
function getClient() {
  return supabaseService || supabaseFallback;
}

// Columns returned to admins. `diagnostics` is included only on detail reads.
const LIST_COLUMNS =
  "id, title, description, category, screenshot_path, screenshot_paths, reporter_user_id, reporter_username, reporter_roles, status, severity, assigned_to, duplicate_of, route, section_key, source_file, source_line, app_version, commit_sha, commit_ref, build_id, created_at, updated_at";
const DETAIL_COLUMNS = `${LIST_COLUMNS}, diagnostics`;

// Lightweight investigation-derived JSON subfields surfaced on the LIST endpoint
// so the workspace can badge/sort/group without ever shipping the (heavy,
// RLS-locked) full diagnostics blob. These read only already-sanitised, dev-only
// derived values (never raw session/console content).
const LIST_INVESTIGATION_JSON = [
  "inv_priority:diagnostics->investigation->priority",
  "inv_severity:diagnostics->investigation->severity",
  "inv_confidence:diagnostics->investigation->reproducibleConfidence",
  "inv_regression:diagnostics->investigation->versionHistory->isRegression",
  "inv_first_version:diagnostics->investigation->versionHistory->firstSeenVersion",
  "inv_last_version:diagnostics->investigation->versionHistory->lastSeenVersion",
  "inv_drift:diagnostics->investigation->codeState->drift->drifted",
  "fingerprint:diagnostics->fingerprint",
].join(", ");
const LIST_COLUMNS_WITH_INVESTIGATION = `${LIST_COLUMNS}, ${LIST_INVESTIGATION_JSON}`;

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

const SORTABLE = new Set(["created_at", "updated_at"]);

/**
 * List reports for the developer Support Centre (no full diagnostics blob — keep
 * the list light; carries only the derived investigation JSON subfields for
 * badging/sorting/grouping). Supports free-text search, status/category/severity/
 * assignee filters, "unassigned", and DB-level ordering by created/updated.
 *
 * @param {{
 *   status?: string, category?: string, severity?: string,
 *   assignedTo?: number|null, unassigned?: boolean, q?: string,
 *   sortBy?: string, sortDir?: "asc"|"desc",
 *   limit?: number, offset?: number
 * }} [filters]
 * @returns {Promise<{ success: boolean, data: object[], count: number, error?: { message: string } }>}
 */
export async function listSupportReports(filters = {}) {
  try {
    const limit = Number.isInteger(filters.limit) ? Math.min(filters.limit, 200) : 50;
    const offset = Number.isInteger(filters.offset) ? filters.offset : 0;
    const sortBy = SORTABLE.has(filters.sortBy) ? filters.sortBy : "created_at";
    const ascending = filters.sortDir === "asc";

    let query = getClient()
      .from("support_reports")
      .select(LIST_COLUMNS_WITH_INVESTIGATION, { count: "exact" })
      .order(sortBy, { ascending })
      .range(offset, offset + limit - 1);

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.category) query = query.eq("category", filters.category);
    if (filters.severity) query = query.eq("severity", filters.severity);
    if (filters.unassigned) query = query.is("assigned_to", null);
    else if (Number.isInteger(filters.assignedTo)) query = query.eq("assigned_to", filters.assignedTo);

    const q = sanitiseSearch(filters.q);
    if (q) {
      query = query.or(
        [
          `title.ilike.%${q}%`,
          `description.ilike.%${q}%`,
          `route.ilike.%${q}%`,
          `section_key.ilike.%${q}%`,
          `reporter_username.ilike.%${q}%`,
        ].join(",")
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return { success: true, data: data || [], count: count || 0 };
  } catch (error) {
    console.error("[support] listSupportReports error:", error?.message || error);
    return { success: false, data: [], count: 0, error: { message: error?.message || "Query failed" } };
  }
}

/**
 * Aggregate counts for the workspace dashboard. Selects only light columns for a
 * bounded window and folds them in JS (Supabase JS has no GROUP BY). Never reads
 * the diagnostics blob.
 * @param {{ window?: number }} [opts]
 * @returns {Promise<{ success: boolean, stats?: object, error?: { message: string } }>}
 */
export async function getSupportReportStats({ window = 1000 } = {}) {
  try {
    const { data, error } = await getClient()
      .from("support_reports")
      .select(
        "status, severity, category, assigned_to, created_at, inv_regression:diagnostics->investigation->versionHistory->isRegression"
      )
      .order("created_at", { ascending: false })
      .limit(Math.min(Number.isInteger(window) ? window : 1000, 5000));
    if (error) throw error;
    const rows = data || [];
    const tally = (key) =>
      rows.reduce((acc, r) => {
        const k = r[key] || "unset";
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
    const OPEN = new Set(["new", "triaged", "in_progress"]);
    const dayMs = 24 * 60 * 60 * 1000;
    const since = (days) => {
      const cutoff = Date.now() - days * dayMs;
      return rows.filter((r) => Date.parse(r.created_at) >= cutoff).length;
    };
    return {
      success: true,
      stats: {
        total: rows.length,
        byStatus: tally("status"),
        bySeverity: tally("severity"),
        byCategory: tally("category"),
        open: rows.filter((r) => OPEN.has(r.status)).length,
        unassigned: rows.filter((r) => OPEN.has(r.status) && r.assigned_to == null).length,
        regressions: rows.filter((r) => r.inv_regression === true).length,
        last24h: since(1),
        last7d: since(7),
      },
    };
  } catch (error) {
    console.error("[support] getSupportReportStats error:", error?.message || error);
    return { success: false, error: { message: error?.message || "Query failed" } };
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

/**
 * Fetch lightweight fingerprints of recent reports for cross-report incident
 * clustering (the investigation engine's "similar previous incidents"). Selects
 * only the JSON `fingerprint` subfield — never the full diagnostics blob — so it
 * stays cheap and never widens the diagnostics exposure surface. Best-effort:
 * returns [] on any error so report creation is never blocked.
 *
 * Also selects the durable `app_version` / `commit_sha` columns (never the full
 * diagnostics blob) so the investigation engine can compute the first/last app
 * version an incident was seen in (Phase 5 — cross-release regression tracking).
 *
 * @param {number} [limit]
 * @returns {Promise<Array<{ id: string, route: string|null, createdAt: string, appVersion: string|null, commitSha: string|null, fingerprint: object }>>}
 */
export async function listRecentReportFingerprints(limit = 50) {
  try {
    const { data, error } = await getClient()
      .from("support_reports")
      .select("id, route, created_at, app_version, commit_sha, fingerprint:diagnostics->fingerprint")
      .order("created_at", { ascending: false })
      .limit(Math.min(Number.isInteger(limit) ? limit : 50, 200));
    if (error) throw error;
    return (data || [])
      .filter((r) => r.fingerprint && typeof r.fingerprint === "object")
      .map((r) => ({
        id: r.id,
        route: r.route,
        createdAt: r.created_at,
        appVersion: r.app_version || null,
        commitSha: r.commit_sha || null,
        fingerprint: r.fingerprint,
      }));
  } catch (error) {
    console.error("[support] listRecentReportFingerprints error:", error?.message || error);
    return [];
  }
}

/**
 * Triage update — status / severity / assignee / duplicate-of. Validates enums.
 * @param {string} id
 * @param {{ status?: string, severity?: string, assignedTo?: number|null, duplicateOf?: string|null }} updates
 * @returns {Promise<{ success: boolean, data?: object, error?: { message: string } }>}
 */
export async function updateSupportReport(id, updates = {}) {
  try {
    if (!id) throw new Error("Report id is required");
    const patch = buildTriagePatch(updates);
    if (Object.keys(patch).length === 0) throw new Error("No valid fields to update");
    // A report cannot be its own duplicate.
    if (patch.duplicate_of === id) throw new Error("A report cannot duplicate itself");
    patch.updated_at = new Date().toISOString();

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

// ---------------------------------------------------------------------------
// Comments (developer notes / internal triage thread) — Phase 6.
// ---------------------------------------------------------------------------
const MAX_COMMENT = 5000;

/**
 * List the comment thread for a report (oldest first).
 * @param {string} reportId
 * @returns {Promise<{ success: boolean, data: object[], error?: { message: string } }>}
 */
export async function listSupportReportComments(reportId) {
  try {
    if (!reportId) throw new Error("Report id is required");
    const { data, error } = await getClient()
      .from("support_report_comments")
      .select("id, report_id, author_id, author_username, body, created_at")
      .eq("report_id", reportId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    console.error("[support] listSupportReportComments error:", error?.message || error);
    return { success: false, data: [], error: { message: error?.message || "Query failed" } };
  }
}

/**
 * Add a developer note / comment to a report.
 * @param {{ reportId: string, body: string, authorId?: number|null, authorUsername?: string }} input
 * @returns {Promise<{ success: boolean, data?: object, error?: { message: string } }>}
 */
export async function addSupportReportComment({ reportId, body, authorId = null, authorUsername = null } = {}) {
  try {
    if (!reportId) throw new Error("Report id is required");
    const text = String(body || "").trim();
    if (!text) throw new Error("Comment body is required");
    const row = {
      report_id: reportId,
      author_id: Number.isInteger(authorId) ? authorId : null,
      author_username: authorUsername ? String(authorUsername).slice(0, 200) : null,
      body: text.slice(0, MAX_COMMENT),
    };
    const { data, error } = await getClient()
      .from("support_report_comments")
      .insert([row])
      .select("id, report_id, author_id, author_username, body, created_at")
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("[support] addSupportReportComment error:", error?.message || error);
    return { success: false, error: { message: error?.message || "Insert failed" } };
  }
}

/**
 * Read the append-only audit history for a single report (developer activity:
 * create / triage / bundle-view / comment). Reads the shared hash-chained
 * audit_log by entity — never the diagnostics blob. Best-effort.
 * @param {string} reportId
 * @param {number} [limit]
 * @returns {Promise<{ success: boolean, data: object[], error?: { message: string } }>}
 */
export async function listSupportReportAudit(reportId, limit = 100) {
  try {
    if (!reportId) throw new Error("Report id is required");
    const { data, error } = await getClient()
      .from("audit_log")
      .select("id, occurred_at, actor_user_id, actor_role, action, diff")
      .eq("entity_type", "support_report")
      .eq("entity_id", String(reportId))
      .order("occurred_at", { ascending: false })
      .limit(Math.min(Number.isInteger(limit) ? limit : 100, 500));
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    console.error("[support] listSupportReportAudit error:", error?.message || error);
    return { success: false, data: [], error: { message: error?.message || "Query failed" } };
  }
}
