const DESCRIPTIVE_ROUTE_DESTINATIONS = Object.freeze([
  [/^any staff route/i, "/"],
  [/^developer platform routes$/i, "/dev"],
  [/^workshop clocking-card consumers$/i, "/workshop"],
  [/^shared topbar and confirmation flows$/i, "/"],
  [/^invoice builder and global next-action prompt$/i, "/new-order"],
  [/^report utility tabs and topbar tools$/i, "/reports/overview"],
  [/^invoice consumers$/i, "/accounts/invoices"],
]);

const DYNAMIC_ROUTE_DESTINATIONS = Object.freeze({
  "/mobile/delivery/[jobNumber]": "/mobile/dashboard",
});

function firstAuditedPath(routeDescription) {
  return String(routeDescription || "").match(/\/[A-Za-z0-9_[\]-]+(?:\/[A-Za-z0-9_[\]-]+)*/)?.[0] || null;
}

function nearestNavigableRoute(auditedPath) {
  if (!auditedPath) return null;
  if (DYNAMIC_ROUTE_DESTINATIONS[auditedPath]) return DYNAMIC_ROUTE_DESTINATIONS[auditedPath];

  const destination = auditedPath.replace(/\/\[[^/]+\]/g, "");
  return destination || "/";
}

export function resolveStaffStyleReviewRoute(routeDescription) {
  const auditedPath = firstAuditedPath(routeDescription);
  if (auditedPath) return nearestNavigableRoute(auditedPath);

  const normalized = String(routeDescription || "").trim();
  const mapped = DESCRIPTIVE_ROUTE_DESTINATIONS.find(([pattern]) => pattern.test(normalized));
  return mapped?.[1] || null;
}

const SOURCE_REFERENCE_PATTERN = /^src\/[A-Za-z0-9_\-./[\]]+\.(?:jsx?|tsx?):\d+$/i;

/**
 * "Search" link for the review popup: the audited route plus the handshake that
 * StaffStyleReviewHighlighter (mounted in _app.js) reads to ring the offending
 * element — the audit ID, the item name for the label, and the `file:line`
 * source reference it resolves into locator hints.
 */
export function buildStaffStyleReviewItemLink(finding) {
  const pathname = resolveStaffStyleReviewRoute(finding?.route);
  if (!pathname) return null;

  const query = { styleReviewHighlight: String(finding.auditId ?? "") };
  if (finding.sectionName) query.styleReviewItem = finding.sectionName;
  const reference = (finding.lineReferences || []).find((entry) => SOURCE_REFERENCE_PATTERN.test(String(entry)));
  if (reference) query.styleReviewSource = reference;

  return { pathname, query };
}

