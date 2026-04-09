// file location: src/lib/vhc/vhcItemState.js
// Canonical VHC item state model.
// ONE place to resolve the decision, severity, and display state of any VHC row.
// Replaces scattered normalization across summaryStatus, quoteLines, calculateVhcTotals,
// vhcPartsSync, update-item-status, and useConcernLock.
//
// DB columns stay unchanged — this is a READ-SIDE mapping layer only.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DECISION = Object.freeze({ // Allowed decision values after normalization.
  PENDING: "pending", // Awaiting customer decision.
  AUTHORIZED: "authorized", // Customer authorized the work.
  DECLINED: "declined", // Customer declined the work.
  COMPLETED: "completed", // Work has been completed.
  NA: "n/a", // Not applicable (green / low-priority items).
});

export const SEVERITY = Object.freeze({ // Allowed severity color values after normalization.
  RED: "red", // Critical issue.
  AMBER: "amber", // Warning / medium priority.
  GREEN: "green", // Low priority / good condition.
  GREY: "grey", // Neutral / not classified.
});

export const WORKFLOW = Object.freeze({ // Extended authorization_state values beyond DECISION.
  AUTHORIZED_ADDED_TO_JOB: "authorized_added_to_job", // Parts have been added to job requests.
});

const DECISION_VALUES = new Set(Object.values(DECISION)); // Fast lookup set for valid decisions.
const SEVERITY_VALUES = new Set(Object.values(SEVERITY)); // Fast lookup set for valid severities.

// ---------------------------------------------------------------------------
// Normalization helpers (single source of truth)
// ---------------------------------------------------------------------------

const clean = (value) => String(value ?? "").trim().toLowerCase(); // Lowercase-trim a value safely.

export const normalizeDecision = (value) => { // Normalize any raw decision/approval string into a canonical DECISION value.
  const text = clean(value); // Clean the input.
  if (!text) return null; // Null / empty → null (caller decides the default).

  // Exact matches first (fast path).
  if (DECISION_VALUES.has(text)) return text; // Already canonical.

  // Spelling variants and aliases.
  if (text === "authorised" || text === "approved") return DECISION.AUTHORIZED; // British spelling + legacy "approved".
  if (text === "declined" || text === "decline" || text === "rejected" || text === "declinded" || text.includes("declin")) return DECISION.DECLINED; // Typo-tolerant.
  if (text === "completed" || text === "complete" || text.includes("complet")) return DECISION.COMPLETED; // Partial match.
  if (text === "na" || text === "not applicable") return DECISION.NA; // Alternate NA forms.
  if (text === "pending" || text.includes("pending")) return DECISION.PENDING; // Fuzzy pending match.

  // Substring matches for "authorized" / "authorised" (e.g. "authorized_added_to_job").
  if (text.includes("authorized") || text.includes("authorised")) return DECISION.AUTHORIZED; // Catch workflow states.

  return null; // Truly unrecognized — caller decides fallback.
};

export const normalizeSeverity = (value) => { // Normalize any raw severity/color string into a canonical SEVERITY value.
  const text = clean(value); // Clean the input.
  if (!text) return null; // Null / empty → null.

  // Exact matches.
  if (SEVERITY_VALUES.has(text)) return text; // Already canonical.

  // Aliases.
  if (text === "critical" || text === "high") return SEVERITY.RED; // Red aliases.
  if (text === "warning" || text === "medium" || text === "orange" || text === "yellow" || text === "advisory") return SEVERITY.AMBER; // Amber aliases.
  if (text === "ok" || text === "low" || text === "good" || text === "pass") return SEVERITY.GREEN; // Green aliases.
  if (text === "gray" || text === "neutral") return SEVERITY.GREY; // Grey aliases.

  // Substring fallbacks.
  if (text.includes("red")) return SEVERITY.RED; // Contains "red".
  if (text.includes("amber")) return SEVERITY.AMBER; // Contains "amber".
  if (text.includes("green")) return SEVERITY.GREEN; // Contains "green".
  if (text.includes("grey") || text.includes("gray")) return SEVERITY.GREY; // Contains "grey"/"gray".

  return null; // Unrecognized.
};

// ---------------------------------------------------------------------------
// Predicate helpers
// ---------------------------------------------------------------------------

export const isDecided = (decision) => { // True when the customer has made a final decision (authorized, declined, or completed).
  return decision === DECISION.AUTHORIZED || decision === DECISION.DECLINED || decision === DECISION.COMPLETED; // All three count as "decided".
};

export const isAuthorizedLike = (decision) => { // True when the decision means "work should proceed" (authorized or completed).
  return decision === DECISION.AUTHORIZED || decision === DECISION.COMPLETED; // Both mean the work is greenlit.
};

export const isSeverityColor = (value) => { // True when the value is a valid severity color (not a workflow status).
  return SEVERITY_VALUES.has(clean(value)); // Check against the canonical set.
};

// ---------------------------------------------------------------------------
// Canonical state resolver
// ---------------------------------------------------------------------------

/**
 * Resolve the canonical state of a VHC item from its raw DB fields.
 *
 * Accepts either snake_case DB row or camelCase mapped row.
 * Returns a frozen object with:
 *   - decision:        canonical DECISION value (default "pending")
 *   - severity:        canonical SEVERITY color (default "grey")
 *   - displaySeverity: the color the UI should render (severity, unless display_status overrides with a color)
 *   - workflowState:   raw authorization_state for workflow integration checks
 *   - isDecided:       boolean — customer has made a decision
 *   - isAuthorizedLike: boolean — work should proceed
 *   - isComplete:      boolean — Complete flag is true AND decision is completed
 *   - addedToJob:      boolean — authorization_state is "authorized_added_to_job"
 */
export const resolveVhcItemState = (row = {}) => { // THE canonical resolver — call this instead of ad-hoc field checks.
  // --- Read both snake_case and camelCase field names ---
  const rawApproval = row.approval_status ?? row.approvalStatus ?? null; // Primary decision field.
  const rawAuthState = row.authorization_state ?? row.authorizationState ?? null; // Workflow integration field.
  const rawDisplayStatus = row.display_status ?? row.displayStatus ?? null; // UI override field.
  const rawSeverity = row.severity ?? null; // Inspection color field.
  const rawComplete = row.Complete ?? row.complete ?? false; // Completion toggle.

  // --- Resolve decision ---
  // Priority: approval_status is the canonical decision.
  // Fall back to authorization_state only when approval_status is missing or "n/a" while
  // authorization_state has a more specific value (handles legacy rows).
  const approvalDecision = normalizeDecision(rawApproval); // Normalize approval_status.
  const authStateDecision = normalizeDecision(rawAuthState); // Normalize authorization_state.

  let decision; // The canonical decision value.
  if (approvalDecision && approvalDecision !== DECISION.NA) { // approval_status has a meaningful value.
    decision = approvalDecision; // Use it.
  } else if (authStateDecision && authStateDecision !== DECISION.NA) { // authorization_state has a meaningful value.
    decision = authStateDecision; // Fall back to it.
  } else if (approvalDecision === DECISION.NA || authStateDecision === DECISION.NA) { // Both are n/a.
    decision = DECISION.NA; // Preserve n/a.
  } else { // Neither field has a value.
    decision = DECISION.PENDING; // Default to pending.
  }

  // --- Resolve severity ---
  // Prefer the raw severity column. If display_status is a color (not a workflow status), use it as override.
  const severityFromColumn = normalizeSeverity(rawSeverity); // Try the severity column.
  const displaySeverityOverride = normalizeSeverity(rawDisplayStatus); // Try display_status as a color.
  const severity = severityFromColumn ?? displaySeverityOverride ?? SEVERITY.GREY; // Final severity with default.

  // displaySeverity is what the UI should actually render as the color dot.
  // If display_status is a valid color, prefer it (it may differ from severity when technician overrides).
  // If display_status is a workflow status (authorized/declined/completed), ignore it for color purposes.
  const displaySeverity = displaySeverityOverride ?? severityFromColumn ?? SEVERITY.GREY; // Color for UI rendering.

  // --- Resolve workflow state ---
  const rawAuthLower = clean(rawAuthState); // Raw authorization_state lowercased.
  const addedToJob = rawAuthLower === WORKFLOW.AUTHORIZED_ADDED_TO_JOB; // Check for job-linked state.

  // --- Build result ---
  return Object.freeze({ // Frozen to prevent accidental mutation.
    decision, // Canonical decision: pending | authorized | declined | completed | n/a.
    severity, // Canonical severity: red | amber | green | grey.
    displaySeverity, // Color for UI dot rendering.
    workflowState: rawAuthLower || null, // Raw authorization_state for workflow integration.
    isDecided: isDecided(decision), // Customer has made a final decision.
    isAuthorizedLike: isAuthorizedLike(decision), // Work should proceed.
    isComplete: Boolean(rawComplete) && decision === DECISION.COMPLETED, // Truly complete.
    addedToJob, // Parts have been added to job requests.

    // --- Legacy field access (for gradual migration) ---
    approvalStatus: rawApproval, // Original approval_status value.
    authorizationState: rawAuthState, // Original authorization_state value.
    displayStatus: rawDisplayStatus, // Original display_status value.
    rawSeverity: rawSeverity, // Original severity value.
  });
};

// ---------------------------------------------------------------------------
// Batch helper for arrays of VHC rows
// ---------------------------------------------------------------------------

export const resolveVhcItemStates = (rows = []) => { // Map an array of raw DB rows to canonical state objects.
  return (rows || []).map(resolveVhcItemState); // Apply the resolver to each row.
};

// ---------------------------------------------------------------------------
// Convenience: build the DB fields for a decision transition
// ---------------------------------------------------------------------------

/**
 * Given a target decision, build the DB update payload for approval_status,
 * authorization_state, and display_status.
 *
 * Does NOT set approved_at/approved_by — the caller owns timestamps.
 * Does NOT set severity — that is set on creation only.
 *
 * @param {string} targetDecision - The desired decision value.
 * @param {object} options
 * @param {string|null} options.currentSeverity - The row's severity for display_status fallback.
 * @param {string|null} options.displayStatusOverride - Explicit display_status if provided by caller.
 * @returns {object} Partial DB update payload (snake_case keys).
 */
export const buildDecisionUpdatePayload = (targetDecision, { currentSeverity = null, displayStatusOverride = null } = {}) => { // Build DB fields for a decision change.
  const decision = normalizeDecision(targetDecision); // Normalize the target.
  if (!decision) return {}; // Invalid target — return empty.

  const payload = { // Start building the update payload.
    approval_status: decision, // Always set canonical decision.
    authorization_state: decision === DECISION.PENDING ? DECISION.PENDING : decision, // Mirror for workflow.
  };

  // Resolve display_status.
  if (displayStatusOverride !== undefined && displayStatusOverride !== null) { // Caller provided explicit override.
    const normalizedOverride = normalizeDecision(displayStatusOverride) || normalizeSeverity(displayStatusOverride) || displayStatusOverride; // Normalize.
    payload.display_status = normalizedOverride; // Use it.
  } else if (decision === DECISION.AUTHORIZED) { // Auto-set for authorization.
    payload.display_status = DECISION.AUTHORIZED; // Show "authorized".
  } else if (decision === DECISION.DECLINED) { // Auto-set for declination.
    payload.display_status = DECISION.DECLINED; // Show "declined".
  } else if (decision === DECISION.COMPLETED) { // Auto-set for completion.
    payload.display_status = DECISION.COMPLETED; // Show "completed".
  } else if (decision === DECISION.PENDING) { // Reverting to pending.
    const fallbackColor = normalizeSeverity(currentSeverity); // Try to restore severity color.
    payload.display_status = fallbackColor ?? null; // Restore or null.
  } else if (decision === DECISION.NA) { // Not applicable.
    payload.display_status = null; // Clear display_status.
  }

  return payload; // Return the partial update.
};
