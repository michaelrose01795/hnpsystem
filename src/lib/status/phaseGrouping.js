// file location: src/lib/status/phaseGrouping.js
// Assigns timeline entries to named workflow phases and groups consecutive same-phase entries.
// Replaces basic time-window clustering with semantic phase grouping.

import { groupClockingPairs } from "@/lib/status/timelineGrouping"; // Reuse clocking pair logic

// Phase definitions with display labels and order.
export const PHASES = {
  booking_checkin: { id: "booking_checkin", label: "Booking & Check-in", order: 1, color: "var(--info)" },
  workshop: { id: "workshop", label: "Workshop Activity", order: 2, color: "var(--accent-orange)" },
  vhc_auth: { id: "vhc_auth", label: "VHC & Authorisation", order: 3, color: "var(--accent-purple)" },
  parts: { id: "parts", label: "Parts & Ordering", order: 4, color: "var(--danger)" },
  wash_prep: { id: "wash_prep", label: "Wash & Final Prep", order: 5, color: "var(--success)" },
  invoice_collection: { id: "invoice_collection", label: "Invoice & Collection", order: 6, color: "var(--info)" },
  tracking: { id: "tracking", label: "Tracking Updates", order: 7, color: "var(--grey-accent)" },
  system: { id: "system", label: "System Updates", order: 8, color: "var(--grey-accent-light)" },
};

// VHC-related sub-statuses for phase assignment.
const VHC_STATUSES = new Set([
  "vhc_started", "vhc_reopened", "vhc_completed", // VHC lifecycle
  "waiting_for_pricing", "pricing_completed", // Pricing workflow
  "sent_to_customer", "customer_authorised", "customer_declined", // Customer decision
]);

// Assign a phase ID to a single timeline entry based on its status and event type.
export function assignPhase(entry) {
  if (!entry) return "system"; // Null guard defaults to system

  const status = entry.status || ""; // Normalised status ID
  const eventType = entry.eventType || ""; // Event type key

  // Booking and check-in phase.
  if (status === "booked" || status === "checked_in") return "booking_checkin"; // Main booking statuses
  if (eventType === "tracking_registered") return "booking_checkin"; // First tracking event is part of check-in

  // Workshop phase.
  if (status === "technician_started" || status === "technician_work_completed") return "workshop"; // Tech lifecycle
  if (status === "in_progress") return "workshop"; // Main status transition to workshop
  if (status === "mot_completed") return "workshop"; // MOT is workshop activity
  if (eventType === "clocking") return "workshop"; // Clocking is workshop activity

  // VHC and authorisation phase.
  if (VHC_STATUSES.has(status)) return "vhc_auth"; // All VHC sub-statuses

  // Parts phase.
  if (status === "waiting_for_parts" || status === "parts_ready") return "parts"; // Parts sub-statuses
  if (eventType === "parts_on_order") return "parts"; // Parts event type

  // Wash and final prep phase.
  if (status === "wash_complete" || status === "no_wash") return "wash_prep"; // Wash completion or intentional skip

  // Invoice and collection phase.
  if (status === "invoiced" || status === "released" || status === "ready_for_invoice") return "invoice_collection"; // Post-workshop

  // Tracking updates phase (subsequent tracking events, not the first one).
  if (eventType === "vehicle_tracking" || eventType === "key_tracking") return "tracking"; // Tracking updates

  // Default to system updates for unrecognised events.
  return "system";
}

// Group consecutive same-phase entries into phase groups.
// First runs clocking pair grouping, then walks the array to group by phase.
export function groupByPhase(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return []; // Guard against invalid input

  // Step 1: Group clocking pairs first (preserves technician session display).
  let processed = groupClockingPairs(entries);

  // Step 2: Assign phase to each entry.
  processed = processed.map((entry) => ({
    ...entry,
    phase: entry.group ? assignPhase(entry.group.items?.[0] || entry) : assignPhase(entry), // Use first child for groups
  }));

  // Step 3: Walk the array and group consecutive same-phase runs.
  const result = []; // Output array
  let currentRun = []; // Accumulator for current phase run
  let currentPhase = null; // Current phase being accumulated

  const flushRun = () => {
    if (currentRun.length === 0) return; // Nothing to flush
    if (currentRun.length === 1) {
      result.push(currentRun[0]); // Single entries pass through with phase attached
    } else {
      const phaseConfig = PHASES[currentPhase] || PHASES.system; // Look up phase metadata
      result.push({
        ...currentRun[0], // Use first entry as the base
        group: {
          groupId: `phase-${currentPhase}-${currentRun[0].timestamp}`, // Unique ID
          groupLabel: `${phaseConfig.label} (${currentRun.length})`, // Phase label with count
          items: currentRun, // Child entries
          isCollapsible: true, // Allow expand/collapse
          phaseId: currentPhase, // Phase identifier for styling
          phaseColor: phaseConfig.color, // Phase colour for dot styling
        },
      });
    }
    currentRun = []; // Reset accumulator
    currentPhase = null; // Reset current phase
  };

  processed.forEach((entry) => {
    const entryPhase = entry.phase || "system"; // Get assigned phase

    // If entry already has a group (e.g., clocking pair), treat as single unit.
    if (entry.group && !entry.group.phaseId) {
      // Clocking pairs should join the workshop phase run.
      if (entryPhase === currentPhase) {
        currentRun.push(entry); // Add to current run
      } else {
        flushRun(); // Flush previous run
        currentRun.push(entry); // Start new run
        currentPhase = entryPhase; // Set new phase
      }
      return;
    }

    // Standard entry: check if it extends the current phase run.
    if (entryPhase === currentPhase) {
      currentRun.push(entry); // Same phase, add to run
    } else {
      flushRun(); // Different phase, flush and start new run
      currentRun.push(entry);
      currentPhase = entryPhase;
    }
  });

  flushRun(); // Flush any remaining run
  return result;
}
