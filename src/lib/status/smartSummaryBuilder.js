// file location: src/lib/status/smartSummaryBuilder.js
// Generates a structured Smart Summary from the job status snapshot data.
// All text is code-generated (no external AI dependency).

import { resolveDisplayTitle } from "@/lib/status/timelineDisplayMap"; // Clean display titles for latest update
import { relativeTime } from "@/lib/status/timeUtils"; // Shared time utilities
import { detectAnomalies } from "@/lib/status/anomalyDetector"; // Workflow anomaly detection
import { buildJobStory } from "@/lib/status/jobStoryBuilder"; // Natural-language job narrative
import { assessNextStepConfidence, assessSummaryConfidence } from "@/lib/status/confidenceModel"; // Confidence scoring

// Resolve the technician name from snapshot clocking data or timeline entries.
function resolveTechnician(snapshot) {
  if (!snapshot) return null; // Guard against null snapshot

  // Check active clocking first — the technician currently working.
  const clocking = snapshot.workflows?.clocking; // Clocking workflow data
  if (clocking?.active && clocking?.activeTechUserId) {
    // Search timeline for the matching clocking entry to get the name.
    const matchingEntry = (snapshot.timeline || []).find(
      (entry) => entry.eventType === "clocking" && String(entry.userId) === String(clocking.activeTechUserId)
    );
    if (matchingEntry?.userName) return matchingEntry.userName; // Found technician name from clocking entry
  }

  // Fall back to the most recent clocking entry with a userName.
  const clockingEntries = (snapshot.timeline || [])
    .filter((entry) => entry.eventType === "clocking" && entry.userName) // Filter to named clocking entries
    .reverse(); // Most recent first
  if (clockingEntries.length > 0) return clockingEntries[0].userName; // Return most recent technician

  // Fall back to technician_started event.
  const techStarted = (snapshot.timeline || [])
    .filter((entry) => (entry.status === "technician_started" || entry.label === "Technician Started") && entry.userName)
    .reverse();
  if (techStarted.length > 0) return techStarted[0].userName; // Return technician from started event

  return null; // No technician found
}

// Resolve tracking status from the snapshot workflows.
function resolveTrackingStatus(snapshot) {
  const tracking = snapshot?.workflows?.tracking; // Tracking workflow data
  if (!tracking) return "Not tracked"; // No tracking data
  const parts = []; // Build status string from available data
  if (tracking.vehicleStatus) parts.push(tracking.vehicleStatus); // Vehicle status
  if (tracking.keyStatus) parts.push(`Keys: ${tracking.keyStatus}`); // Key status
  if (parts.length === 0) return "Not tracked"; // No tracking info available
  return parts.join(" · "); // Join with separator
}

// Resolve wash/valet status from the valet checklist flag (source of truth),
// falling back to timeline entries for older jobs without checklist data.
function resolveWashStatus(snapshot) {
  // Check the actual valet checklist flag first — this is the source of truth.
  // The timeline may contain an old wash_complete entry that was later unchecked.
  const washChecklist = snapshot?.workflows?.wash; // Wash checklist data from snapshot
  if (washChecklist) {
    if (washChecklist.state === "no_wash" || washChecklist.notRequired) {
      return "Not required";
    }
    if (washChecklist.complete) return "Complete"; // Wash checkbox is currently ticked
    // Checklist exists but wash is false — it was unchecked or not yet done.
    const stage = snapshot.job?.overallStatus; // Current overall status
    if (stage === "invoiced" || stage === "released") return "Complete"; // Assume done if job is past workshop
    return "Pending"; // Wash not yet completed
  }

  // Fallback: no checklist data, check timeline (legacy path for older jobs).
  if (!snapshot?.timeline) return null; // No timeline data
  const washComplete = snapshot.timeline.find(
    (entry) => entry.status === "wash_complete" || entry.label === "Wash Complete"
  );
  if (washComplete) return "Complete"; // Wash event found in timeline

  const noWashEntry = snapshot.timeline.find(
    (entry) => entry.status === "no_wash" || entry.label === "No Wash"
  );
  if (noWashEntry) return "Not required"; // Explicit no-wash event found in timeline

  const stage = snapshot.job?.overallStatus; // Current overall status
  if (stage === "invoiced" || stage === "released") return "Complete"; // Assume done if job is past workshop
  if (stage === "in_progress") return "Pending"; // Still in workshop, wash not done yet
  return null; // Not applicable yet (booked/checked_in)
}

// Infer the next likely step based on current job state.
function inferNextStep(snapshot) {
  if (!snapshot?.job) return null; // No job data

  const stage = snapshot.job.overallStatus; // Current main status ID
  const workflows = snapshot.workflows || {}; // Workflow states
  const clocking = workflows.clocking || {}; // Clocking state
  const vhc = workflows.vhc || {}; // VHC state
  const parts = workflows.parts || {}; // Parts state
  const writeUp = workflows.writeUp || {}; // Write-up state

  if (stage === "booked") {
    return {
      label: "Check in vehicle",
      description: "Vehicle needs to be checked in and keys collected.",
      department: "Service Reception",
    };
  }

  if (stage === "checked_in") {
    if (!clocking.active) {
      return {
        label: "Assign to technician",
        description: "Vehicle is checked in, waiting for a technician to clock on.",
        department: "Workshop",
      };
    }
    return {
      label: "Work starting",
      description: "Technician is clocking on to begin work.",
      department: "Workshop",
    };
  }

  if (stage === "in_progress") {
    // Parts blocking takes priority.
    if (parts.blocking) {
      const summary = parts.summary || {}; // Parts count summary
      const waitingCount = (summary.waiting || 0) + (summary.onOrder || 0); // Total blocked items
      return {
        label: "Resolve parts",
        description: `${waitingCount} part${waitingCount === 1 ? "" : "s"} waiting or on order.`,
        department: "Parts",
      };
    }

    // VHC workflow steps.
    if (vhc.required && vhc.status === "pending") {
      return {
        label: "Complete VHC",
        description: "Vehicle health check is required.",
        department: "Workshop",
      };
    }
    if (vhc.required && vhc.status === "completed" && !vhc.sentAt) {
      return {
        label: "Price & send VHC",
        description: "VHC completed, needs pricing and sending to customer.",
        department: "VHC",
      };
    }
    if (vhc.required && vhc.status === "sent") {
      return {
        label: "Awaiting customer decision",
        description: "VHC sent to customer, waiting for response.",
        department: "VHC",
      };
    }

    // Active clocking means work in progress.
    if (clocking.active) {
      return {
        label: "Work in progress",
        description: "Technician is currently working on this job.",
        department: "Workshop",
      };
    }

    // Warranty write-up needed.
    if (writeUp.status === "missing" && snapshot.job?.jobSource === "Warranty") {
      return {
        label: "Complete write-up",
        description: "Warranty job requires a completed write-up.",
        department: "Workshop",
      };
    }

    // Tech work complete — ready for invoice.
    const techComplete = (snapshot.timeline || []).some(
      (entry) => entry.status === "technician_work_completed"
    );
    if (techComplete) {
      return {
        label: "Ready for invoice",
        description: "Technician work is complete, ready to invoice.",
        department: "Accounts",
      };
    }

    // Default in-progress step.
    return {
      label: "Awaiting technician start",
      description: "Waiting for a technician to begin work.",
      department: "Workshop",
    };
  }

  if (stage === "invoiced") {
    return {
      label: "Release vehicle",
      description: "Job has been invoiced, vehicle can be released.",
      department: "Accounts",
    };
  }

  if (stage === "released") {
    return null; // Job is complete, no next step
  }

  return null; // Unknown status, no inference possible
}

// Build a plain-English summary sentence from the snapshot.
function buildSummarySentence(snapshot, technician) {
  if (!snapshot?.job) return ""; // No job data

  const jobNumber = snapshot.job.jobNumber || snapshot.job.id || "this job"; // Job identifier
  const stage = snapshot.job.statusLabel || snapshot.job.status || "unknown"; // Current stage label
  const parts = [`Job ${jobNumber} is ${stage}.`]; // Start with job state

  // Add technician info.
  if (technician) {
    const clocking = snapshot.workflows?.clocking; // Clocking state
    if (clocking?.active) {
      parts.push(`${technician} is currently working on it.`); // Active technician
    } else {
      parts.push(`Last worked on by ${technician}.`); // Historical technician
    }
  }

  // Add blocking reasons.
  const blocking = snapshot.blockingReasons || []; // Blocking reasons array
  if (blocking.length > 0) {
    parts.push(blocking[0].message); // Include the first blocking reason
  }

  // Add parts info if relevant.
  const partsSummary = snapshot.workflows?.parts?.summary; // Parts summary
  if (partsSummary && (partsSummary.waiting > 0 || partsSummary.onOrder > 0)) {
    const count = (partsSummary.waiting || 0) + (partsSummary.onOrder || 0); // Total blocked parts
    parts.push(`${count} part${count === 1 ? "" : "s"} on order.`); // Parts info
  }

  return parts.join(" "); // Combine into single sentence
}

// Infer which department or person is currently responsible for the job.
function resolveCurrentResponsible(snapshot) {
  if (!snapshot?.job) return null; // No job data
  const stage = snapshot.job.overallStatus; // Current main status
  const workflows = snapshot.workflows || {}; // Workflow states
  if (stage === "booked" || stage === "checked_in") return "Service Reception"; // Pre-workshop stages
  if (stage === "in_progress") {
    if (workflows.parts?.blocking) return "Parts"; // Parts department if blocking
    const vhc = workflows.vhc || {}; // VHC workflow state
    if (vhc.required && (vhc.status === "completed" || vhc.status === "sent")) return "VHC"; // VHC team handling
    return "Workshop"; // Default in-progress responsibility
  }
  if (stage === "invoiced" || stage === "released") return "Accounts"; // Post-workshop stages
  return null; // Unknown stage
}

// Main export: build the complete Smart Summary from a snapshot object.
// Accepts optional enhancedTimeline for anomaly detection and story building.
export function buildSmartSummary(snapshot, enhancedTimeline = []) {
  if (!snapshot) return null; // Guard against null snapshot

  // Resolve the latest meaningful timeline entry.
  const timeline = snapshot.timeline || []; // Timeline entries array
  const latestEntry = timeline.length > 0 ? timeline[timeline.length - 1] : null; // Most recent entry
  const latestTitle = latestEntry ? resolveDisplayTitle(latestEntry) : null; // Clean title
  const latestTime = latestEntry ? relativeTime(latestEntry.timestamp || latestEntry.at) : null; // Relative time

  const technician = resolveTechnician(snapshot); // Resolve technician name
  const trackingStatus = resolveTrackingStatus(snapshot); // Resolve tracking status
  const washStatus = resolveWashStatus(snapshot); // Resolve wash status
  const nextStep = inferNextStep(snapshot); // Infer next likely step
  const summary = buildSummarySentence(snapshot, technician); // Build summary sentence
  const invoiceStatus = snapshot.workflows?.invoice?.status || null; // Invoice readiness
  const currentResponsible = resolveCurrentResponsible(snapshot); // Department or person responsible
  const jobStory = buildJobStory(snapshot, enhancedTimeline); // Natural-language job narrative
  const attentionItems = detectAnomalies(snapshot, enhancedTimeline); // Workflow anomaly checks
  const nextStepConfidence = assessNextStepConfidence(snapshot, nextStep); // Next step confidence
  const summaryConfidence = assessSummaryConfidence(snapshot, { technician, trackingStatus, nextStep, timeline }); // Summary confidence

  return {
    stage: snapshot.job?.statusLabel || snapshot.job?.status || "Unknown", // Current stage label
    stageColor: snapshot.job?.statusMeta?.color || "var(--info)", // Stage badge colour
    latestUpdate: latestTitle && latestTime
      ? `${latestTitle} — ${latestTime}` // Combined title and time
      : latestTitle || "No updates yet", // Fallback
    technician: technician || null, // Technician name or null
    trackingStatus, // Tracking status string
    washStatus, // Wash/valet status string or null
    summary, // Plain-English summary sentence
    nextStep, // Next likely step object or null
    blockingReasons: snapshot.blockingReasons || [], // Passthrough blocking reasons
    invoiceStatus, // Invoice readiness status
    currentResponsible, // Department or person responsible
    jobStory, // 2-3 sentence narrative of the job so far
    attentionItems, // Anomaly detection results
    nextStepConfidence, // Confidence in next step inference
    summaryConfidence, // Confidence in overall summary
  };
}
