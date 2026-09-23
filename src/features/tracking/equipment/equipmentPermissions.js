// file location: src/features/tracking/equipment/equipmentPermissions.js
//
// What each role may do in the Equipment/Tools tracker. The role groups live in
// src/lib/auth/roles.js; this only maps them to actions, and it is the single
// mapping used by the page (which buttons to show) and by every
// /api/tracking/equipment route (what to accept). hasAnyRole() already lets the
// All Access demo login through.

import { EQUIPMENT_MANAGER_ROLES, EQUIPMENT_USER_ROLES, hasAnyRole } from "@/lib/auth/roles";

export const NO_EQUIPMENT_CAPABILITIES = Object.freeze({
  view: false,
  check: false,
  reportFault: false,
  uploadPhotos: false,
  manage: false,
  bulkCheck: false,
  manageFaults: false,
  manageDocuments: false,
  manageChecklists: false,
  recordMaintenance: false,
  retire: false,
});

export function resolveEquipmentCapabilities(userRoles = []) {
  const isUser = hasAnyRole(userRoles, EQUIPMENT_USER_ROLES);
  const isManager = hasAnyRole(userRoles, EQUIPMENT_MANAGER_ROLES);
  if (!isUser && !isManager) return NO_EQUIPMENT_CAPABILITIES;
  return Object.freeze({
    // Technicians, MOT testers, parts, valeting and managers.
    view: true,
    check: true,
    reportFault: true,
    uploadPhotos: true,
    // Managers and admins only.
    manage: isManager,
    bulkCheck: isManager,
    manageFaults: isManager,
    manageDocuments: isManager,
    manageChecklists: isManager,
    recordMaintenance: isManager,
    retire: isManager,
  });
}

// withRoleGuard `authorize` callbacks, one per capability.
export const authorizeEquipment = (capability) => (roles) =>
  Boolean(resolveEquipmentCapabilities(roles)[capability]);
