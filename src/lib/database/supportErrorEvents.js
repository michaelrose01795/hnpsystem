// file location: src/lib/database/supportErrorEvents.js
//
// Database helper for AUTOMATIC in-app error capture (`support_error_events`).
// All Supabase access for that table lives here — never in pages, components or
// API bodies (CLAUDE.md §5).
//
// This is the companion to src/lib/database/support.js:
//   • support_reports       — the human-filed triage queue ("Report a problem").
//   • support_error_events  — every error the in-app experience caught, logged
//                             automatically whether or not the user reported it.
// They correlate on `reference_code`, the short code shown on screen.
//
// The table is RLS-locked with no permissive policies, so these helpers use the
// service-role client (RLS-exempt) and are server-only.
//
// Privacy: the diagnostics-grade fields (`message`, `stack`, `context`, …) are
// re-scrubbed here with the shared sanitiser before insert — the client already
// scrubbed once, but the client is untrusted (defence in depth, matching
// createSupportReport).

import { supabaseService, supabase as supabaseFallback } from "@/lib/database/supabaseClient";
import { sanitiseDiagnostics, scrubString } from "@/lib/support/sanitise";
import { logFailure } from "@/lib/utils/logFailure";

// Prefer service-role (RLS-exempt). Fall back to the default client for
// stub/CI environments where the service key is absent — same pattern as
// src/lib/database/support.js.
function getClient() {
  return supabaseService || supabaseFallback;
}

// Mirrors the CHECK constraint in the schema.
const KINDS = new Set([
  "render",
  "runtime",
  "unhandled_rejection",
  "api",
  "data_load",
  "permission",
  "page",
  "console",
  "other",
]);

// Repeat collapsing: an identical fingerprint seen again inside this window
// increments `occurrences` on the existing row rather than inserting a new one,
// so a crash loop cannot flood the table.
export const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

// Column caps — generous enough to keep a stack useful, bounded enough that a
// runaway error cannot write megabytes per row.
const CAPS = {
  reference_code: 40,
  fingerprint: 80,
  boundary_level: 20,
  variant: 20,
  message: 2000,
  stack: 8000,
  component_stack: 8000,
  component: 200,
  route: 500,
  section_key: 300,
  username: 200,
  user_agent: 500,
  app_version: 50,
  commit_sha: 80,
  commit_ref: 200,
  build_id: 200,
  deployment_env: 50,
};

// Scrub (secrets/tokens/emails → [REDACTED]) then clamp to the column cap.
// scrubString is the same pass support_reports diagnostics go through.
const clean = (value, column) => {
  if (value == null || value === "") return null;
  const scrubbed = scrubString(String(value));
  return scrubbed ? scrubbed.slice(0, CAPS[column]) : null;
};

const toInt = (value) => (Number.isInteger(value) ? value : null);

/**
 * Build the insert row from an untrusted client payload plus server-resolved
 * identity. Pure and exported so the shape is testable without Supabase.
 *
 * Identity (`userId` / `username` / `roles`) MUST come from the session, never
 * from the request body — the caller resolves it and passes it in.
 *
 * @param {object} input
 * @returns {object} the row to insert
 */
export function buildErrorEventRow(input = {}) {
  const kind = KINDS.has(input.kind) ? input.kind : "runtime";
  const roles = Array.isArray(input.roles)
    ? input.roles.map((r) => String(r).slice(0, 50)).slice(0, 50)
    : null;

  return {
    reference_code: clean(input.referenceCode, "reference_code"),
    fingerprint: clean(input.fingerprint, "fingerprint"),
    kind,
    boundary_level: clean(input.boundaryLevel, "boundary_level"),
    variant: clean(input.variant, "variant"),
    message: clean(input.message, "message"),
    stack: clean(input.stack, "stack"),
    component_stack: clean(input.componentStack, "component_stack"),
    component: clean(input.component, "component"),
    status_code: toInt(input.statusCode),
    route: clean(input.route, "route"),
    section_key: clean(input.sectionKey, "section_key"),
    user_id: toInt(input.userId),
    username: clean(input.username, "username"),
    roles: roles && roles.length ? roles : null,
    user_agent: clean(input.userAgent, "user_agent"),
    // sanitiseDiagnostics walks the object and redacts secret-shaped values.
    device: sanitiseDiagnostics(input.device || {}),
    app_version: clean(input.appVersion, "app_version"),
    commit_sha: clean(input.commitSha, "commit_sha"),
    commit_ref: clean(input.commitRef, "commit_ref"),
    build_id: clean(input.buildId, "build_id"),
    deployment_env: clean(input.deploymentEnv, "deployment_env"),
    context: sanitiseDiagnostics(input.context || {}),
  };
}

/**
 * Record one automatically-captured error.
 *
 * Collapses a repeat of the same `fingerprint` inside DEDUPE_WINDOW_MS onto the
 * existing row (occurrences += 1, last_seen_at bumped) instead of inserting.
 *
 * Never throws: capture must not be able to break the thing it is observing, so
 * a failure is logged and returned as `{ success: false }`.
 *
 * @param {object} input see buildErrorEventRow
 * @returns {Promise<{ success: boolean, data?: object, deduped?: boolean, error?: { message: string } }>}
 */
export async function recordSupportErrorEvent(input = {}) {
  try {
    const row = buildErrorEventRow(input);
    const client = getClient();

    // Collapse a recent repeat of the same failure.
    if (row.fingerprint) {
      const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
      const { data: existing } = await client
        .from("support_error_events")
        .select("id, occurrences")
        .eq("fingerprint", row.fingerprint)
        .gte("last_seen_at", since)
        .order("last_seen_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const { data, error } = await client
          .from("support_error_events")
          .update({
            occurrences: (existing.occurrences || 1) + 1,
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("id, reference_code, occurrences")
          .single();
        if (error) throw error;
        return { success: true, data, deduped: true };
      }
    }

    const { data, error } = await client
      .from("support_error_events")
      .insert([row])
      .select("id, reference_code, occurrences")
      .single();

    if (error) throw error;
    return { success: true, data, deduped: false };
  } catch (error) {
    logFailure("[support] recordSupportErrorEvent error:", error?.message || error);
    return { success: false, error: { message: error?.message || "Insert failed" } };
  }
}

/**
 * Stamp a newly-created support_report onto the events already captured for the
 * same reference code, so opening the report shows what was recorded before the
 * user typed anything. Best-effort — a failure never fails the report.
 *
 * @param {string} referenceCode
 * @param {string} reportId
 * @returns {Promise<{ success: boolean, linked: number }>}
 */
export async function linkErrorEventsToReport(referenceCode, reportId) {
  if (!referenceCode || !reportId) return { success: false, linked: 0 };
  try {
    const { data, error } = await getClient()
      .from("support_error_events")
      .update({ report_id: reportId })
      .eq("reference_code", String(referenceCode).slice(0, CAPS.reference_code))
      .is("report_id", null)
      .select("id");
    if (error) throw error;
    return { success: true, linked: data?.length || 0 };
  } catch (error) {
    logFailure("[support] linkErrorEventsToReport error:", error?.message || error);
    return { success: false, linked: 0 };
  }
}

// Columns returned to the developer viewer. Everything here is already
// sanitised at write time.
const EVENT_COLUMNS =
  "id, reference_code, fingerprint, kind, boundary_level, variant, message, stack, " +
  "component_stack, component, status_code, route, section_key, user_id, username, roles, " +
  "user_agent, device, app_version, commit_sha, commit_ref, build_id, deployment_env, " +
  "context, report_id, occurrences, first_seen_at, last_seen_at, created_at";

/**
 * Developer-only listing of captured errors, newest first.
 * @param {{ limit?: number, kind?: string, route?: string, referenceCode?: string,
 *           fingerprint?: string, reportId?: string }} [filters]
 */
export async function listSupportErrorEvents(filters = {}) {
  try {
    const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 100, 1), 500);
    let query = getClient()
      .from("support_error_events")
      .select(EVENT_COLUMNS, { count: "exact" })
      .order("last_seen_at", { ascending: false })
      .limit(limit);

    if (filters.kind && KINDS.has(filters.kind)) query = query.eq("kind", filters.kind);
    if (filters.route) query = query.eq("route", String(filters.route).slice(0, CAPS.route));
    if (filters.referenceCode) {
      query = query.eq("reference_code", String(filters.referenceCode).slice(0, CAPS.reference_code));
    }
    if (filters.fingerprint) {
      query = query.eq("fingerprint", String(filters.fingerprint).slice(0, CAPS.fingerprint));
    }
    if (filters.reportId) query = query.eq("report_id", filters.reportId);

    const { data, error, count } = await query;
    if (error) throw error;
    return { success: true, data: data || [], count: count ?? (data?.length || 0) };
  } catch (error) {
    logFailure("[support] listSupportErrorEvents error:", error?.message || error);
    return { success: false, data: [], error: { message: error?.message || "Query failed" } };
  }
}

/**
 * Delete captured events older than a cutoff — used by the retention runner.
 * @param {string} cutoffIso
 */
export async function deleteSupportErrorEventsBefore(cutoffIso) {
  try {
    const { data, error } = await getClient()
      .from("support_error_events")
      .delete()
      .lt("created_at", cutoffIso)
      .select("id");
    if (error) throw error;
    return { success: true, deleted: data?.length || 0 };
  } catch (error) {
    logFailure("[support] deleteSupportErrorEventsBefore error:", error?.message || error);
    return { success: false, deleted: 0 };
  }
}
