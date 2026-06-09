// file location: src/components/Workshop/QueuePlanner/workshopQueueHelpers.js
// Pure presentation helpers shared across the Workshop Queue Planner pieces
// (board rows, job cards, clocked-in strip, details modal). No data fetching —
// this is display logic only, keeping the visual components dumb.

import styles from "./WorkshopQueuePlanner.module.css";

// A working day's nominal capacity in hours — drives the utilisation bar/dot.
// Soft tints only (no bright red) per the planner spec.
export const DAILY_CAPACITY_HOURS = 7.5;

// ---- status → soft visual treatment ----
// Calm tints only — no harsh / bright colours (per the status design spec).
const STATUS_META = {
  waiting: { label: "Waiting", pill: styles.stWaiting, dot: "var(--warning)" },
  progress: { label: "In Progress", pill: styles.stProgress, dot: "#3b82f6" },
  complete: { label: "Completed", pill: styles.stComplete, dot: "var(--success)" },
  ready: { label: "Ready", pill: styles.stReady, dot: "var(--success)" },
  parts: { label: "Parts Waiting", pill: styles.stParts, dot: "#e0a458" },
  mot: { label: "MOT Required", pill: styles.stMot, dot: "#6366f1" },
  cancelled: { label: "Cancelled", pill: styles.stCancelled, dot: "var(--surfaceTextMuted)" },
};

// Map any job/clocking status string onto one of the soft status buckets.
export const deriveStatusKey = (status) => {
  const raw = String(status || "").toLowerCase();
  if (!raw) return "waiting";
  if (raw.includes("cancel")) return "cancelled";
  if (raw.includes("part")) return "parts";
  if (raw.includes("mot")) return "mot";
  if (raw.includes("ready") || raw.includes("wash")) return "ready";
  if (
    raw.includes("complete") ||
    raw.includes("invoiced") ||
    raw.includes("collected") ||
    raw.includes("finished")
  ) {
    return "complete";
  }
  if (
    raw.includes("progress") ||
    raw.includes("workshop") ||
    raw.includes("started") ||
    raw.includes("additional") ||
    raw.includes("vhc")
  ) {
    return "progress";
  }
  return "waiting";
};

export const getStatusMeta = (status) => STATUS_META[deriveStatusKey(status)] || STATUS_META.waiting;

// ---- avatar initials ----
export const getInitials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

// ---- time formatting ----
export const formatClock = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
};

// ---- capacity level from total hours ----
// low < 50% · medium 50–90% · high ≥ 90% of DAILY_CAPACITY_HOURS.
export const getCapacity = (totalHours) => {
  const pct = Math.min(100, Math.round((totalHours / DAILY_CAPACITY_HOURS) * 100));
  if (pct >= 90) return { pct, level: "high", fill: styles.capHigh, dot: styles.dotHigh, label: "High workload" };
  if (pct >= 50) return { pct, level: "medium", fill: styles.capMed, dot: styles.dotMed, label: "Medium workload" };
  return { pct, level: "low", fill: styles.capLow, dot: styles.dotLow, label: "Low workload" };
};

export const formatHours = (hours) => {
  const value = Number(hours) || 0;
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)} hr${value === 1 ? "" : "s"}`;
};
