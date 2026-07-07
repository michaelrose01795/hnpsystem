// file location: src/config/topbar/departmentActivity.js
//
// SHARED DEPARTMENT ACTIVITY (Phase 4.3) — PURE delta engine. The app has no
// activity-feed table, so a shared, honest feed is derived from movement between
// two consecutive operational snapshots (the same lean metrics Phase 2 already
// polls) plus the live presence signal (4.1): technicians becoming available,
// new appointments arriving, jobs completed / started, approvals waiting and
// workload moving through the queue.
//
// No React/window/storage; timestamps are passed in (the hook supplies `ts`) so
// the module stays deterministic and unit-testable. The hook
// (useDepartmentActivity) holds the previous snapshot and accumulates a capped,
// rolling feed from what this returns.
//
// An activity event:
//   { id, kind, tone, icon, text, href, ts }

// Metric movements worth announcing. `dir` is the direction that is newsworthy;
// `delta` is always the positive magnitude of the change.
const METRIC_SIGNALS = [
  {
    key: "techniciansAvailable",
    dir: "up",
    kind: "tech-available",
    tone: "success",
    icon: "🟢",
    href: "/nextjobs",
    text: (d) => `${d} technician${d === 1 ? "" : "s"} now free`,
  },
  {
    key: "appointmentsToday",
    dir: "up",
    kind: "appointment",
    tone: "info",
    icon: "📅",
    href: "/job-cards/appointments",
    text: (d) => `${d} new appointment${d === 1 ? "" : "s"} booked`,
  },
  {
    key: "jobsInProgress",
    dir: "down",
    kind: "job-complete",
    tone: "success",
    icon: "✅",
    href: "/job-cards",
    text: (d) => `${d} job${d === 1 ? "" : "s"} completed or moved on`,
  },
  {
    key: "jobsInProgress",
    dir: "up",
    kind: "job-start",
    tone: "info",
    icon: "🔧",
    href: "/job-cards",
    text: (d) => `${d} job${d === 1 ? "" : "s"} started`,
  },
  {
    key: "waitingApprovals",
    dir: "up",
    kind: "approval",
    tone: "warning",
    icon: "📝",
    href: "/job-cards",
    text: (d) => `${d} new approval${d === 1 ? "" : "s"} waiting`,
  },
  {
    key: "jobsWaiting",
    dir: "up",
    kind: "queue-up",
    tone: "warning",
    icon: "⏳",
    href: "/nextjobs",
    text: (d) => `${d} more job${d === 1 ? "" : "s"} joined the queue`,
  },
  {
    key: "jobsWaiting",
    dir: "down",
    kind: "queue-down",
    tone: "success",
    icon: "▶️",
    href: "/nextjobs",
    text: (d) => `${d} job${d === 1 ? "" : "s"} pulled off the queue`,
  },
  {
    key: "partsOutstanding",
    dir: "down",
    kind: "parts-in",
    tone: "success",
    icon: "📦",
    href: "/goods-in",
    text: (d) => `${d} part${d === 1 ? "" : "s"} booked in`,
  },
  {
    key: "pendingDeliveries",
    dir: "down",
    kind: "delivery",
    tone: "success",
    icon: "🚚",
    href: "/deliveries",
    text: (d) => `${d} deliver${d === 1 ? "y" : "ies"} received`,
  },
];

const numeric = (obj, key) => {
  const v = obj?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

// Normalise a presence-by-id input (Map or plain object) into entries.
function presenceEntries(input) {
  if (!input) return [];
  if (input instanceof Map) return Array.from(input.entries());
  if (typeof input === "object") return Object.entries(input);
  return [];
}

// Derive activity events from the change between two snapshots.
//   prev / next : { metrics, presenceById } (either may be null on first run)
//   ts          : timestamp to stamp the events with (supplied by the hook)
export function deriveActivityEvents(prev, next, { ts = 0 } = {}) {
  if (!prev || !next) return []; // need a baseline to diff against
  const events = [];
  const prevMetrics = prev.metrics || {};
  const nextMetrics = next.metrics || {};

  METRIC_SIGNALS.forEach((sig, i) => {
    const before = numeric(prevMetrics, sig.key);
    const after = numeric(nextMetrics, sig.key);
    if (before == null || after == null) return;
    const change = after - before;
    if (sig.dir === "up" && change > 0) {
      events.push(makeEvent(sig, change, ts, i));
    } else if (sig.dir === "down" && change < 0) {
      events.push(makeEvent(sig, -change, ts, i));
    }
  });

  // Per-person presence transitions (richer than the counts above).
  const prevById = new Map(presenceEntries(prev.presenceById));
  const nextById = new Map(presenceEntries(next.presenceById));
  let p = 0;
  nextById.forEach((member, id) => {
    const before = prevById.get(id);
    if (!before) return; // newly-seen member (roster load) — not an event
    if (before.availabilityId === member.availabilityId) return;
    const event = presenceTransitionEvent(before, member, ts, p++);
    if (event) events.push(event);
  });

  return events;
}

function makeEvent(sig, delta, ts, index) {
  return {
    id: `activity:${sig.kind}:${ts}:${index}`,
    kind: sig.kind,
    tone: sig.tone,
    icon: sig.icon,
    text: sig.text(delta),
    href: sig.href,
    ts,
  };
}

function presenceTransitionEvent(before, after, ts, index) {
  const name = after.name || "A colleague";
  // Becoming available is the highest-value collaboration signal.
  if (after.available && !before.available) {
    return {
      id: `activity:presence-available:${after.id}:${ts}:${index}`,
      kind: "presence-available",
      tone: "success",
      icon: "🟢",
      text: `${name} is now available`,
      href: null,
      ts,
    };
  }
  if (after.working && !before.working) {
    return {
      id: `activity:presence-working:${after.id}:${ts}:${index}`,
      kind: "presence-working",
      tone: "info",
      icon: "🔧",
      text: after.jobNumber ? `${name} started job ${after.jobNumber}` : `${name} started a job`,
      href: after.jobNumber ? `/job-cards/${after.jobNumber}` : null,
      ts,
    };
  }
  // A meaningful declared change (break / training / road test / maintenance).
  return {
    id: `activity:presence-state:${after.id}:${ts}:${index}`,
    kind: "presence-state",
    tone: after.state?.tone || "info",
    icon: after.state?.icon || "•",
    text: `${name} is now ${(after.state?.short || after.availabilityId || "").toLowerCase()}`,
    href: null,
    ts,
  };
}

export const __test__ = { METRIC_SIGNALS };
