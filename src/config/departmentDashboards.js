import { WORKSPACE_DASHBOARD_SHORTCUTS } from "@/config/workspace/departments";

export const departmentDashboardShortcuts = WORKSPACE_DASHBOARD_SHORTCUTS.map((shortcut) => ({
  label: shortcut.label,
  href: shortcut.href,
  roles: shortcut.roles,
  description: shortcut.description,
}));
