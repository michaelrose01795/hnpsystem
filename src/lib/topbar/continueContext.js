// file location: src/lib/topbar/continueContext.js
//
// Continue-Where-You-Left-Off (Phase 2.3) — pure classification of a route into
// a resumable "work item". The hook (src/hooks/useContinueContext.js) records
// these as the user navigates and surfaces the most recent one as a "Resume"
// affordance in the top bar.
//
// PURE — no React, no storage, no window. Deterministic and unit-testable.
//
// HOW TO ADD A SUPPORTED WORKFLOW: add a rule to RESUMABLE_RULES. The type is
// used for the chip label prefix and grouping; nothing in the top bar component
// needs to change.

// Ordered, first-match-wins. Each rule maps a path prefix to a workflow type and
// an optional label refiner. `base` is the path with query/hash stripped.
const RESUMABLE_RULES = [
  {
    type: "Job card",
    test: (p) => /^\/(new-job|job-cards|jobcards|tech)(\/|$)/.test(p),
  },
  { type: "Report", test: (p) => /^\/reports(\/|$)/.test(p) },
  { type: "Customer", test: (p) => /^\/customers(\/|$)/.test(p) },
  {
    type: "Parts order",
    test: (p) => /^\/(new-order|goods-in|delivery-planner|parts)(\/|$)/.test(p),
  },
  { type: "Search", test: (p) => /^\/search(\/|$)/.test(p) },
];

function titleCaseSegment(segment) {
  return String(segment || "")
    .replace(/\[|\]/g, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Build a short, human label for the resumed item from its path. Keeps the last
// meaningful segment (or a job/order id) rather than the whole route.
function deriveLabel(base, type) {
  const segments = base.split("/").filter(Boolean);
  if (segments.length === 0) return type;
  const last = segments[segments.length - 1];
  // A trailing id-ish segment (job number, slug) reads better with its parent.
  const looksLikeId = /^[0-9]+$/.test(last) || (segments.length > 1 && last.length <= 24);
  if (looksLikeId && segments.length > 1) {
    if (type === "Job card" && /^[0-9]+$/.test(last)) return `Job ${last}`;
    return `${titleCaseSegment(segments[segments.length - 2])}: ${titleCaseSegment(last)}`;
  }
  return titleCaseSegment(last) || type;
}

// Given a full asPath (may include query/hash), return a resumable entry or null
// when the route is not a supported workflow. `ts` is injected by the caller
// (pure module — no clock access) so results stay deterministic in tests.
export function resolveResumable(asPath, ts = 0) {
  if (!asPath || typeof asPath !== "string") return null;
  const base = asPath.split("?")[0].split("#")[0];
  if (!base || base === "/") return null;
  const rule = RESUMABLE_RULES.find((r) => r.test(base));
  if (!rule) return null;
  return {
    id: asPath, // dedupe on the full path (incl. query) so distinct searches differ
    href: asPath,
    type: rule.type,
    label: deriveLabel(base, rule.type),
    ts,
  };
}

// Is `asPath` the same underlying item as a stored entry? Used to hide the
// "Resume" chip when the user is already on that item.
export function isSamePath(asPath, entry) {
  if (!asPath || !entry?.href) return false;
  return asPath.split("#")[0] === entry.href.split("#")[0];
}
