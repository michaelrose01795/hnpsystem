// file location: src/lib/auth/serviceActionRoles.js
// Single source of truth for which staff roles see the "Create Job Card"
// shortcut in the topbar. Used by the Layout (visibility), the
// customer-requests inbox in /messages (card visibility), and the
// customer-requests API endpoints (server-side role guard).

export const SERVICE_ACTION_ROLES = [
  "service",
  "service department",
  "service dept",
  "service manager",
  "workshop manager",
  "after sales manager",
  "after sales director",
  "aftersales manager",
];

export const SERVICE_ACTION_ROLE_SET = new Set(SERVICE_ACTION_ROLES);

export const hasServiceActionAccess = (roles) => {
  if (!roles) return false;
  const list = Array.isArray(roles) ? roles : [roles];
  return list.some((role) =>
    SERVICE_ACTION_ROLE_SET.has(String(role || "").toLowerCase()),
  );
};
