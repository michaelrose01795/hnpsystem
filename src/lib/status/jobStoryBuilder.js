// file location: src/lib/status/jobStoryBuilder.js
// Builds a 2-3 sentence natural-language narrative of the job's progress so far.
// Uses milestone/major timeline entries to construct a readable story.

import { shortDate } from "@/lib/status/timeUtils"; // Date formatting utility

// Flatten grouped entries to get individual items for story building.
function flattenEntries(entries) {
  const flat = []; // Output array
  (entries || []).forEach((entry) => {
    if (entry.group && entry.group.items) {
      entry.group.items.forEach((child) => flat.push(child)); // Expand groups
    } else {
      flat.push(entry); // Individual entries pass through
    }
  });
  return flat;
}

// Check if a status exists in the timeline entries.
function hasStatus(entries, status) {
  return entries.some((e) => e.status === status); // Simple status check
}

// Find the first entry with a given status.
function findEntry(entries, status) {
  return entries.find((e) => e.status === status) || null; // Find or null
}

// Get actor name from an entry, or null.
function getActor(entry) {
  if (!entry) return null; // Null guard
  const name = entry.userName || entry.actorName; // Try userName then actorName
  if (!name || name === "System") return null; // Exclude system actors
  return name;
}

// Main export: build a natural-language job story from snapshot and enhanced timeline.
export function buildJobStory(snapshot, enhancedTimeline = []) {
  if (!snapshot?.job) return ""; // No job data

  const entries = flattenEntries(enhancedTimeline); // Flatten all entries
  if (entries.length === 0 && (snapshot.timeline || []).length === 0) return ""; // No timeline data

  // Use enhanced entries if available, fall back to snapshot timeline.
  const timelineEntries = entries.length > 0 ? entries : (snapshot.timeline || []);

  const sentences = []; // Collect story sentences

  // Sentence 1: Booking and check-in context.
  const bookedEntry = findEntry(timelineEntries, "booked"); // Find booking event
  const checkedInEntry = findEntry(timelineEntries, "checked_in"); // Find check-in event

  if (bookedEntry && checkedInEntry) {
    const date = shortDate(checkedInEntry.timestamp || checkedInEntry.at); // Format check-in date
    const checkedInBy = getActor(checkedInEntry); // Who checked in
    const byClause = checkedInBy ? ` by ${checkedInBy}` : ""; // Optional actor clause
    sentences.push(date
      ? `Vehicle was booked and checked in${byClause} on ${date}.` // With date
      : `Vehicle was booked and checked in${byClause}.` // Without date
    );
  } else if (checkedInEntry) {
    const date = shortDate(checkedInEntry.timestamp || checkedInEntry.at); // Format date
    sentences.push(date
      ? `Vehicle was checked in on ${date}.` // Check-in only with date
      : "Vehicle was checked in." // Check-in only without date
    );
  } else if (bookedEntry) {
    const date = shortDate(bookedEntry.timestamp || bookedEntry.at); // Format date
    sentences.push(date
      ? `Job was booked on ${date}.` // Booking only with date
      : "Job was booked." // Booking only without date
    );
  }

  // Sentence 2: Workshop and VHC activity.
  const techStarted = findEntry(timelineEntries, "technician_started"); // Tech start event
  const techComplete = findEntry(timelineEntries, "technician_work_completed"); // Tech complete event
  const vhcComplete = findEntry(timelineEntries, "vhc_completed"); // VHC complete event
  const techName = getActor(techStarted) || getActor(techComplete); // Resolve technician name

  if (techComplete && vhcComplete) {
    const byClause = techName ? `${techName}` : "A technician"; // Actor or generic
    sentences.push(`${byClause} completed the workshop work and the VHC.`); // Both complete
  } else if (techComplete) {
    const byClause = techName ? `${techName}` : "A technician"; // Actor or generic
    sentences.push(`${byClause} completed the workshop work.`); // Tech work only
  } else if (techStarted && vhcComplete) {
    const byClause = techName ? `${techName}` : "A technician"; // Actor or generic
    sentences.push(`${byClause} started workshop work and the VHC was completed.`); // Tech started + VHC done
  } else if (techStarted) {
    const byClause = techName ? `${techName}` : "A technician"; // Actor or generic
    sentences.push(`${byClause} started workshop work.`); // Tech started only
  }

  // Sentence 3: Current state context.
  const overallStatus = snapshot.job.overallStatus; // Current main status
  const workflows = snapshot.workflows || {}; // Workflow states

  if (overallStatus === "released") {
    sentences.push("Vehicle has been released to the customer."); // Job complete
  } else if (overallStatus === "invoiced") {
    sentences.push("Job has been invoiced and is awaiting collection."); // Ready for pickup
  } else if (workflows.parts?.blocking) {
    const summary = workflows.parts.summary || {}; // Parts count
    const count = (summary.waiting || 0) + (summary.onOrder || 0); // Total waiting
    sentences.push(`Parts are currently on order (${count} item${count === 1 ? "" : "s"}).`); // Parts blocking
  } else if (hasStatus(timelineEntries, "wash_complete")) {
    sentences.push("Wash has been completed."); // Wash done
  } else if (hasStatus(timelineEntries, "customer_authorised")) {
    sentences.push("Customer has authorised additional work."); // Customer approved
  } else if (hasStatus(timelineEntries, "customer_declined")) {
    sentences.push("Customer declined the additional work."); // Customer declined
  } else if (overallStatus === "in_progress" && workflows.clocking?.active) {
    sentences.push("Work is currently in progress."); // Active work
  } else if (overallStatus === "in_progress") {
    sentences.push("Job is in progress."); // Generic in-progress
  } else if (overallStatus === "checked_in" && !techStarted) {
    sentences.push("Awaiting technician assignment."); // Waiting for tech
  }

  // Cap at 3 sentences for readability.
  return sentences.slice(0, 3).join(" ");
}
