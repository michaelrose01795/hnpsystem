// file location: src/lib/status/anomalyDetector.js
// Detects suspicious or missing workflow patterns in a job's timeline.
// Returns advisory-only anomalies — never changes job state automatically.

import { hoursSince } from "@/lib/status/timeUtils"; // Time comparison utility

// Check if checked in for over 2 hours with no technician start.
function checkStaleCheckin(snapshot, timeline) {
  if (snapshot.job?.overallStatus !== "checked_in") return null; // Only applies to checked_in jobs
  const hours = hoursSince(snapshot.job.updatedAt); // Hours since last status update
  if (hours < 2) return null; // Not stale yet
  const hasTechStart = timeline.some((e) => e.status === "technician_started"); // Check for tech start
  if (hasTechStart) return null; // Technician has started
  return {
    code: "STALE_CHECKIN",
    severity: "warning",
    message: `Vehicle checked in over ${Math.floor(hours)} hours ago but no technician has started`,
    detail: null,
    workflowKey: "workshop",
  };
}

// Check if technician started but no further workshop events for 4+ hours.
function checkStaleTechnician(snapshot, timeline) {
  const techStart = [...timeline].reverse().find((e) => e.status === "technician_started"); // Find most recent tech start
  if (!techStart) return null; // No tech start to check
  const techTimestamp = techStart.timestamp || techStart.at; // Get timestamp
  const hours = hoursSince(techTimestamp); // Hours since tech started
  if (hours < 4) return null; // Not stale yet
  const hasLaterWorkshopEvent = timeline.some((e) => {
    const eTime = new Date(e.timestamp || e.at).getTime(); // Parse entry timestamp
    const techTime = new Date(techTimestamp).getTime(); // Parse tech start timestamp
    return eTime > techTime && (e.status === "technician_work_completed" || e.eventType === "clocking"); // Later workshop event
  });
  if (hasLaterWorkshopEvent) return null; // Workshop has progressed
  return {
    code: "STALE_TECHNICIAN",
    severity: "warning",
    message: `Technician started ${Math.floor(hours)} hours ago with no further updates`,
    detail: null,
    workflowKey: "workshop",
  };
}

// Check if active clocking session has been running 8+ hours.
function checkLongClocking(snapshot) {
  const clocking = snapshot.workflows?.clocking; // Clocking workflow state
  if (!clocking?.active || !clocking?.startedAt) return null; // No active clocking
  const hours = hoursSince(clocking.startedAt); // Hours since clock-in
  if (hours < 8) return null; // Not unusually long
  return {
    code: "LONG_CLOCKING",
    severity: "warning",
    message: `Active clocking session has been running for ${Math.floor(hours)} hours`,
    detail: null,
    workflowKey: "workshop",
  };
}

// Check if parts are blocking with no parts_ready event.
function checkPartsBlocking(snapshot, timeline) {
  if (!snapshot.workflows?.parts?.blocking) return null; // Parts not blocking
  const hasPartsReady = timeline.some((e) => e.status === "parts_ready"); // Check for parts ready
  if (hasPartsReady) return null; // Parts have arrived
  return {
    code: "PARTS_BLOCKING",
    severity: "info",
    message: "Parts are blocking this job",
    detail: null,
    workflowKey: "parts",
  };
}

// Check if VHC is required but still pending while job is in progress.
function checkVhcRequired(snapshot) {
  const vhc = snapshot.workflows?.vhc; // VHC workflow state
  if (!vhc?.required || vhc.status !== "pending") return null; // VHC not required or already started
  if (snapshot.job?.overallStatus !== "in_progress") return null; // Only relevant when in progress
  return {
    code: "VHC_REQUIRED_PENDING",
    severity: "info",
    message: "VHC is required but hasn't been started",
    detail: null,
    workflowKey: "vhc",
  };
}

// Check if wash was marked complete before technician work completed.
function checkWashBeforeWork(snapshot, timeline) {
  const washEntry = timeline.find((e) => e.status === "wash_complete"); // Find wash complete entry
  const techCompleteEntry = timeline.find((e) => e.status === "technician_work_completed"); // Find tech complete entry
  if (!washEntry || !techCompleteEntry) return null; // Need both events to compare
  const washTime = new Date(washEntry.timestamp || washEntry.at).getTime(); // Parse wash timestamp
  const techTime = new Date(techCompleteEntry.timestamp || techCompleteEntry.at).getTime(); // Parse tech timestamp
  if (Number.isNaN(washTime) || Number.isNaN(techTime)) return null; // Invalid timestamps
  if (washTime >= techTime) return null; // Wash after tech complete is normal
  return {
    code: "WASH_BEFORE_WORK",
    severity: "warning",
    message: "Wash was marked complete before workshop work finished",
    detail: null,
    workflowKey: "wash",
  };
}

// Check if job is marked invoiced but no invoice record exists.
function checkInvoiceNoRecord(snapshot) {
  if (snapshot.job?.overallStatus !== "invoiced") return null; // Only applies to invoiced jobs
  const invoice = snapshot.workflows?.invoice; // Invoice workflow state
  if (invoice?.invoiceId) return null; // Invoice record exists
  return {
    code: "INVOICE_NO_RECORD",
    severity: "warning",
    message: "Job is marked invoiced but no invoice found",
    detail: null,
    workflowKey: "invoice",
  };
}

// Check if any important event (importance >= 4) has no actor.
function checkMissingActor(snapshot, timeline) {
  const results = []; // Collect all missing actor anomalies
  timeline.forEach((entry) => {
    const importance = entry.importance || 0; // Get importance score if available
    if (importance < 4) return; // Only check major+ events
    const hasActor = entry.userName && entry.userName !== "System"; // Check for real actor
    if (hasActor) return; // Actor is present
    const label = entry.displayTitle || entry.label || entry.status || "event"; // Get display label
    results.push({
      code: "MISSING_ACTOR",
      severity: "info",
      message: `Important event "${label}" has no recorded actor`,
      detail: null,
      workflowKey: "system",
    });
  });
  return results.length > 0 ? results : null; // Return array or null
}

// Check if timeline events don't match the job's overall status.
function checkStatusMismatch(snapshot, timeline) {
  const overallStatus = snapshot.job?.overallStatus; // Current main status
  if (!overallStatus) return null; // No status to check

  const parseEntryTime = (entry) => {
    const raw = entry?.timestamp || entry?.at || null;
    const parsed = raw ? new Date(raw).getTime() : Number.NaN;
    return Number.isNaN(parsed) ? null : parsed;
  };

  const latestTechComplete = [...timeline]
    .filter((e) => e.status === "technician_work_completed")
    .map(parseEntryTime)
    .filter((value) => value !== null)
    .sort((a, b) => b - a)[0] || null;

  if (!latestTechComplete) return null;

  const latestTechStarted = [...timeline]
    .filter((e) => e.status === "technician_started")
    .map(parseEntryTime)
    .filter((value) => value !== null)
    .sort((a, b) => b - a)[0] || null;

  const hasRestartedAfterCompletion =
    latestTechStarted !== null && latestTechStarted > latestTechComplete;
  const hasActiveClocking = Boolean(snapshot.workflows?.clocking?.active);

  // If timeline shows tech work completed but status is still checked_in, and there has not been
  // a later technician restart/active workshop session, the main status is genuinely lagging behind.
  if (
    overallStatus === "checked_in" &&
    !hasRestartedAfterCompletion &&
    !hasActiveClocking
  ) {
    return {
      code: "STATUS_MISMATCH",
      severity: "warning",
      message: "Job status may not reflect current progress — tech work completed but status is still Checked In",
      detail:
        'Reason: the technician completion event exists, but the main job status is still "Checked In" instead of moving into workshop progress. Fix: change the main status to "In Progress" and then press "Complete Job" again if needed.',
      workflowKey: "system",
    };
  }

  return null; // No mismatch detected
}

// Check if multiple technicians are clocked on simultaneously.
function checkMultipleClockIns(snapshot) {
  const activeClockIns = snapshot.clockingSummary?.activeClockIns || []; // Active clock-in timestamps
  if (activeClockIns.length <= 1) return null; // 0 or 1 is normal
  return {
    code: "MULTIPLE_CLOCKINS",
    severity: "info",
    message: `${activeClockIns.length} technicians clocked on simultaneously`,
    detail: null,
    workflowKey: "workshop",
  };
}

// All anomaly detection rules.
const RULES = [
  checkStaleCheckin,
  checkStaleTechnician,
  checkLongClocking,
  checkPartsBlocking,
  checkVhcRequired,
  checkWashBeforeWork,
  checkInvoiceNoRecord,
  checkMissingActor,
  checkStatusMismatch,
  checkMultipleClockIns,
];

// Main export: run all anomaly detection rules against the snapshot and timeline.
export function detectAnomalies(snapshot, enhancedTimeline = []) {
  if (!snapshot) return []; // Guard against null snapshot
  // Flatten grouped entries for rule checking.
  const flatTimeline = []; // Flattened array of all entries
  enhancedTimeline.forEach((entry) => {
    if (entry.group && entry.group.items) {
      entry.group.items.forEach((child) => flatTimeline.push(child)); // Expand group children
    } else {
      flatTimeline.push(entry); // Individual entries pass through
    }
  });

  return RULES
    .map((rule) => rule(snapshot, flatTimeline)) // Run each rule
    .flat() // Some rules return arrays
    .filter(Boolean); // Remove nulls
}
