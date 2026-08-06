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

