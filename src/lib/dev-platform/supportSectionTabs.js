// file location: src/lib/dev-platform/supportSectionTabs.js
//
// Phase 11 — Support hub tab model. Single source of truth for the top-left
// in-page tabs on /dev/support, consumed by SupportHub (tab bar + active
// section) and SupportOverviewSection (jump tiles). Pure + data-only so the
// grouping is unit-testable without rendering.
//
// Each tab: { key, label, description }. `key` is used in the ?tab=
// query param (validated with isSupportSectionTab) and as the React key.
// (Icons/emojis intentionally dropped — labels only.)

export const SUPPORT_SECTION_TABS = Object.freeze([
  {
    key: "overview",
    label: "Overview",
    description: "Support hub summary and quick links.",
  },
  {
    key: "reports",
    label: "Reports",
    description: "Triage and investigate Help & Diagnostics reports.",
  },
  {
    key: "investigations",
    label: "Investigations",
    description: "Problem areas, incident clusters, trends and predictive insights.",
  },
  {
    key: "health",
    label: "Health",
    description: "Subsystem health roll-up: sanitiser, database, storage, RLS, build.",
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "Notification history and subscription rules.",
  },
  {
    key: "activity",
    label: "Activity",
    description: "Hash-chained developer action log and audit coverage.",
  },
  {
    key: "settings",
    label: "Settings",
    description: "Developer and notification preferences.",
  },
]);

// The tab shown when no (valid) ?tab= is supplied.
export const DEFAULT_SUPPORT_TAB = "overview";

export function isSupportSectionTab(key) {
  return SUPPORT_SECTION_TABS.some((tab) => tab.key === key);
}

export function getSupportSectionTab(key) {
  return SUPPORT_SECTION_TABS.find((tab) => tab.key === key) || null;
}

// Coerce an arbitrary (untrusted) value to a valid tab key, falling back to the
// default. Used to read ?tab= safely.
export function resolveSupportTab(key) {
  return isSupportSectionTab(key) ? key : DEFAULT_SUPPORT_TAB;
}
