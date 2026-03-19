// file location: src/lib/status/timelineEnhancer.js
// Orchestrates all timeline enhancement passes: display titles, actor propagation,
// deduplication, grouping, and highlight tagging.

import { resolveDisplayTitle, resolveBadgeLabel } from "@/lib/status/timelineDisplayMap"; // Clean display title mapping
import { groupTimelineEntries } from "@/lib/status/timelineGrouping"; // Visual grouping logic

// Statuses that count as "highlighted" (important, not noise).
const HIGHLIGHTED_KINDS = new Set(["status"]); // Main status changes are always highlighted
const HIGHLIGHTED_STATUSES = new Set([ // Specific sub-statuses worth highlighting
  "technician_started", "technician_work_completed",
  "vhc_completed", "customer_authorised", "customer_declined",
  "wash_complete", "mot_completed", "ready_for_invoice",
]);
const NOISE_EVENT_TYPES = new Set([ // Event types considered low-value noise
  "vehicle_tracking", "key_tracking", "tracking_registered",
]);

// Build a dedup key from an entry's core fields.
function buildEntryKey(item) {
  return [
    item?.kind || "",
    item?.status || "",
    item?.label || "",
    item?.department || "",
    item?.timestamp || "",
    item?.userId || "",
    item?.userName || "",
    item?.description || "",
    item?.meta?.location || "",
    item?.meta?.action || "",
    item?.meta?.notes || "",
  ].join("|"); // Concatenate all fields into a single key
}

// Check if two timestamps are within 60 seconds of each other.
function isSameMinute(left, right) {
  if (!left || !right) return false; // Guard against missing timestamps
  const leftMs = new Date(left).getTime(); // Parse left timestamp
  const rightMs = new Date(right).getTime(); // Parse right timestamp
  if (Number.isNaN(leftMs) || Number.isNaN(rightMs)) return false; // Guard against invalid dates
  return Math.abs(leftMs - rightMs) < 60000; // Within 60 seconds
}

// Step 1: Map display titles and badge labels onto each entry.
function applyDisplayTitles(entries) {
  return entries.map((entry) => ({
    ...entry,
    displayTitle: resolveDisplayTitle(entry), // Clean user-facing title
    badgeLabel: resolveBadgeLabel(entry), // Category badge label
  }));
}

// Step 2: Propagate known actors to orphan adjacent entries.
// If entry N has no actor but N-1 and N+1 share the same actor within 2 min, assign it.
function propagateActors(entries) {
  if (entries.length < 3) return entries; // Need at least 3 entries for propagation
  const result = [...entries]; // Clone to avoid mutation

  for (let i = 1; i < result.length - 1; i++) {
    const current = result[i]; // Current entry
    if (current.userName || current.userId) continue; // Already has an actor, skip

    const prev = result[i - 1]; // Previous entry
    const next = result[i + 1]; // Next entry
    const prevActor = prev?.userName || null; // Previous actor name
    const nextActor = next?.userName || null; // Next actor name

    if (!prevActor || !nextActor) continue; // Need actors on both sides
    if (prevActor !== nextActor) continue; // Actors must match

    // Check both neighbours are within 2 minutes of the current entry.
    const withinRange =
      isSameMinute(prev.timestamp, current.timestamp) &&
      isSameMinute(current.timestamp, next.timestamp);
    if (!withinRange) continue; // Too far apart temporally

    result[i] = {
      ...current,
      userName: prevActor, // Assign the shared actor
      userId: prev.userId || next.userId || null, // Carry over user ID if available
    };
  }

  return result;
}

// Step 3: Deduplicate entries (ported from JobProgressTracker.js).
function deduplicateEntries(entries) {
  const seen = new Set(); // Track seen dedup keys

  return entries.filter((item) => {
    const dedupeKey = buildEntryKey(item); // Build unique key for this entry
    if (seen.has(dedupeKey)) return false; // Skip exact duplicates

    // Suppress initial clocking entries that overlap with a technician_started event.
    const isInitialClocking =
      item?.eventType === "clocking" &&
      String(item?.meta?.workType || "").toLowerCase() === "initial";

    if (isInitialClocking) {
      const hasMatchingStart = entries.some((candidate) => {
        if (candidate === item) return false; // Don't match against self
        const candidateStatus = String(candidate?.status || candidate?.label || "").toLowerCase();
        return (
          candidateStatus === "technician_started" ||
          candidateStatus === "technician started"
        ) &&
          (candidate?.userId || null) === (item?.userId || null) &&
          isSameMinute(candidate?.timestamp, item?.timestamp);
      });
      if (hasMatchingStart) return false; // Suppress the clocking entry in favour of technician_started
    }

    seen.add(dedupeKey); // Mark as seen
    return true; // Keep the entry
  });
}

// Step 4: Tag each entry with an isHighlighted boolean.
function tagHighlights(entries) {
  return entries.map((entry) => {
    // If this is a group wrapper, tag it as highlighted if any child is highlighted.
    if (entry.group) {
      const anyChildHighlighted = (entry.group.items || []).some(
        (child) => HIGHLIGHTED_KINDS.has(child.kind) || HIGHLIGHTED_STATUSES.has(child.status)
      );
      return { ...entry, isHighlighted: anyChildHighlighted };
    }

    // Individual entries: check kind and status.
    if (HIGHLIGHTED_KINDS.has(entry.kind)) return { ...entry, isHighlighted: true };
    if (HIGHLIGHTED_STATUSES.has(entry.status)) return { ...entry, isHighlighted: true };
    if (NOISE_EVENT_TYPES.has(entry.eventType)) return { ...entry, isHighlighted: false };
    return { ...entry, isHighlighted: true }; // Default to highlighted for unknown types
  });
}

// Main export: run the full enhancement pipeline on raw timeline entries.
export function enhanceTimeline(entries, flags = {}) {
  if (!Array.isArray(entries) || entries.length === 0) return []; // Guard against invalid input

  let result = applyDisplayTitles(entries); // Step 1: display titles
  result = propagateActors(result); // Step 2: actor propagation
  result = deduplicateEntries(result); // Step 3: deduplication

  if (flags.grouping_enabled) {
    result = groupTimelineEntries(result); // Step 4: visual grouping
  }

  result = tagHighlights(result); // Step 5: highlight tagging
  return result;
}
