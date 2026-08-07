// file location: src/lib/staff-style-review/reviewContext.js
//
// Hand-off between the Staff Style Review popup and the audited page.
//
// "Search / View Item" navigates away from /dev/staff-style-review, so the
// finding itself has to travel with the reviewer. The URL only carries enough
// to run the highlight (audit ID + source reference); this module parks the
// full finding in sessionStorage so the floating review command panel can show
// route, section, how-to-see-it, rationale and the generated Codex prompt on
// the audited page — without going back to the popup and reloading.
//
// sessionStorage (not localStorage): the context belongs to one review session
// in one tab and must not leak into a later, unrelated visit.

import { HIGHLIGHT_STORAGE_KEY } from "@/lib/staff-style-review/highlightLocator";

export const REVIEW_CONTEXT_STORAGE_KEY = HIGHLIGHT_STORAGE_KEY;
// Same-tab writes do not fire `storage`, so the writer emits this instead.
export const REVIEW_CONTEXT_EVENT = "hnp:staff-style-review-context";

// Only the fields the command panel and the highlighter actually render are
// stored, so a schema change on the audit table cannot bloat sessionStorage.
const CONTEXT_FIELDS = Object.freeze([
  "id",
  "auditId",
  "originalAuditId",
  "category",
  "type",
  "route",
  "sectionName",
  "visibilityInstructions",
  "issueSummary",
  "sourceReference",
  "lineReferences",
  "recommendation",
  "reviewStatus",
  "reviewNotes",
  "partialAdoption",
  "partialAdoptionNotes",
  "specialistExceptionNotes",
]);

function announce() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REVIEW_CONTEXT_EVENT));
}

export function buildReviewContext(finding, { destination = null, reviewNotes = null } = {}) {
  if (!finding) return null;
  const context = {};
  for (const field of CONTEXT_FIELDS) {
    if (finding[field] !== undefined) context[field] = finding[field];
  }
  if (reviewNotes !== null) context.reviewNotes = reviewNotes;
  context.destination = destination;
  return context;
}

/** Park the finding for the audited page. Called just before navigating. */
export function storeReviewContext(context) {
  if (typeof window === "undefined" || !context) return;
  try {
    window.sessionStorage.setItem(REVIEW_CONTEXT_STORAGE_KEY, JSON.stringify(context));
  } catch {
    // Private-mode / quota failures only cost the panel its content, not the highlight.
  }
  announce();
}

export function readReviewContext() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(REVIEW_CONTEXT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && parsed.auditId ? parsed : null;
  } catch {
    return null;
  }
}

/** Reviewer finished with this finding — the floating panel disappears. */
export function clearReviewContext() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(REVIEW_CONTEXT_STORAGE_KEY);
  } catch {
    // Nothing to do — the panel is being dismissed either way.
  }
  announce();
}
