// file location: src/lib/customers/customerAccess.js
//
// Who may do what on a customer record.
//
// Page-level access to /customers/[customerSlug] is already decided by
// src/config/routeAccess.js — anyone with job-card visibility can open a
// record. This module answers the second question: once the record is open,
// which actions and which data belong to the person looking at it.
//
// Every role string comes from src/lib/auth/roles.js (CLAUDE.md §6). The
// checks go through hasAnyRole, so the All Access demo login and any future
// role alias keep working without changes here.

import {
  ACCOUNTS_ROLES,
  ADMIN_ROLES,
  DEALERSHIP_MANAGER_ROLES,
  PARTS_DEPARTMENT_ROLES,
  RECEPTION_ROLES,
  SERVICE_DESK_ROLES,
  WORKSHOP_FLOOR_ROLES,
  hasAnyRole,
} from "@/lib/auth/roles";

// The desks that own the customer relationship: they book the work, take the
// call and keep the record correct.
const FRONT_OF_HOUSE_ROLES = Array.from(
  new Set([...RECEPTION_ROLES, ...SERVICE_DESK_ROLES])
);

// Anyone who is allowed to change what the record says about the customer.
const RECORD_EDITOR_ROLES = Array.from(
  new Set([...FRONT_OF_HOUSE_ROLES, ...DEALERSHIP_MANAGER_ROLES, ...ADMIN_ROLES])
);

// Money. Advisors need to see a balance to answer "what do I owe?", but only
// accounts, managers and admin may move it.
const FINANCE_VIEW_ROLES = Array.from(
  new Set([
    ...FRONT_OF_HOUSE_ROLES,
    ...ACCOUNTS_ROLES,
    ...DEALERSHIP_MANAGER_ROLES,
    ...ADMIN_ROLES,
  ])
);
const FINANCE_ACTION_ROLES = Array.from(
  new Set([...ACCOUNTS_ROLES, ...DEALERSHIP_MANAGER_ROLES, ...ADMIN_ROLES])
);

// Booking work in. Parts and the workshop floor read the record; they do not
// create jobs or move appointments from here.
const BOOKING_ROLES = Array.from(
  new Set([...FRONT_OF_HOUSE_ROLES, ...DEALERSHIP_MANAGER_ROLES, ...ADMIN_ROLES])
);

// Vehicle records are maintained by the desks and the workshop.
const VEHICLE_EDITOR_ROLES = Array.from(
  new Set([
    ...FRONT_OF_HOUSE_ROLES,
    ...WORKSHOP_FLOOR_ROLES,
    ...DEALERSHIP_MANAGER_ROLES,
    ...ADMIN_ROLES,
  ])
);

// The audit view (who changed what, portal sign-ins, delivery receipts) is a
// supervisory surface.
const AUDIT_ROLES = Array.from(
  new Set([...DEALERSHIP_MANAGER_ROLES, ...ADMIN_ROLES, ...ACCOUNTS_ROLES])
);

const PARTS_ROLES = Array.from(new Set(PARTS_DEPARTMENT_ROLES));

/**
 * Derive the capability set for a user on the customer record.
 *
 * @param {string[]} roles - user.roles from UserContext.
 * @returns {object} flat map of booleans; unknown/absent roles get the
 *                   read-only baseline rather than nothing, because everyone
 *                   who reached this page already passed the route guard.
 */
export function getCustomerRecordAccess(roles = []) {
  const canEditCustomer = hasAnyRole(roles, RECORD_EDITOR_ROLES);
  const canViewFinancials = hasAnyRole(roles, FINANCE_VIEW_ROLES);
  const canTakePayment = hasAnyRole(roles, FINANCE_ACTION_ROLES);
  const canBook = hasAnyRole(roles, BOOKING_ROLES);

  return {
    // Read
    canViewRecord: true,
    canViewFinancials,
    canViewAudit: hasAnyRole(roles, AUDIT_ROLES),
    canViewParts: hasAnyRole(roles, PARTS_ROLES),

    // Write — customer details
    canEditCustomer,
    canEditContactPreference: canEditCustomer,
    canManageVehicles: hasAnyRole(roles, VEHICLE_EDITOR_ROLES),

    // Write — work
    canCreateJob: canBook,
    canBookAppointment: canBook,

    // Write — money
    canTakePayment,
    canIssueInvoice: canTakePayment,
    canIssueRefund: hasAnyRole(roles, [...ACCOUNTS_ROLES, ...ADMIN_ROLES]),

    // Everyone who can open the record can log that they spoke to the customer;
    // an accurate contact log depends on it being frictionless.
    canAddNote: true,
    canMessageCustomer: true,
  };
}

/**
 * The read-only baseline, for render paths that run before roles resolve.
 * Nothing that writes is enabled.
 */
export const READ_ONLY_CUSTOMER_ACCESS = Object.freeze({
  canViewRecord: true,
  canViewFinancials: false,
  canViewAudit: false,
  canViewParts: false,
  canEditCustomer: false,
  canEditContactPreference: false,
  canManageVehicles: false,
  canCreateJob: false,
  canBookAppointment: false,
  canTakePayment: false,
  canIssueInvoice: false,
  canIssueRefund: false,
  canAddNote: false,
  canMessageCustomer: false,
});
