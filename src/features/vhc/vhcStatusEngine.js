// file location: src/features/vhc/vhcStatusEngine.js
// Single source of truth for Vehicle Health Check (VHC) status.
//
// What this replaces (read side):
//   - inline `normaliseDecisionStatus`/`resolveVhcSeverity` chains in
//     pages/job-cards/[jobNumber].js
//   - `resolveDisplaySeverity` in lib/vhc/quoteLines.js
//   - `normalizeAuthorizationState` in lib/vhc/requestRowLinking.js
//   - `normaliseColour`/`normaliseDecisionStatus` in lib/vhc/calculateVhcTotals.js
//   - direct DB-state inspection inside VhcDetailsPanel.js Summary / Parts
//     Identified / Parts Authorised tabs.
//
// What this will replace (write side, Phase 5):
//   - the cascade in pages/api/vhc/update-item-status.js
//   - lib/database/vhcPartsSync.js syncVhcPartsAuthorisation
//   - the VHC branch of pages/api/parts/update-status.js
//
// DB columns are unchanged. The engine projects existing rows
// (vhc_checks + parts_job_items + jobs) into a normalised model:
//
//   { condition, workflow_status, parts_status, labour_status }
//
// The underlying primitive layer (normalizers + resolveVhcItemState +
// buildDecisionUpdatePayload) lives at src/lib/vhc/vhcItemState.js and is
// re-exported from here so callers can use a single import path.

import {
  DECISION,
  SEVERITY,
  WORKFLOW,
  normalizeDecision,
  normalizeSeverity,
  resolveVhcItemState,
  resolveVhcItemStates,
  buildDecisionUpdatePayload,
  isDecided,
  isAuthorizedLike,
  isSeverityColor,
} from "@/lib/vhc/vhcItemState"; // Underlying primitives.
import { NORMALIZE_ITEM as normalizePartItemStatus, ITEM_STATUSES as PART_ITEM_STATUSES } from "@/lib/status/catalog/parts"; // Canonical parts_job_items status normalizer.

// ---------------------------------------------------------------------------
// Inlined from src/lib/vhc/summaryStatus.js (deleted in Phase 6)
// ---------------------------------------------------------------------------
// The buildVhcRowStatusView / normaliseDecisionStatus / resolveSeverityKey
// helpers used to live in src/lib/vhc/summaryStatus.js. They are inlined
// here so the engine is the only module that owns this surface area.
// Behaviour is byte-identical to the previous implementation.

// Legacy-permissive decision normalizer: returns the canonical DECISION value
// when recognised, otherwise falls back to the raw lowercased string. The
// permissive fallback is intentional — some legacy rows store statuses the
// canonical normaliser does not yet recognise, and dropping them would change
// rendered labels.
const normaliseDecisionStatus = (value) => {
  const result = normalizeDecision(value);
  if (result) return result;
  if (!value) return null;
  const normalized = value.toString().trim().toLowerCase();
  return normalized || null;
};

// Resolve the colour the UI should render for a row. Prefers display_status
// when it is a colour, otherwise falls back to the severity column.
const resolveSeverityKey = (rawSeverity, displayStatus) => {
  const override = normalizeSeverity(displayStatus);
  if (override) return override;
  return normalizeSeverity(rawSeverity);
};

// Helper used by buildVhcRowStatusView to coerce numeric-or-null fields.
const parseNumericValue = (value) => {
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : 0;
};

// Build the descriptor consumed by the existing Summary tab badge. Returns
// { decisionKey, severityKey, sectionKey, dotStateKey, color, label, showTick?, showCross? }.
// Kept exactly equivalent to the old summaryStatus.buildVhcRowStatusView.
const buildVhcRowStatusView = ({
  decisionValue,
  rawSeverity,
  displayStatus,
  labourHoursValue,
  labourComplete,
  partsNotRequired,
  resolvedPartsCost,
  partsCost,
  totalOverride,
}) => {
  const decisionKey = normaliseDecisionStatus(decisionValue) || "pending";
  const severityKey = resolveSeverityKey(rawSeverity, displayStatus);
  const sectionKey =
    decisionKey === "authorized" || decisionKey === "completed"
      ? "authorized"
      : decisionKey === "declined"
      ? "declined"
      : severityKey;

  if (decisionKey === "completed") {
    return {
      decisionKey,
      severityKey,
      sectionKey,
      dotStateKey: "approved",
      color: "var(--success)",
      label: "Completed",
      showTick: true,
    };
  }

  if (decisionKey === "authorized") {
    return {
      decisionKey,
      severityKey,
      sectionKey,
      dotStateKey: "approved",
      color: "var(--success)",
      label: "Authorised",
    };
  }

  if (decisionKey === "declined") {
    return {
      decisionKey,
      severityKey,
      sectionKey,
      dotStateKey: "declined",
      color: "var(--danger)",
      label: "Declined",
      showCross: true,
    };
  }

  if (decisionKey === "n/a") {
    return {
      decisionKey,
      severityKey,
      sectionKey: severityKey,
      dotStateKey: "approved",
      color: "var(--success)",
      label: "N/A",
      showTick: true,
    };
  }

  const hasLabour = Boolean(labourComplete) ||
    (labourHoursValue !== null && labourHoursValue !== undefined && labourHoursValue !== "");
  const hasCosts =
    (resolvedPartsCost ?? parseNumericValue(partsCost)) > 0 ||
    parseNumericValue(totalOverride) > 0 ||
    Boolean(partsNotRequired);

  const missingLabour = !hasLabour;
  const missingParts = !hasCosts;

  if (missingLabour && missingParts) {
    return {
      decisionKey,
      severityKey,
      sectionKey,
      dotStateKey: "missing",
      color: "var(--warning-dark)",
      label: "Add labour & parts",
    };
  }

  if (missingLabour) {
    return {
      decisionKey,
      severityKey,
      sectionKey,
      dotStateKey: "missing",
      color: "var(--warning-dark)",
      label: "Add labour",
    };
  }

  if (missingParts) {
    return {
      decisionKey,
      severityKey,
      sectionKey,
      dotStateKey: "missing",
      color: "var(--warning-dark)",
      label: "Add parts",
    };
  }

  return {
    decisionKey,
    severityKey,
    sectionKey,
    dotStateKey: "awaiting",
    color: "var(--warning)",
    label: "Awaiting customer decision",
  };
};

// ---------------------------------------------------------------------------
// Re-exports — callers should `import { ... } from "@/features/vhc/vhcStatusEngine"`
// ---------------------------------------------------------------------------

export {
  DECISION,
  SEVERITY,
  WORKFLOW,
  normalizeDecision,
  normalizeSeverity,
  resolveVhcItemState,
  resolveVhcItemStates,
  buildDecisionUpdatePayload,
  isDecided,
  isAuthorizedLike,
  isSeverityColor,
};

// Inlined summaryStatus.js helpers — the engine is now the only module that
// exports these. The old src/lib/vhc/summaryStatus.js file has been deleted.
export { buildVhcRowStatusView, normaliseDecisionStatus, resolveSeverityKey };

// ---------------------------------------------------------------------------
// New constants for the normalised model
// ---------------------------------------------------------------------------

export const WORKFLOW_STATUS = Object.freeze({ // Normalised workflow_status enum.
  NEW: "new", // Pending decision, VHC has not been sent to customer yet.
  AWAITING_CUSTOMER: "awaiting_customer", // Pending decision, VHC has been sent.
  APPROVED: "approved", // Customer authorised; work not yet in flight.
  DECLINED: "declined", // Customer declined.
  IN_PROGRESS: "in_progress", // Authorised AND labour started or any linked part fitted, not yet complete.
  COMPLETED: "completed", // Work signed off as complete.
});

export const PARTS_STATUS = Object.freeze({ // Normalised parts_status enum.
  NONE: "none", // No linked parts.
  REQUIRED: "required", // Parts identified but not on order yet.
  ORDERED: "ordered", // Parts on order / booked / allocated / awaiting stock.
  READY: "ready", // Parts pre-picked / picked / loaded / in stock at the bay.
  FITTED: "fitted", // At least one linked part is fitted.
});

export const LABOUR_STATUS = Object.freeze({ // Normalised labour_status enum.
  NOT_STARTED: "not_started", // No labour hours logged.
  IN_PROGRESS: "in_progress", // Hours logged but labour_complete still false.
  COMPLETED: "completed", // labour_complete is true.
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const PARTS_FITTED_STATUSES = new Set(["fitted"]); // Highest-precedence parts status.
const PARTS_READY_STATUSES = new Set(["pre_picked", "picked", "loaded", "stock"]); // Physically present at the bay.
const PARTS_ORDERED_STATUSES = new Set(["on_order", "booked", "allocated", "awaiting_stock"]); // In flight from supplier.
const PARTS_REQUIRED_STATUSES = new Set(["pending", "waiting_authorisation", "unavailable"]); // Identified but not progressed.
const PARTS_IGNORED_STATUSES = new Set(["removed", "cancelled"]); // Treated as if the part row does not exist.

const toFiniteNumber = (value) => { // Best-effort numeric coercion that preserves zero.
  const num = Number(value); // Coerce.
  return Number.isFinite(num) ? num : 0; // Default to 0 for non-finite inputs.
};

const getVhcId = (check) => { // Resolve the canonical vhc_id from either snake_case or camelCase rows.
  return check?.vhc_id ?? check?.vhcId ?? check?.id ?? null; // Multiple aliases exist in legacy code paths.
};

const buildPartsByVhcItemId = (partsJobItems = []) => { // Build a Map<vhc_item_id, parts[]> once per projection batch.
  const map = new Map(); // Lookup target.
  if (!Array.isArray(partsJobItems)) return map; // Defensive null guard.
  for (const part of partsJobItems) { // Single linear pass.
    const vhcItemId = part?.vhc_item_id ?? part?.vhcItemId ?? null; // Tolerate camelCase.
    if (!vhcItemId) continue; // Skip non-VHC parts.
    if (!map.has(vhcItemId)) map.set(vhcItemId, []); // Lazy-init bucket.
    map.get(vhcItemId).push(part); // Accumulate.
  }
  return map; // Caller owns the map.
};

const deriveLabourStatus = (check) => { // Map labour_complete + labour_hours → LABOUR_STATUS.
  const labourComplete = check?.labour_complete ?? check?.labourComplete ?? false; // Boolean field.
  if (labourComplete === true) return LABOUR_STATUS.COMPLETED; // Explicit completion wins.
  const labourHours = toFiniteNumber(check?.labour_hours ?? check?.labourHours); // Hours logged.
  if (labourHours > 0) return LABOUR_STATUS.IN_PROGRESS; // Hours but no completion → in progress.
  return LABOUR_STATUS.NOT_STARTED; // Default.
};

const derivePartsStatus = (linkedParts) => { // Map parts_job_items[] → PARTS_STATUS.
  if (!Array.isArray(linkedParts) || linkedParts.length === 0) return PARTS_STATUS.NONE; // No rows linked.
  const active = linkedParts.filter((p) => { // Drop removed/cancelled rows.
    const status = String(p?.status ?? "").trim().toLowerCase(); // Normalise.
    return !PARTS_IGNORED_STATUSES.has(status); // Keep everything else.
  });
  if (active.length === 0) return PARTS_STATUS.NONE; // All linked parts were removed/cancelled.

  let hasReady = false; // Track precedence levels in one pass.
  let hasOrdered = false;
  let hasRequired = false;

  for (const part of active) { // Single linear pass.
    const status = String(part?.status ?? "").trim().toLowerCase(); // Normalise per row.
    if (PARTS_FITTED_STATUSES.has(status)) return PARTS_STATUS.FITTED; // Highest precedence — short-circuit.
    if (PARTS_READY_STATUSES.has(status)) hasReady = true; // Track but keep scanning for fitted.
    else if (PARTS_ORDERED_STATUSES.has(status)) hasOrdered = true; // Track.
    else if (PARTS_REQUIRED_STATUSES.has(status)) hasRequired = true; // Track.
  }

  if (hasReady) return PARTS_STATUS.READY; // Best of remaining.
  if (hasOrdered) return PARTS_STATUS.ORDERED; // Next best.
  if (hasRequired) return PARTS_STATUS.REQUIRED; // Lowest non-empty bucket.
  return PARTS_STATUS.NONE; // No recognised state — treat as none.
};

const deriveWorkflowStatus = ({ decision, completeFlag, labourStatus, partsStatus, jobVhcSentAt }) => { // Map state → WORKFLOW_STATUS.
  // Order matters — first match wins.

  if (decision === DECISION.COMPLETED) return WORKFLOW_STATUS.COMPLETED; // Explicit completion.
  if (decision === DECISION.AUTHORIZED && completeFlag === true) return WORKFLOW_STATUS.COMPLETED; // Authorised + Complete flag → completed.

  if (decision === DECISION.AUTHORIZED) { // Authorised path.
    const labourInFlight = labourStatus === LABOUR_STATUS.IN_PROGRESS; // Technician has started.
    const partsFitted = partsStatus === PARTS_STATUS.FITTED; // At least one part fitted.
    if (labourInFlight || partsFitted) return WORKFLOW_STATUS.IN_PROGRESS; // Either signal of work in flight.
    return WORKFLOW_STATUS.APPROVED; // Authorised but no in-flight signal.
  }

  if (decision === DECISION.DECLINED) return WORKFLOW_STATUS.DECLINED; // Customer declined.

  if (decision === DECISION.NA) return WORKFLOW_STATUS.APPROVED; // N/A renders as approved (preserves Summary tick behaviour).

  // PENDING fall-through — split by whether the VHC has been sent.
  const sent = Boolean(jobVhcSentAt); // Coerce to boolean; null/undefined → false.
  if (sent) return WORKFLOW_STATUS.AWAITING_CUSTOMER; // VHC out, waiting on customer.
  return WORKFLOW_STATUS.NEW; // Not yet sent.
};

// ---------------------------------------------------------------------------
// Projection — single row
// ---------------------------------------------------------------------------

/**
 * Project a raw vhc_checks row into the normalised engine model.
 *
 * @param {object} check - Raw vhc_checks row (snake_case or camelCase).
 * @param {object} [context]
 * @param {Map<string, Array>} [context.partsByVhcItemId] - Pre-built parts lookup; if omitted, the engine looks at context.partsJobItems.
 * @param {Array} [context.partsJobItems] - Raw parts_job_items rows for the job (used when partsByVhcItemId is not supplied).
 * @param {object} [context.job] - Parent jobs row; engine reads job.vhc_sent_at.
 * @returns {object} Frozen projection.
 */
export const projectVhcItem = (check = {}, context = {}) => { // Pure projection — no I/O.
  const state = resolveVhcItemState(check); // Underlying canonical state (decision + severity + flags).

  // --- parts_status ---
  const partsByVhcItemId = context.partsByVhcItemId ?? buildPartsByVhcItemId(context.partsJobItems); // Reuse caller's map if provided.
  const vhcId = getVhcId(check); // Match key for parts.
  const linkedParts = vhcId ? (partsByVhcItemId.get(vhcId) ?? []) : []; // Empty when there's no id to match against.
  const partsStatus = derivePartsStatus(linkedParts); // Highest-precedence parts state.

  // --- labour_status ---
  const labourStatus = deriveLabourStatus(check); // Independent of decision.

  // --- workflow_status ---
  const completeFlag = Boolean(check?.Complete ?? check?.complete ?? false); // Dedicated completion toggle.
  const jobVhcSentAt = context.job?.vhc_sent_at ?? context.job?.vhcSentAt ?? null; // Job-level "sent to customer" timestamp.
  const workflowStatus = deriveWorkflowStatus({
    decision: state.decision,
    completeFlag,
    labourStatus,
    partsStatus,
    jobVhcSentAt,
  });

  return Object.freeze({ // Frozen so consumers cannot mutate projected state by accident.
    // --- normalised model fields ---
    condition: state.severity, // red | amber | green | grey.
    workflow_status: workflowStatus, // new | awaiting_customer | approved | declined | in_progress | completed.
    parts_status: partsStatus, // none | required | ordered | ready | fitted.
    labour_status: labourStatus, // not_started | in_progress | completed.

    // --- forwarded primitives (for callers still on the legacy vocabulary) ---
    decision: state.decision, // pending | authorized | declined | completed | n/a.
    severity: state.severity, // Same as condition; kept for legacy imports.
    displaySeverity: state.displaySeverity, // Colour the UI should render.
    isComplete: workflowStatus === WORKFLOW_STATUS.COMPLETED, // Convenience boolean.
    isAddedToJob: state.addedToJob, // Parts cascaded to job_requests.
    isDecided: state.isDecided, // Customer has made a decision.
    isAuthorizedLike: state.isAuthorizedLike, // Work should proceed.

    // --- raw access (escape hatch; do not extend) ---
    vhcId, // Resolved canonical id.
    raw: check, // Original row reference for legacy access — do not write through this.
    linkedParts, // Active parts rows (after removed/cancelled filter).
  });
};

// ---------------------------------------------------------------------------
// Projection — array
// ---------------------------------------------------------------------------

/**
 * Project an array of vhc_checks rows. Builds the parts lookup map once.
 *
 * @param {Array} checks - Raw vhc_checks rows.
 * @param {object} [context] - { partsJobItems, job }.
 * @returns {Array<object>} Array of frozen projections.
 */
export const projectVhcItems = (checks = [], context = {}) => { // Batch projector.
  if (!Array.isArray(checks) || checks.length === 0) return []; // Defensive empty case.
  const partsByVhcItemId = context.partsByVhcItemId ?? buildPartsByVhcItemId(context.partsJobItems); // Build once.
  return checks.map((check) => projectVhcItem(check, { ...context, partsByVhcItemId })); // Reuse the map per row.
};

// ---------------------------------------------------------------------------
// Summary — totals + counts (Phase 0 stub; full totals delegation lands in Phase 2)
// ---------------------------------------------------------------------------

/**
 * Build the canonical summary for a job's VHC.
 *
 * Phase 0 returns counts and the projected items array. The financial totals
 * delegation (replacing calculateVhcFinancialTotals) lands in Phase 2; until
 * then, totals fields are present but null and callers should keep using
 * calculateVhcFinancialTotals directly.
 *
 * @param {Array} checks - Raw vhc_checks rows.
 * @param {object} [context] - { partsJobItems, job }.
 * @returns {object} { items, counts, hasAwaitingCustomer, totals }.
 */
export const getVhcSummary = (checks = [], context = {}) => { // Aggregate view across all rows of a job.
  const items = projectVhcItems(checks, context); // Single projection pass.

  const counts = { // Per-condition and per-workflow tallies.
    byCondition: { red: 0, amber: 0, green: 0, grey: 0 },
    byWorkflow: { new: 0, awaiting_customer: 0, approved: 0, declined: 0, in_progress: 0, completed: 0 },
    byParts: { none: 0, required: 0, ordered: 0, ready: 0, fitted: 0 },
    byLabour: { not_started: 0, in_progress: 0, completed: 0 },
    total: items.length,
  };

  for (const item of items) { // Single tally pass.
    if (item.condition && counts.byCondition[item.condition] !== undefined) counts.byCondition[item.condition] += 1; // Defensive bucket check.
    if (counts.byWorkflow[item.workflow_status] !== undefined) counts.byWorkflow[item.workflow_status] += 1;
    if (counts.byParts[item.parts_status] !== undefined) counts.byParts[item.parts_status] += 1;
    if (counts.byLabour[item.labour_status] !== undefined) counts.byLabour[item.labour_status] += 1;
  }

  return { // Stable shape for callers.
    items, // Projected, frozen.
    counts, // Tally object.
    hasAwaitingCustomer: counts.byWorkflow.awaiting_customer > 0, // Convenience flag (replaces inline derivation in jobNumber.js).
    totals: null, // Phase 2 will populate { authorized, declined } via calculateVhcFinancialTotals delegation.
  };
};

// ---------------------------------------------------------------------------
// getDisplayStatus — UI badge for a single projected item
// ---------------------------------------------------------------------------

/**
 * Resolve the UI badge ({ decisionKey, severityKey, sectionKey, dotStateKey, color, label, ...})
 * for a projected item. Delegates to buildVhcRowStatusView (defined above) so
 * the rendered output is byte-identical to the current Summary tab.
 *
 * @param {object} item - A projection from projectVhcItem.
 * @returns {object} The badge descriptor consumed by the existing UI.
 */
export const getDisplayStatus = (item) => { // Thin wrapper that keeps the existing UI shape stable.
  if (!item) return null; // Defensive null guard.
  const raw = item.raw ?? {}; // Source row for fields buildVhcRowStatusView still wants.

  return buildVhcRowStatusView({ // Same args as today's callsites.
    decisionValue: item.decision, // Already canonical.
    rawSeverity: item.condition, // Already canonical.
    displayStatus: raw.display_status ?? raw.displayStatus ?? null, // Pass-through for the existing override logic.
    labourHoursValue: raw.labour_hours ?? raw.labourHours ?? null, // Numeric.
    labourComplete: raw.labour_complete ?? raw.labourComplete ?? false, // Boolean.
    partsNotRequired: raw.parts_not_required ?? raw.partsNotRequired ?? false, // Boolean.
    resolvedPartsCost: raw.resolved_parts_cost ?? raw.resolvedPartsCost ?? null, // Optional pre-resolved value.
    partsCost: raw.parts_cost ?? raw.partsCost ?? 0, // Numeric.
    totalOverride: raw.total_override ?? raw.totalOverride ?? 0, // Numeric.
  });
};

// ---------------------------------------------------------------------------
// getNextActions — permitted transitions for the current workflow_status
// ---------------------------------------------------------------------------

const ACTIONS = Object.freeze({ // Action descriptors used by Customer Request / Summary tab buttons.
  AUTHORIZE: Object.freeze({ action: "authorize", targetDecision: DECISION.AUTHORIZED, label: "Authorise" }),
  DECLINE: Object.freeze({ action: "decline", targetDecision: DECISION.DECLINED, label: "Decline" }),
  RESET: Object.freeze({ action: "reset", targetDecision: DECISION.PENDING, label: "Reset" }),
  COMPLETE: Object.freeze({ action: "complete", targetDecision: DECISION.COMPLETED, label: "Mark complete" }),
  REOPEN: Object.freeze({ action: "reopen", targetDecision: DECISION.AUTHORIZED, label: "Reopen" }),
});

/**
 * Return the list of permitted transitions for an item's current workflow_status.
 * Permission/role gating is handled separately at the call site — this only describes
 * which transitions make sense given the item's state.
 */
export const getNextActions = (item) => { // Pure state-machine transition table.
  if (!item) return []; // Defensive null guard.
  switch (item.workflow_status) { // One arm per state.
    case WORKFLOW_STATUS.NEW: // Not yet sent.
      return [ACTIONS.AUTHORIZE, ACTIONS.DECLINE]; // Technician can pre-decide on the customer's behalf.
    case WORKFLOW_STATUS.AWAITING_CUSTOMER: // Sent, waiting.
      return [ACTIONS.AUTHORIZE, ACTIONS.DECLINE]; // Customer (or staff on their behalf) responds.
    case WORKFLOW_STATUS.APPROVED: // Authorised, work not yet in flight.
      return [ACTIONS.COMPLETE, ACTIONS.RESET]; // Either advance or revert.
    case WORKFLOW_STATUS.IN_PROGRESS: // Work in flight.
      return [ACTIONS.COMPLETE]; // Only completion makes sense; reverting mid-work is intentional via ACTIONS.RESET in callers if needed.
    case WORKFLOW_STATUS.DECLINED: // Customer declined.
      return [ACTIONS.RESET]; // Allow undo.
    case WORKFLOW_STATUS.COMPLETED: // Done.
      return [ACTIONS.REOPEN]; // Allow reopening if completion was a mistake.
    default: // Unknown state — fail safe.
      return [];
  }
};

// ---------------------------------------------------------------------------
// isItemComplete — convenience predicate
// ---------------------------------------------------------------------------

export const isItemComplete = (item) => { // Used by tab filters and progress indicators.
  return item?.workflow_status === WORKFLOW_STATUS.COMPLETED; // Single source.
};

// ---------------------------------------------------------------------------
// applyVhcDecision — single write entry point
// ---------------------------------------------------------------------------

/**
 * Apply a decision change for a VHC item. This is the canonical entry point
 * for any write that changes approval/authorisation state.
 *
 * What it owns today (Phase 5):
 *   - Building the vhc_checks update payload from the target decision via
 *     buildDecisionUpdatePayload (no caller should hand-build this object).
 *   - Cascading the change to parts_job_items + parts_catalog + job_requests
 *     via syncVhcPartsAuthorisation (existing helper, retained as the
 *     cascade owner — Phase 6+ may inline it).
 *
 * What it does NOT own:
 *   - Persisting the vhc_checks row itself. Callers (update-item-status.js)
 *     remain responsible for the primary update so we don't change the
 *     existing transaction shape mid-refactor. They build the payload via
 *     this engine's buildDecisionUpdatePayload to keep the field set canonical.
 *
 * Atomicity: Supabase JS has no cross-table transactions. The cascade is
 * idempotent — calling applyVhcDecision twice produces the same end state.
 *
 * @param {object} args
 * @param {string|number} args.jobId            - Parent jobs.id.
 * @param {string|number} args.vhcItemId        - vhc_checks.vhc_id (canonical or display id).
 * @param {string} args.targetDecision          - Target decision (any alias accepted).
 * @returns {Promise<void>}
 */
export const applyVhcDecision = async ({ jobId, vhcItemId, targetDecision } = {}) => {
  if (!jobId) throw new Error("applyVhcDecision: jobId is required.");
  if (vhcItemId === null || vhcItemId === undefined) throw new Error("applyVhcDecision: vhcItemId is required.");

  const decision = normalizeDecision(targetDecision); // Canonicalise before delegating.
  // Lazy-import to avoid a top-level import cycle (vhcPartsSync imports the
  // engine to reuse normalizeDecision).
  const { syncVhcPartsAuthorisation } = await import("@/lib/database/vhcPartsSync");
  await syncVhcPartsAuthorisation({ jobId, vhcItemId, approvalStatus: decision });
};

// ---------------------------------------------------------------------------
// Tech-side job status — links VHC authorised work to the technician's
// "Complete Job" flow on the job number page and to the Next Jobs board.
// ---------------------------------------------------------------------------
//
// These helpers are pure projections of vhc_checks rows; they own the rule
// "if the customer authorised VHC work and it isn't done yet, the tech-side
// job is not finished — even if the main job is". The persisted DB column is
// jobs.tech_completion_status (text, no schema change). Values written by
// this engine:
//   - "tech_complete"    → all main + authorised VHC work is done (existing value)
//   - "authorised_items" → main work is done but at least one authorised VHC item is outstanding
// A null / empty / "in_progress" value means the tech has not pressed
// Complete Job yet. The Next Jobs page treats "authorised_items" as
// outstanding so the job reappears in the unassigned queue.

// Canonical tech-side job status values. IN_PROGRESS is not persisted — null
// in the DB means in-progress; this constant exists so callers can switch on
// engine output without dealing with null.
export const TECH_JOB_STATUS = Object.freeze({
  IN_PROGRESS: "in_progress", // Tech has not yet pressed Complete Job (DB null/empty).
  COMPLETED: "tech_complete", // Tech finished main + any authorised VHC work (matches existing DB value).
  AUTHORISED_ITEMS: "authorised_items", // Tech finished main work but authorised VHC items remain.
});

// Clocking work types — mirrors job_clocking.work_type. The DB also accepts
// "mot" but that is owned by the MOT handoff path, not this engine.
export const CLOCKING_WORK_TYPE = Object.freeze({
  INITIAL: "initial", // "Main Work Requested" — first clock-in to a normal job.
  ADDITIONAL: "additional", // "Additional Work" — clock-in after authorised VHC items reopened the job.
});

// Normalise a persisted tech_completion_status value into a TECH_JOB_STATUS.
// Tolerates null/empty (returns IN_PROGRESS) and the historical "complete" /
// "completed" aliases so reload paths reading legacy rows behave correctly.
const normaliseTechStatus = (value) => {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return TECH_JOB_STATUS.IN_PROGRESS;
  if (text === TECH_JOB_STATUS.AUTHORISED_ITEMS) return TECH_JOB_STATUS.AUTHORISED_ITEMS;
  if (text === TECH_JOB_STATUS.COMPLETED || text === "complete" || text === "completed") return TECH_JOB_STATUS.COMPLETED;
  if (text === TECH_JOB_STATUS.IN_PROGRESS || text === "in progress") return TECH_JOB_STATUS.IN_PROGRESS;
  return TECH_JOB_STATUS.IN_PROGRESS; // Unknown values are treated as not-yet-complete (safe default).
};

/**
 * True when at least one projected VHC item represents customer-authorised
 * work that is not yet finished. Drives both the Next Jobs reappearance and
 * the Additional Work clock-in path.
 *
 * Outstanding = authorised-like (authorized OR in_progress workflow) AND not
 * completed AND not declined. Pending / awaiting_customer / declined items
 * are NOT outstanding work for the technician — only items the customer has
 * said yes to and that haven't been signed off.
 *
 * @param {Array<object>} vhcItems - Output of projectVhcItems().
 * @returns {boolean}
 */
export const hasOutstandingAuthorisedVhcWork = (vhcItems = []) => {
  if (!Array.isArray(vhcItems) || vhcItems.length === 0) return false; // No items → no work outstanding.
  return vhcItems.some((item) => {
    if (!item) return false; // Defensive null guard.
    if (item.workflow_status === WORKFLOW_STATUS.COMPLETED) return false; // Done — does not count.
    if (item.workflow_status === WORKFLOW_STATUS.DECLINED) return false; // Customer said no — does not count.
    // Authorised AND not yet complete. Both APPROVED and IN_PROGRESS workflow
    // states reach here when the decision is authorized; isAuthorizedLike
    // also catches "completed" decisions paired with Complete=false (rare).
    return item.workflow_status === WORKFLOW_STATUS.APPROVED
        || item.workflow_status === WORKFLOW_STATUS.IN_PROGRESS;
  });
};

/**
 * Resolve the canonical tech-side job status from the current set of
 * projected VHC items plus whether the technician has signalled main-work
 * completion (i.e. has just pressed, or has previously pressed, Complete Job).
 *
 * Returns one of TECH_JOB_STATUS values:
 *   - IN_PROGRESS      → tech has not signalled completion
 *   - AUTHORISED_ITEMS → tech signalled completion BUT outstanding authorised VHC items remain
 *   - COMPLETED        → tech signalled completion AND no outstanding authorised VHC items
 *
 * @param {Array<object>} vhcItems - Output of projectVhcItems().
 * @param {object} [options]
 * @param {boolean} [options.techHasCompletedMainWork=false] - True when the tech has pressed Complete Job.
 * @returns {string} A TECH_JOB_STATUS value.
 */
export const getJobTechStatusFromVhcItems = (vhcItems = [], { techHasCompletedMainWork = false } = {}) => {
  if (!techHasCompletedMainWork) return TECH_JOB_STATUS.IN_PROGRESS; // Hasn't pressed Complete Job yet.
  if (hasOutstandingAuthorisedVhcWork(vhcItems)) return TECH_JOB_STATUS.AUTHORISED_ITEMS; // Authorised items still open.
  return TECH_JOB_STATUS.COMPLETED; // Everything done.
};

/**
 * Decide which work type a clock-in should record against a job. When the
 * persisted tech-side status is AUTHORISED_ITEMS and there is still
 * outstanding authorised VHC work, the clock-in is "Additional Work";
 * otherwise it is "Main Work Requested" (initial).
 *
 * Read both sides — persisted status survives reload and is the source of
 * truth across the app, but we still re-check vhcItems so an
 * out-of-date AUTHORISED_ITEMS row (e.g. all items have since been completed
 * by another path) does not force an inappropriate Additional Work entry.
 *
 * @param {object} args
 * @param {Array<object>} [args.vhcItems=[]]      - Output of projectVhcItems().
 * @param {string|null} [args.currentTechStatus]  - The persisted jobs.tech_completion_status.
 * @returns {string} A CLOCKING_WORK_TYPE value.
 */
export const getClockingWorkTypeForJob = ({ vhcItems = [], currentTechStatus = null } = {}) => {
  const status = normaliseTechStatus(currentTechStatus); // Tolerates null + legacy aliases.
  if (status === TECH_JOB_STATUS.AUTHORISED_ITEMS && hasOutstandingAuthorisedVhcWork(vhcItems)) {
    return CLOCKING_WORK_TYPE.ADDITIONAL; // Additional Work path.
  }
  return CLOCKING_WORK_TYPE.INITIAL; // Main Work Requested (default).
};

// ---------------------------------------------------------------------------
// Parts Authorised button/status — single source of truth for the VHC tab's
// "Parts Authorised" auto-data table on the job card page. The displayed
// button label must reflect what the parts panels would show:
//   - "added_to_job" → row is present in the jobcard-parts-added-panel
//                      (parts_job_items.status normalises to BOOKED).
//   - "on_order"     → row is in the jobcard-parts-on-order-panel
//                      (status normalises to ON_ORDER).
//   - "removed"      → row was removed from the job (status REMOVED).
//   - "order"        → just authorised, not yet added or ordered (default).
// ---------------------------------------------------------------------------

// Canonical button states. Kept as a frozen object so call sites can switch
// on AUTHORISED_PART_STATUS.ADDED_TO_JOB without typo risk.
export const AUTHORISED_PART_STATUS = Object.freeze({
  ADDED_TO_JOB: "added_to_job", // Lives in the Parts Added to Job panel.
  ON_ORDER: "on_order",         // Lives in the Parts On Order panel.
  REMOVED: "removed",           // Removed from the job.
  ORDER: "order",               // Authorised only; not yet added or ordered.
});

/**
 * Resolve which button/status the VHC Parts Authorised table should show for
 * a given parts_job_items row. The decision is anchored on the canonical
 * NORMALIZE_ITEM categorisation so this stays in lockstep with how the
 * Parts Added / Parts On Order panels filter the same dataset.
 *
 * @param {object} part - Raw parts_job_items row.
 * @returns {string}    - One of AUTHORISED_PART_STATUS values.
 */
export const getPartAuthorisedDisplayStatus = (part = {}) => {
  // Treat missing rows as not-yet-progressed authorised work.
  if (!part) return AUTHORISED_PART_STATUS.ORDER;

  // Use the canonical parts catalog normaliser so that aliases like
  // "ordered" / "awaiting_stock" / "pre-pick" all collapse correctly.
  const normalized = normalizePartItemStatus(part?.status ?? "");

  if (normalized === PART_ITEM_STATUSES.REMOVED) return AUTHORISED_PART_STATUS.REMOVED; // Removed wins over everything else.
  if (normalized === PART_ITEM_STATUSES.BOOKED) return AUTHORISED_PART_STATUS.ADDED_TO_JOB; // Present in the Parts Added panel.
  if (normalized === PART_ITEM_STATUSES.ON_ORDER) return AUTHORISED_PART_STATUS.ON_ORDER; // Present in the On Order panel.

  // PRE_PICK / STOCK / PRICED rows have already been added to the job — they
  // would render in the Parts Added panel as well, just at a later stage.
  if (
    normalized === PART_ITEM_STATUSES.PRE_PICK ||
    normalized === PART_ITEM_STATUSES.STOCK ||
    normalized === PART_ITEM_STATUSES.PRICED ||
    normalized === PART_ITEM_STATUSES.RESERVED
  ) {
    return AUTHORISED_PART_STATUS.ADDED_TO_JOB;
  }

  // PENDING and any unknown status → just authorised, awaiting an order action.
  return AUTHORISED_PART_STATUS.ORDER;
};
