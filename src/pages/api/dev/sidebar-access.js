// file location: src/pages/api/dev/sidebar-access.js
// Dev-only batch assignment endpoint for one sidebar group.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import {
  listAdminUsers,
  updateAdminUserSidebarAccess,
} from "@/lib/database/adminUsers";
import {
  applySidebarGroupUserSelection,
  getSidebarAccessGroup,
  isSidebarGroupEnabled,
  materializeSidebarAccess,
} from "@/lib/sidebarAccess";

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
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
    const users = await listAdminUsers();
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
  } catch (error) {
    console.error("/api/dev/sidebar-access error", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update sidebar access",
    });
  }
}

export default withRoleGuard(handler, { allow: DEV_PLATFORM_ROLES });
