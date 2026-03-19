// file location: src/lib/status/timelineDisplayMap.js
// Maps raw timeline entry data to clean, user-facing display titles.

import { DISPLAY as JOB_DISPLAY } from "@/lib/status/catalog/job"; // Main status display labels
import { DISPLAY as TIMELINE_DISPLAY } from "@/lib/status/catalog/timeline"; // Sub-status display labels

// Additional display mappings for event types not covered by the status catalogs.
const EVENT_DISPLAY = {
  tracking_registered: "Added to Parking & Key Tracking", // First key tracking event
  key_tracking: "Key Updated", // Subsequent key tracking events
  vehicle_tracking: "Parking Updated", // Vehicle location change
  parts_on_order: "Parts on Order", // Parts waiting for delivery
  sub_status: null, // Handled by TIMELINE_DISPLAY lookup below
};

// Specific clocking event labels based on work type and clock-out state.
const CLOCKING_LABELS = {
  initial: "Technician Started", // Initial clocking matches technician started semantically
  mot: "MOT Work Started", // MOT-specific clocking
  additional: "Additional Work Started", // Additional authorised work clocking
  default_on: "Technician Clocked On", // Generic clock-on
  default_off: "Technician Clocked Off", // Generic clock-off when clock_out is present
};

// Title-case a snake_case or raw string for fallback display.
function titleCase(value) {
  if (!value) return "Update"; // Fallback for empty values
  return String(value)
    .replace(/_/g, " ") // Replace underscores with spaces
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize first letter of each word
}

// Resolve a clocking entry to a clean display title.
function resolveClockingTitle(entry) {
  const workType = String(entry?.meta?.workType || "").toLowerCase(); // Normalise work type
  if (entry?.meta?.clockOut) return CLOCKING_LABELS.default_off; // Clock-off events always show "Clocked Off"
  if (workType === "initial") return CLOCKING_LABELS.initial; // Initial clocking maps to "Technician Started"
  if (workType === "mot") return CLOCKING_LABELS.mot; // MOT work type
  if (workType === "additional") return CLOCKING_LABELS.additional; // Additional work type
  return CLOCKING_LABELS.default_on; // Default clock-on label
}

// Resolve a vehicle tracking entry to a display title with location context.
function resolveVehicleTrackingTitle(entry) {
  if (entry?.meta?.location) return `Parking Updated: ${entry.meta.location}`; // Include location when available
  if (entry?.meta?.status) return `Vehicle Status: ${entry.meta.status}`; // Fall back to status
  return EVENT_DISPLAY.vehicle_tracking; // Generic fallback
}

// Resolve a key tracking entry to a display title with action context.
function resolveKeyTrackingTitle(entry) {
  if (entry?.meta?.action) return `Key ${titleCase(entry.meta.action)}`; // Include specific action
  return EVENT_DISPLAY.key_tracking; // Generic fallback
}

// Main export: resolve a timeline entry to a clean display title.
export function resolveDisplayTitle(entry) {
  if (!entry) return "Update"; // Guard against null entries

  // For main status changes, use the job status catalog labels.
  if (entry.kind === "status") {
    const statusKey = entry.status || entry.label; // Use status ID or label
    if (statusKey && JOB_DISPLAY[statusKey]) return JOB_DISPLAY[statusKey]; // Exact match in job catalog
    if (entry.label) return titleCase(entry.label); // Fallback to title-cased label
    return "Status Update"; // Last resort
  }

  // For event entries, route by event type.
  if (entry.kind === "event") {
    const eventType = entry.eventType || ""; // Get event type key

    // Clocking events have specialised title logic.
    if (eventType === "clocking") return resolveClockingTitle(entry);

    // Vehicle tracking includes location context.
    if (eventType === "vehicle_tracking") return resolveVehicleTrackingTitle(entry);

    // Key tracking includes action context.
    if (eventType === "key_tracking") return resolveKeyTrackingTitle(entry);

    // Tracking registered is always the same label.
    if (eventType === "tracking_registered") return EVENT_DISPLAY.tracking_registered;

    // Parts on order.
    if (eventType === "parts_on_order") return EVENT_DISPLAY.parts_on_order;

    // Sub-status events use the timeline catalog.
    if (eventType === "sub_status" || eventType === "Workshop" || eventType === "VHC" || eventType === "Valet" || eventType === "Parts" || eventType === "Admin") {
      const statusKey = entry.status || entry.label; // Use status or label for lookup
      if (statusKey && TIMELINE_DISPLAY[statusKey]) return TIMELINE_DISPLAY[statusKey]; // Match in timeline catalog
    }

    // Static event display map lookup.
    if (EVENT_DISPLAY[eventType] && EVENT_DISPLAY[eventType] !== null) {
      return EVENT_DISPLAY[eventType];
    }
  }

  // Fallback: title-case the label or status field.
  return titleCase(entry.label || entry.status || "Update");
}

// Resolve a category badge label from an entry (replaces formatBadgeLabel).
export function resolveBadgeLabel(entry) {
  if (!entry) return "Status"; // Guard against null entries
  if (entry.kind === "event") {
    const eventType = entry.eventType || ""; // Get event type key
    if (eventType === "clocking") return "Workshop"; // Clocking events belong to Workshop
    if (eventType === "vehicle_tracking" || eventType === "key_tracking" || eventType === "tracking_registered") return "Tracking"; // Tracking events
    if (eventType === "parts_on_order") return "Parts"; // Parts events
    return entry.department || titleCase(eventType) || "Action"; // Fall back to department or event type
  }
  return entry.department || "Status"; // Status entries use department or generic label
}
