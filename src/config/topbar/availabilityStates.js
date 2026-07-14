// file location: src/config/topbar/availabilityStates.js
//
// THE COLLABORATIVE-WORKSPACE AVAILABILITY REGISTRY (Phase 4.2) — PURE.
//
// One source of truth for every operational availability state a staff member can
// be in on the shared team-presence surfaces (Phase 4.1 presence, 4.3 activity,
// 4.6 manager tools). No React/window/storage — deterministic and unit-testable.
//
// Each state is deliberately generic so any department can reuse it: workshop
// "road test" / "maintenance", service "with a customer", parts "on a delivery",
// etc. The label is the display string; `available` marks states that count as
// "free to take work" (drives the presence "available" headline + manager
// workload balancing); `tone` maps to the shared status colours (no new tokens);
// `working` marks actively-on-a-task states (distinct from idle-but-present).
//
// HOW TO ADD A STATE (no chrome edit): add an entry to AVAILABILITY_STATES.
// Consumers key off `id`, so the presence panel, activity feed and manager tools
// all pick it up automatically.

// tone values reuse the existing status palette used across the workspace panel /
// notifications: "success" (free/positive), "info" (neutral-active), "warning"
// (occupied/attention), "danger" (blocked), "neutral" (offline/unknown).
export const AVAILABILITY_STATES = [
  {
    id: "available",
    label: "Available",
    short: "Available",
    icon: "🟢",
    tone: "success",
    available: true,
    working: false,
    order: 10,
  },
  {
    id: "working",
    label: "Working",
    short: "Working",
    icon: "🔧",
    tone: "info",
    available: false,
    working: true,
    order: 20,
  },
  {
    id: "busy",
    label: "Busy",
    short: "Busy",
    icon: "⏳",
    tone: "warning",
    available: false,
    working: true,
    order: 30,
  },
  {
    id: "road-test",
    label: "On a road test",
    short: "Road test",
    icon: "🚗",
    tone: "info",
    available: false,
    working: true,
    order: 40,
  },
  {
    id: "training",
    label: "In training",
    short: "Training",
    icon: "🎓",
    tone: "info",
    available: false,
    working: false,
    order: 50,
  },
  {
    id: "maintenance",
    label: "Workshop maintenance",
    short: "Maintenance",
    icon: "🛠",
    tone: "warning",
    available: false,
    working: true,
    order: 60,
  },
  {
    id: "break",
    label: "On a break",
    short: "On break",
    icon: "☕",
    tone: "warning",
    available: false,
    working: false,
    order: 70,
  },
  {
    id: "other",
    label: "Other duties",
    short: "Other",
    icon: "📋",
    tone: "info",
    available: false,
    working: false,
    order: 80,
  },
  {
    id: "offline",
    label: "Offline",
    short: "Offline",
    icon: "⚪",
    tone: "neutral",
    available: false,
    working: false,
    order: 90,
    offline: true,
  },
];

const BY_ID = new Map(AVAILABILITY_STATES.map((s) => [s.id, s]));

// The default state assumed when a present staff member has declared nothing and
// no live signal (clocking) says otherwise — they're on shift and free.
export const DEFAULT_AVAILABILITY_ID = "available";
// The state used when someone is not on shift / not present at all.
export const OFFLINE_AVAILABILITY_ID = "offline";

export function getAvailabilityState(id) {
  return BY_ID.get(id) || null;
}

// Resolve any id (unknown/empty included) to a concrete state descriptor, never
// null — so consumers can render without guarding.
export function resolveAvailabilityState(id) {
  return BY_ID.get(id) || BY_ID.get(DEFAULT_AVAILABILITY_ID);
}

export function isAvailableState(id) {
  return Boolean(BY_ID.get(id)?.available);
}

export function isPresentState(id) {
  const state = BY_ID.get(id);
  return Boolean(state) && !state.offline;
}

// The states a user may explicitly self-declare (excludes the derived-only
// "offline"), ordered for a picker. "working" is included but is normally set
// automatically from live clocking — a user can still pick it manually.
export function selectableStates() {
  return AVAILABILITY_STATES.filter((s) => !s.offline).sort((a, b) => a.order - b.order);
}

// Map a legacy job-status string (from UserContext / job clocking sync — e.g.
// "In Progress", "Tea Break", "Waiting for Job") onto an availability id, so the
// presence layer stays consistent with the technician status the app already
// tracks. Returns null when there's no sensible mapping (caller falls back).
const LEGACY_STATUS_MAP = {
  "in progress": "working",
  "on job": "working",
  "tea break": "break",
  break: "break",
  "on break": "break",
  "waiting for job": "available",
  available: "available",
  "road test": "road-test",
  training: "training",
  maintenance: "maintenance",
};

export function availabilityFromLegacyStatus(status) {
  if (!status || typeof status !== "string") return null;
  return LEGACY_STATUS_MAP[status.trim().toLowerCase()] || null;
}
