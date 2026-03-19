// file location: src/lib/status/importanceScoring.js
// Assigns an importance score to each timeline entry for display emphasis.

// Importance level constants — higher = more prominent in the UI.
export const IMPORTANCE_LEVELS = {
  milestone: 5, // Key lifecycle events (booked, checked in, completed, released)
  major: 4, // Significant workflow events (tech started, VHC completed, customer decision)
  normal: 3, // Standard workflow events (VHC started, pricing, clocking, first tracking)
  minor: 2, // Low-value updates (subsequent tracking, key updates)
  noise: 1, // System noise (unrecognised events, duplicate backend rows)
};

// Statuses that represent milestone lifecycle events.
const MILESTONE_STATUSES = new Set([
  "booked", "checked_in", "in_progress", "invoiced", "released", // Main status transitions
  "technician_work_completed", "wash_complete", // Key completion events
]);

// Statuses that represent major workflow events.
const MAJOR_STATUSES = new Set([
  "technician_started", "vhc_completed", // Workshop/VHC milestones
  "customer_authorised", "customer_declined", // Customer decisions
  "parts_ready", "mot_completed", // Parts and MOT milestones
]);

// Statuses that represent normal workflow events.
const NORMAL_STATUSES = new Set([
  "vhc_started", "vhc_reopened", // VHC workflow steps
  "waiting_for_pricing", "pricing_completed", // Pricing workflow
  "sent_to_customer", // Customer communication
  "waiting_for_parts", "ready_for_invoice", // Parts and invoice readiness
]);

// Event types that are always minor (low-value tracking updates).
const MINOR_EVENT_TYPES = new Set([
  "vehicle_tracking", "key_tracking", // Subsequent tracking updates
]);

// Score a single timeline entry based on its status and event type.
export function scoreImportance(entry) {
  if (!entry) return { importance: IMPORTANCE_LEVELS.noise, importanceLabel: "noise" }; // Null guard

  // For group entries, use the highest-scoring child.
  if (entry.group && entry.group.items) {
    let maxScore = IMPORTANCE_LEVELS.noise; // Start with lowest score
    let maxLabel = "noise"; // Start with lowest label
    entry.group.items.forEach((child) => {
      const childScore = scoreImportance(child); // Recursively score each child
      if (childScore.importance > maxScore) {
        maxScore = childScore.importance; // Track highest score
        maxLabel = childScore.importanceLabel; // Track highest label
      }
    });
    return { importance: maxScore, importanceLabel: maxLabel };
  }

  const status = entry.status || ""; // Normalised status ID
  const eventType = entry.eventType || ""; // Event type key

  // Check milestone statuses first (highest priority).
  if (MILESTONE_STATUSES.has(status)) {
    return { importance: IMPORTANCE_LEVELS.milestone, importanceLabel: "milestone" };
  }

  // Check major statuses.
  if (MAJOR_STATUSES.has(status)) {
    return { importance: IMPORTANCE_LEVELS.major, importanceLabel: "major" };
  }

  // Check normal statuses.
  if (NORMAL_STATUSES.has(status)) {
    return { importance: IMPORTANCE_LEVELS.normal, importanceLabel: "normal" };
  }

  // Clocking events are normal importance.
  if (eventType === "clocking") {
    return { importance: IMPORTANCE_LEVELS.normal, importanceLabel: "normal" };
  }

  // First tracking event (tracking_registered) is normal importance.
  if (eventType === "tracking_registered") {
    return { importance: IMPORTANCE_LEVELS.normal, importanceLabel: "normal" };
  }

  // Subsequent tracking updates are minor.
  if (MINOR_EVENT_TYPES.has(eventType)) {
    return { importance: IMPORTANCE_LEVELS.minor, importanceLabel: "minor" };
  }

  // Parts on order is normal importance.
  if (eventType === "parts_on_order") {
    return { importance: IMPORTANCE_LEVELS.normal, importanceLabel: "normal" };
  }

  // Main status kind entries that didn't match above are normal.
  if (entry.kind === "status") {
    return { importance: IMPORTANCE_LEVELS.normal, importanceLabel: "normal" };
  }

  // Unrecognised events are noise.
  return { importance: IMPORTANCE_LEVELS.noise, importanceLabel: "noise" };
}
