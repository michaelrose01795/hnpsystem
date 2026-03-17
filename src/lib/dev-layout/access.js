// file location: src/lib/dev-layout/access.js
const DEFAULT_DEV_LAYOUT_ROLES = [
  "admin",
  "admin manager",
  "workshop manager",
  "service manager",
  "after sales manager",
  "after sales director",
  "valet service",
  "developer",
  "dev",
];

export const DEV_LAYOUT_ALLOWED_ROLES = new Set(DEFAULT_DEV_LAYOUT_ROLES);

export function canUseDevLayoutOverlay(user) {
  if (!user) return false;

  const devBypassEnabled = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
  const envAllows =
    process.env.NODE_ENV !== "production" ||
    devBypassEnabled ||
    process.env.NEXT_PUBLIC_ENABLE_DEV_LAYOUT_OVERLAY === "true";

  if (!envAllows) return false;

  const roleValues = Array.isArray(user.roles)
    ? user.roles
    : user.role
    ? [user.role]
    : [];

  const normalizedRoles = roleValues
    .map((role) => String(role || "").trim().toLowerCase())
    .filter(Boolean);

  return normalizedRoles.some((role) => {
    if (DEV_LAYOUT_ALLOWED_ROLES.has(role)) return true;
    return role.includes("admin") || role.includes("manager") || role.includes("dev");
  });
}

