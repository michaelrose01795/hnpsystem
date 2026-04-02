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
  return Boolean(user);
}
