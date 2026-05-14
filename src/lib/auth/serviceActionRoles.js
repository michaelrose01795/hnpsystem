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

export const hasServiceActionAccess = (roles) => {
  if (!roles) return false;
  const list = Array.isArray(roles) ? roles : [roles];
  return list.some((role) =>
    SERVICE_ACTION_ROLE_SET.has(String(role || "").toLowerCase()),
  );
};

export const hasCustomerBookingRequestAccess = (roles) => {
  if (!roles) return false;
  const list = Array.isArray(roles) ? roles : [roles];
  return list.some((role) =>
    CUSTOMER_BOOKING_REQUEST_ROLE_SET.has(String(role || "").toLowerCase()),
  );
};
