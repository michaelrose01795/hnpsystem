// file location: src/lib/auth/serviceActionRoles.js
// Single source of truth for service job actions. The general create-job
// roles still drive topbar/page access; customer booking requests use the
// narrower service-only list below.

export const SERVICE_ACTION_ROLES = [
  "service",
  "service department",
  "service advisor",
  "service dept",
  "service manager",
  "workshop manager",
  "after sales manager",
  "after sales director",
  "aftersales manager",
];

export const SERVICE_ACTION_ROLE_SET = new Set(SERVICE_ACTION_ROLES);

export const CUSTOMER_BOOKING_REQUEST_ROLES = [
  "service",
];

export const CUSTOMER_BOOKING_REQUEST_ROLE_SET = new Set(CUSTOMER_BOOKING_REQUEST_ROLES);

// The All Access demo login satisfies both gates. Declared inline rather than
// imported from @/lib/auth/roles: this module is pulled into the workspace
// manifest, which is reachable from the edge proxy, so it stays dependency-free.
const ALL_ACCESS = "all access";
const holdsAllAccess = (list) =>
  list.some((role) => String(role || "").toLowerCase().trim() === ALL_ACCESS);

export const hasServiceActionAccess = (roles) => {
  if (!roles) return false;
  const list = Array.isArray(roles) ? roles : [roles];
  if (holdsAllAccess(list)) return true;
  return list.some((role) =>
    SERVICE_ACTION_ROLE_SET.has(String(role || "").toLowerCase()),
  );
};

export const hasCustomerBookingRequestAccess = (roles) => {
  if (!roles) return false;
  const list = Array.isArray(roles) ? roles : [roles];
  if (holdsAllAccess(list)) return true;
  return list.some((role) =>
    CUSTOMER_BOOKING_REQUEST_ROLE_SET.has(String(role || "").toLowerCase()),
  );
};
