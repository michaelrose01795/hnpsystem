// file location: src/lib/status/explanationBuilder.js
// Generates plain-English explanation text for each timeline entry.

import { formatDuration } from "@/lib/status/timeUtils"; // Duration formatting utility

// Resolve actor name from entry, defaulting to a generic label.
function actor(entry, fallback) {
  return entry?.userName || fallback || "a team member"; // Use entry actor or fallback
}

// Calculate clocking duration in seconds from clock-in and clock-out timestamps.
function clockingDurationSeconds(entry) {
  const clockIn = entry?.meta?.clockIn || entry?.timestamp; // Clock-in time
  const clockOut = entry?.meta?.clockOut; // Clock-out time
  if (!clockIn || !clockOut) return 0; // No duration without both timestamps
  const inMs = new Date(clockIn).getTime(); // Parse clock-in
  const outMs = new Date(clockOut).getTime(); // Parse clock-out
  if (Number.isNaN(inMs) || Number.isNaN(outMs) || outMs <= inMs) return 0; // Invalid range guard
  return Math.floor((outMs - inMs) / 1000); // Duration in seconds
}

// Main export: build a plain-English explanation for a timeline entry.
export function buildExplanation(entry) {
  if (!entry) return null; // Null guard

  const status = entry.status || ""; // Normalised status ID
  const eventType = entry.eventType || ""; // Event type key

  // Main job status transitions.
  if (status === "booked") return "Job was booked into the system"; // Booking event
  if (status === "checked_in") return `Vehicle arrived and was checked in by ${actor(entry, "reception")}`; // Check-in event
  if (status === "in_progress") return "Job was moved to in progress"; // Work started
  if (status === "invoiced") return "Job was invoiced"; // Invoice created
  if (status === "released") return "Vehicle was released to the customer"; // Job complete

  // Workshop sub-statuses.
  if (status === "technician_started") return `Initial workshop work was started by ${actor(entry, "a technician")}`; // Tech start
  if (status === "technician_work_completed") return `Workshop work was completed by ${actor(entry, "a technician")}`; // Tech complete

  // VHC sub-statuses.
  if (status === "vhc_started") return "Vehicle health check was started"; // VHC begin
  if (status === "vhc_reopened") return "Vehicle health check was reopened for additional items"; // VHC reopen
  if (status === "vhc_completed") return "Vehicle health check was completed"; // VHC done
  if (status === "waiting_for_pricing") return "VHC is awaiting pricing before sending to customer"; // Pricing wait
  if (status === "pricing_completed") return "VHC pricing was completed"; // Pricing done
  if (status === "sent_to_customer") return "VHC report was sent to the customer for review"; // Customer send
  if (status === "customer_authorised") return "Customer approved the additional work"; // Customer yes
  if (status === "customer_declined") return "Customer declined the additional work"; // Customer no

  // Parts sub-statuses.
  if (status === "waiting_for_parts") return "Parts were ordered for this job"; // Parts wait
  if (status === "parts_ready") return "All required parts are ready"; // Parts arrived
  if (status === "ready_for_invoice") return "Job is ready to be invoiced"; // Invoice ready

  // Other sub-statuses.
  if (status === "mot_completed") return "MOT test was completed"; // MOT done
  if (status === "wash_complete") return `Final wash or valet was completed by ${actor(entry, "the valet team")}`; // Wash done
  if (status === "no_wash") return `Wash was marked as not required by ${actor(entry, "the valet team")}`; // Wash skipped intentionally

  // Clocking events.
  if (eventType === "clocking") {
    if (entry.meta?.clockOut) {
      const seconds = clockingDurationSeconds(entry); // Calculate duration
      const durationText = formatDuration(seconds); // Format duration
      return durationText
        ? `${actor(entry, "Technician")} clocked off after ${durationText}` // With duration
        : `${actor(entry, "Technician")} clocked off`; // Without duration
    }
    return `${actor(entry, "Technician")} clocked on to begin work`; // Clock-on
  }

  // Tracking events.
  if (eventType === "tracking_registered") return "Key location was added to the tracking system"; // First tracking
  if (eventType === "key_tracking") return "Key location was updated in the tracking system"; // Key update
  if (eventType === "vehicle_tracking") {
    const location = entry.meta?.location; // Vehicle location
    return location
      ? `Vehicle was moved to the ${location} area` // With location context
      : "Vehicle parking location was updated"; // Without location
  }

  // Parts on order.
  if (eventType === "parts_on_order") return "Parts were ordered for this job"; // Parts ordered

  return null; // No explanation for unrecognised events
}
