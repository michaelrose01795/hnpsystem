// file location: src/lib/dev-platform/bulkTriage.js
//
// Phase 9 — Developer Platform bulk issue management. PURE, node-testable
// validation for bulk triage operations, split out (like triageValidation.js) so
// it never imports the Supabase client. It reuses buildTriagePatch() as the
// single source of truth for enum validation, then enforces the bulk-specific
// rules: a de-duplicated, capped id set and a non-empty patch.
//
// The API layer applies the validated patch to each id and writes ONE audit entry
// per report (so the hash-chained audit stays per-entity, never a single opaque
// "bulk" blob).

import { buildTriagePatch } from "@/lib/support/triageValidation";

export const BULK_MAX_IDS = 200;

const arr = (v) => (Array.isArray(v) ? v : []);

/**
 * Validate + normalise a bulk-triage request.
 *
 * @param {{ ids?: string[], updates?: object }} input
 * @returns {{ ok: true, ids: string[], updates: object, patch: object } | { ok: false, error: string }}
 */
export function validateBulkTriage(input = {}) {
  const ids = Array.from(
    new Set(arr(input.ids).filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim()))
  );
  if (ids.length === 0) return { ok: false, error: "No report ids supplied." };
  if (ids.length > BULK_MAX_IDS) {
    return { ok: false, error: `Too many reports selected (max ${BULK_MAX_IDS}).` };
  }

  // Only accept the whitelisted triage fields; reuse the single validator.
  const updates = {};
  const src = input.updates || {};
  if (src.status !== undefined) updates.status = src.status;
  if (src.severity !== undefined) updates.severity = src.severity;
  if (src.assignedTo !== undefined) updates.assignedTo = src.assignedTo;
  // duplicate_of is intentionally NOT bulk-settable: pointing many reports at one
  // duplicate target is an individual, deliberate action, not a bulk sweep.

  let patch;
  try {
    patch = buildTriagePatch(updates);
  } catch (error) {
    return { ok: false, error: error?.message || "Invalid triage values." };
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "No valid triage fields to apply." };
  }

  return { ok: true, ids, updates, patch };
}

/**
 * Summarise a batch of per-report results into a single response the UI shows.
 * @param {Array<{ id: string, ok: boolean }>} results
 * @returns {{ total: number, updated: number, failed: number, failedIds: string[] }}
 */
export function summariseBulkResult(results = []) {
  const list = arr(results);
  const failedIds = list.filter((r) => !r.ok).map((r) => r.id);
  return {
    total: list.length,
    updated: list.length - failedIds.length,
    failed: failedIds.length,
    failedIds,
  };
}
