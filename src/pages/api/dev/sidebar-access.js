// file location: src/pages/api/dev/sidebar-access.js
// Dev-only endpoint for staff sidebar layout previews and per-user overrides.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import {
  listAdminUsers,
  updateAdminUserSidebarAccess,
} from "@/lib/database/adminUsers";
import {
  applySidebarGroupUserSelection,
  applySidebarModuleLayout,
  applySidebarPagePlacements,
  createSidebarAccessFromRole,
  getSidebarAccessGroup,
  isSidebarGroupEnabled,
  materializeSidebarAccess,
} from "@/lib/sidebarAccess";

const findUser = (users, userId) => {
  const numericUserId = Number(userId);
  if (!Number.isInteger(numericUserId) || numericUserId <= 0) return null;
  return users.find((user) => user.id === numericUserId) || null;
};

async function updateSingleUser(req, res, users) {
  const action = String(req.body?.action || "").trim();
  const user = findUser(users, req.body?.userId);
  if (!user) {
    return res.status(400).json({ success: false, message: "Unknown user" });
  }

  let sidebarAccess;
  if (action === "restore-default") {
    sidebarAccess = null;
  } else if (action === "copy-role") {
    const sourceRole = String(req.body?.sourceRole || user.role || "").trim();
    sidebarAccess = createSidebarAccessFromRole(sourceRole);
  } else if (action === "save-layout") {
    sidebarAccess = applySidebarModuleLayout({
      role: user.role,
      currentValue: user.sidebarAccess,
      sourceRole: req.body?.sourceRole || user.sidebarAccess?.sourceRole || user.role,
      modules: req.body?.modules,
    });
  } else if (action === "save-page-placements") {
    sidebarAccess = applySidebarPagePlacements({
      role: user.role,
      currentValue: user.sidebarAccess,
      pagePlacements: req.body?.pagePlacements,
    });
  } else {
    return res.status(400).json({ success: false, message: "Unknown sidebar action" });
  }

  await updateAdminUserSidebarAccess(user.id, sidebarAccess);
  const refreshedUsers = await listAdminUsers();
  return res.status(200).json({
    success: true,
    updatedCount: 1,
    data: refreshedUsers,
  });
}

async function updateGroupAssignments(req, res, users) {
  const groupKey = String(req.body?.groupKey || "").trim();
  const group = getSidebarAccessGroup(groupKey);
  if (!group) {
    return res.status(400).json({ success: false, message: "Unknown sidebar group" });
  }

  const assignments = new Map();
  for (const assignment of Array.isArray(req.body?.assignments) ? req.body.assignments : []) {
    const userId = Number(assignment?.userId);
    if (!Number.isInteger(userId) || userId <= 0) continue;
    assignments.set(userId, Array.isArray(assignment?.itemHrefs) ? assignment.itemHrefs : []);
  }
  const requestedOrder = Array.isArray(req.body?.itemOrder) ? req.body.itemOrder : [];
  const updates = [];

  for (const user of users) {
    const shouldEnable = assignments.has(user.id);
    const isEnabled = isSidebarGroupEnabled(user.role, user.sidebarAccess, groupKey);
    const groupHrefSet = new Set(group.items.map((item) => item.href));
    const currentSnapshot = materializeSidebarAccess(user.role, user.sidebarAccess);
    const currentItems = currentSnapshot.items.filter((href) => groupHrefSet.has(href));
    const requestedItems = shouldEnable ? assignments.get(user.id) : [];
    const currentOrder = user.sidebarAccess?.itemOrder?.[groupKey] ||
      group.items.map((item) => item.href);
    const orderChanged =
      shouldEnable && JSON.stringify(currentOrder) !== JSON.stringify(requestedOrder);
    const selectionChanged =
      shouldEnable &&
      JSON.stringify([...currentItems].sort()) !== JSON.stringify([...requestedItems].sort());
    if (isEnabled === shouldEnable && !orderChanged && !selectionChanged) continue;

    const sidebarAccess = applySidebarGroupUserSelection({
      role: user.role,
      currentValue: user.sidebarAccess,
      groupKey,
      enabled: shouldEnable,
      selectedItemHrefs: requestedItems,
      itemOrder: requestedOrder,
    });
    updates.push(updateAdminUserSidebarAccess(user.id, sidebarAccess));
  }

  await Promise.all(updates);
  const refreshedUsers = await listAdminUsers();
  return res.status(200).json({
    success: true,
    updatedCount: updates.length,
    data: refreshedUsers,
  });
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const users = await listAdminUsers();
    const action = String(req.body?.action || "").trim();
    if (action) {
      return updateSingleUser(req, res, users);
    }
    return updateGroupAssignments(req, res, users);
  } catch (error) {
    console.error("/api/dev/sidebar-access error", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update sidebar access",
    });
  }
}

export default withRoleGuard(handler, { allow: DEV_PLATFORM_ROLES });
