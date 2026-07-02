// file location: src/components/dev-platform/devPlatformNav.js
//
// Phase 8 — Developer Platform navigation model. Single source of truth for the
// platform's areas, consumed by DevPlatformLayout (nav rail) and the /dev home
// (tile grid). Adding a future platform surface is a one-line entry here.
//
// Each item: { key, label, href, description }. `key` matches the
// `activeKey` a page passes to withDevPlatformLayout() so the rail highlights
// the current area. (Icons/emojis intentionally dropped — labels only.)

export const DEV_PLATFORM_NAV = [
  {
    key: "home",
    label: "Home",
    href: "/dev",
    description: "Developer Platform overview and quick links.",
  },
  {
    key: "live-ops",
    label: "Live Operations",
    href: "/dev/live-ops",
    description: "Real-time diagnostics, runtime events and service status.",
  },
  {
    key: "health",
    label: "Application Health",
    href: "/dev/health",
    description: "Subsystem health roll-up: sanitiser, database, storage, RLS, build.",
  },
  {
    key: "intelligence",
    label: "Intelligence",
    href: "/dev/intelligence",
    description: "Problem areas, incident clusters, trends and predictive insights.",
  },
  {
    key: "releases",
    label: "Releases",
    href: "/dev/releases",
    description: "Deployment timeline, release quality, regression tracking and auto-reopen.",
  },
  {
    key: "ownership",
    label: "Code Ownership",
    href: "/dev/ownership",
    description: "Ownership explorer, module impact and route/module dependency map.",
  },
  {
    key: "performance",
    label: "Performance",
    href: "/dev/performance",
    description: "Frontend timing, API request tracing and execution flow.",
  },
  {
    key: "readiness",
    label: "Deployment Readiness",
    href: "/dev/readiness",
    description: "Per-release readiness scoring and release approval gate.",
  },
  {
    key: "productivity",
    label: "Productivity",
    href: "/dev/productivity",
    description: "Engineering throughput, resolution time and backlog metrics.",
  },
  {
    key: "support",
    label: "Support",
    href: "/dev/support",
    description: "Support reports, investigations, health, notifications, activity and settings — grouped into tabs.",
  },
  {
    key: "saved-views",
    label: "Saved Views",
    href: "/dev/saved-views",
    description: "Your personal and shared team workspaces.",
  },
  {
    key: "knowledge",
    label: "Knowledge Centre",
    href: "/dev/knowledge",
    description: "Recurring incidents, fixes and previous investigations.",
  },
  {
    key: "activity",
    label: "Activity & Audit",
    href: "/dev/activity",
    description: "Hash-chained developer action log and audit coverage.",
  },
  {
    key: "plugins",
    label: "Plugins",
    href: "/dev/plugins",
    description: "Registered diagnostic, investigation and tool extensions.",
  },
  {
    key: "notifications",
    label: "Notifications",
    href: "/dev/notifications",
    description: "Notification history and subscription rules.",
  },
  {
    key: "preferences",
    label: "Preferences",
    href: "/dev/preferences",
    description: "Developer and notification preferences.",
  },
];

export function getDevPlatformNavItem(key) {
  return DEV_PLATFORM_NAV.find((item) => item.key === key) || null;
}

// ---------------------------------------------------------------------------
// Two-level navigation model. The 16 areas above are grouped into a small set
// of top-level CATEGORIES (kept at <= 9 so the top tab row always fits one
// screen). DevPlatformTabs renders the category row on top; the second row
// shows the sub-areas of the active category. `children` are area `key`s from
// DEV_PLATFORM_NAV, in display order. `home` is a single-area category (it
// renders no sub-row).
// ---------------------------------------------------------------------------
export const DEV_PLATFORM_GROUPS = [
  { key: "home", label: "Home", children: ["home"] },
  { key: "operations", label: "Operations", children: ["live-ops", "health", "performance"] },
  { key: "intelligence", label: "Intelligence", children: ["intelligence", "ownership", "knowledge"] },
  { key: "releases", label: "Releases", children: ["releases", "readiness", "productivity"] },
  { key: "support", label: "Support", children: ["support", "saved-views", "activity"] },
  { key: "settings", label: "Settings", children: ["plugins", "notifications", "preferences"] },
];

// Resolve the nav items (in order) for a category group.
export function getDevPlatformGroupChildren(group) {
  if (!group) return [];
  return group.children.map((key) => getDevPlatformNavItem(key)).filter(Boolean);
}

// Find the category group that owns a given area `key` (e.g. "performance" ->
// the "operations" group). Returns null if the key is unknown.
export function getDevPlatformGroupForAreaKey(areaKey) {
  if (!areaKey) return null;
  return DEV_PLATFORM_GROUPS.find((group) => group.children.includes(areaKey)) || null;
}
