// file location: src/components/dev-platform/devPlatformNav.js
//
// Phase 8 — Developer Platform navigation model. Single source of truth for the
// platform's areas, consumed by DevPlatformLayout (nav rail) and the /dev home
// (tile grid). Adding a future platform surface is a one-line entry here.
//
// Each item: { key, label, href, icon, description }. `key` matches the
// `activeKey` a page passes to withDevPlatformLayout() so the rail highlights
// the current area.

export const DEV_PLATFORM_NAV = [
  {
    key: "home",
    label: "Home",
    href: "/dev",
    icon: "🏠",
    description: "Developer Platform overview and quick links.",
  },
  {
    key: "live-ops",
    label: "Live Operations",
    href: "/dev/live-ops",
    icon: "📡",
    description: "Real-time diagnostics, runtime events and service status.",
  },
  {
    key: "health",
    label: "Application Health",
    href: "/dev/health",
    icon: "🩺",
    description: "Subsystem health roll-up: sanitiser, database, storage, RLS, build.",
  },
  {
    key: "intelligence",
    label: "Intelligence",
    href: "/dev/intelligence",
    icon: "🧠",
    description: "Problem areas, incident clusters, trends and predictive insights.",
  },
  {
    key: "releases",
    label: "Releases",
    href: "/dev/releases",
    icon: "🚀",
    description: "Deployment timeline, release quality, regression tracking and auto-reopen.",
  },
  {
    key: "ownership",
    label: "Code Ownership",
    href: "/dev/ownership",
    icon: "🗺️",
    description: "Ownership explorer, module impact and route/module dependency map.",
  },
  {
    key: "performance",
    label: "Performance",
    href: "/dev/performance",
    icon: "⚡",
    description: "Frontend timing, API request tracing and execution flow.",
  },
  {
    key: "support",
    label: "Support Centre",
    href: "/dev/support-reports",
    icon: "🛟",
    description: "Triage and investigate Help & Diagnostics reports.",
  },
  {
    key: "saved-views",
    label: "Saved Views",
    href: "/dev/saved-views",
    icon: "🔖",
    description: "Your personal and shared team workspaces.",
  },
  {
    key: "preferences",
    label: "Preferences",
    href: "/dev/preferences",
    icon: "⚙️",
    description: "Developer and notification preferences.",
  },
];

export function getDevPlatformNavItem(key) {
  return DEV_PLATFORM_NAV.find((item) => item.key === key) || null;
}
