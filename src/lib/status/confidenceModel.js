// file location: src/lib/status/confidenceModel.js
// Lightweight confidence model for inferred fields in the tracker.
// Returns "high", "medium", or "low" for internal use and debug mode display.

// Assess confidence in an entry's actor resolution.
export function assessActorConfidence(entry) {
  if (!entry) return "low"; // Null guard
  const hasUserName = entry.userName && entry.userName !== "System"; // Real actor name present
  const hasUserId = entry.userId !== null && entry.userId !== undefined; // User ID present

  // If actor was set via propagation from adjacent entries, confidence is medium.
  if (entry._actorPropagated) return "medium"; // Propagated actor

  // Both userName and userId present from original data.
  if (hasUserName && hasUserId) return "high"; // Confident actor resolution

  // Only userName present (e.g., from meta.userName or performedBy field).
  if (hasUserName) return "high"; // Still confident if we have a name

  // No real actor resolved.
  return "low"; // Unresolved actor
}

// Assess confidence in the inferred next step.
export function assessNextStepConfidence(snapshot, nextStep) {
  if (!nextStep) return null; // No next step to assess
  if (!snapshot?.job) return "low"; // No job data

  const stage = snapshot.job.overallStatus; // Current main status
  const workflows = snapshot.workflows || {}; // Workflow states

  // Deterministic stages have high confidence.
  if (stage === "booked") return "high"; // Clear next step: check in
  if (stage === "checked_in") return "high"; // Clear next step: assign tech
  if (stage === "invoiced") return "high"; // Clear next step: release
  if (stage === "released") return "high"; // Job is done

  // In-progress with clear blockers has high confidence.
  if (stage === "in_progress") {
    if (workflows.parts?.blocking) return "high"; // Clear blocker: parts
    const vhc = workflows.vhc || {}; // VHC state
    if (vhc.required && vhc.status === "pending") return "high"; // Clear next step: VHC
    if (vhc.required && vhc.status === "completed" && !vhc.sentAt) return "high"; // Clear: send VHC
    if (vhc.required && vhc.status === "sent") return "medium"; // Waiting on external decision
    if (workflows.clocking?.active) return "high"; // Clear: work in progress
    return "medium"; // Ambiguous in-progress state
  }

  return "low"; // Unknown stage or conflicting signals
}

// Assess confidence in the overall summary quality.
export function assessSummaryConfidence(snapshot, summaryData) {
  if (!snapshot?.job) return "low"; // No job data

  let score = 0; // Count of available key fields
  if (snapshot.job.status) score += 1; // Job status present
  if (summaryData?.technician) score += 1; // Technician resolved
  if (summaryData?.trackingStatus && summaryData.trackingStatus !== "Not tracked") score += 1; // Tracking data available
  if (summaryData?.timeline?.length > 0 || (snapshot.timeline || []).length > 0) score += 1; // Timeline has entries
  if (summaryData?.nextStep) score += 1; // Next step inferred

  if (score >= 5) return "high"; // All key fields available
  if (score >= 3) return "medium"; // Most fields available
  return "low"; // Significant data gaps
}
