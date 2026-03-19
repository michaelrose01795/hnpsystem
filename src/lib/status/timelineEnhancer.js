// file location: src/lib/status/timelineEnhancer.js
// Orchestrates all timeline enhancement passes: display titles, explanations,
// actor propagation, importance scoring, deduplication, phase/basic grouping,
// highlight tagging, and actor confidence assessment.

import { resolveDisplayTitle, resolveBadgeLabel, resolveExplanation } from "@/lib/status/timelineDisplayMap"; // Display mapping + explanations
import { groupTimelineEntries } from "@/lib/status/timelineGrouping"; // Basic grouping (fallback)
import { groupByPhase } from "@/lib/status/phaseGrouping"; // Phase-based grouping (preferred)
import { scoreImportance } from "@/lib/status/importanceScoring"; // Importance scoring
import { assessActorConfidence } from "@/lib/status/confidenceModel"; // Actor confidence model

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
// Case-insensitive to catch near-duplicates like "Darrell W" vs "Darrell w".
function buildEntryKey(item) {
  return [
    item?.kind || "",
    item?.status || "",
    item?.label || "",
    item?.department || "",
    item?.timestamp || "",
    item?.userId || "",
    (item?.userName || "").toLowerCase(), // Normalise actor name case
    item?.description || "",
    item?.meta?.location || "",
    item?.meta?.action || "",
    item?.meta?.notes || "",
  ].join("|").toLowerCase(); // Lowercase the entire key for case-insensitive dedup
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

// Step 2: Map explanation text onto each entry.
function applyExplanations(entries) {
  return entries.map((entry) => ({
    ...entry,
    explanation: resolveExplanation(entry), // Plain-English explanation or null
  }));
}

// Step 3: Propagate known actors to orphan adjacent entries.
// If entry N has no actor but N-1 and N+1 share the same actor within 2 min, assign it.
// Now tags propagated actors with _actorPropagated for confidence model.
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
      _actorPropagated: true, // Flag for confidence model
    };
  }

  return result;
}

// Step 4: Apply importance scores to each entry.
function applyImportanceScores(entries) {
  return entries.map((entry) => ({
    ...entry,
    ...scoreImportance(entry), // Merge importance and importanceLabel
  }));
}

// Build a short semantic key for same-status-same-time dedup.
// Catches duplicates from different sources (e.g., status history row + sub-status row for the same event).
function buildSemanticKey(item) {
  const status = (item?.status || "").toLowerCase(); // Normalised status
  const ts = item?.timestamp || ""; // Timestamp string
  // Round timestamp to the nearest minute for fuzzy matching.
  const roundedTs = ts ? ts.substring(0, 16) : ""; // "2026-03-18T13:03" — minute precision
  return `${status}|${roundedTs}`; // Semantic key
}

// Step 5: Deduplicate entries (ported from original JobProgressTracker.js).
function deduplicateEntries(entries) {
  const seen = new Set(); // Track seen dedup keys (full key)
  const seenSemantic = new Set(); // Track seen semantic keys (status + minute)

  return entries.filter((item) => {
    const dedupeKey = buildEntryKey(item); // Build unique key for this entry
    if (seen.has(dedupeKey)) return false; // Skip exact duplicates

    // Secondary dedup: same status at the same minute from different sources.
    const status = (item?.status || "").toLowerCase(); // Normalised status
    if (status) {
      const semanticKey = buildSemanticKey(item); // Short semantic key
      if (seenSemantic.has(semanticKey)) return false; // Skip same-status-same-minute duplicate
      seenSemantic.add(semanticKey); // Mark semantic key as seen
    }

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

// Step 7: Tag each entry with an isHighlighted boolean.
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

// Step 8: Apply actor confidence assessment to each entry.
function applyActorConfidence(entries) {
  return entries.map((entry) => ({
    ...entry,
    actorConfidence: assessActorConfidence(entry), // "high", "medium", or "low"
  }));
}

// Main export: run the full enhancement pipeline on raw timeline entries.
export function enhanceTimeline(entries, flags = {}) {
  if (!Array.isArray(entries) || entries.length === 0) return []; // Guard against invalid input

  let result = applyDisplayTitles(entries); // Step 1: display titles
  result = applyExplanations(result); // Step 2: explanation text
  result = propagateActors(result); // Step 3: actor propagation (with _actorPropagated flag)

  if (flags.importance_scoring_enabled) {
    result = applyImportanceScores(result); // Step 4: importance scoring
  }

  result = deduplicateEntries(result); // Step 5: deduplication

  // Step 6: grouping — prefer phase grouping, fall back to basic grouping.
  if (flags.phase_grouping_enabled) {
    result = groupByPhase(result); // Phase-based semantic grouping
  } else if (flags.grouping_enabled) {
    result = groupTimelineEntries(result); // Basic time-window clustering
  }

  result = tagHighlights(result); // Step 7: highlight tagging
  result = applyActorConfidence(result); // Step 8: actor confidence
  return result;
}
