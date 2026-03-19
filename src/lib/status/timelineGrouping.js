// file location: src/lib/status/timelineGrouping.js
// Groups related low-value timeline entries for visual collapsing.
// This is a display-layer transformation only — audit entries remain intact.

import { formatDuration, withinWindow } from "@/lib/status/timeUtils"; // Shared time utilities

const TRACKING_EVENT_TYPES = new Set(["vehicle_tracking", "key_tracking", "tracking_registered"]); // Event types that form tracking clusters
const VHC_EVENT_STATUSES = new Set([ // Sub-status IDs that belong to the VHC workflow
  "vhc_started", "vhc_reopened", "vhc_completed",
  "waiting_for_pricing", "pricing_completed",
  "sent_to_customer", "customer_authorised", "customer_declined",
]);
const CLUSTER_WINDOW_MS = 5 * 60 * 1000; // 5 minutes — max gap between entries in a tracking cluster

// Identify and group consecutive tracking events into clusters.
function groupTrackingClusters(entries) {
  const result = []; // Output array with grouped entries
  let cluster = []; // Accumulator for current tracking cluster

  const flushCluster = () => {
    if (cluster.length <= 1) {
      cluster.forEach((entry) => result.push(entry)); // Single entries pass through
    } else {
      result.push({
        ...cluster[0], // Use first entry as the base for timestamp and position
        group: {
          groupId: `tracking-${cluster[0].timestamp}`, // Unique ID for expand/collapse state
          groupLabel: `Tracking Updates (${cluster.length})`, // Display label with count
          items: cluster, // Child entries for expanded view
          isCollapsible: true, // Allow user to expand/collapse
        },
      });
    }
    cluster = []; // Reset accumulator
  };

  entries.forEach((entry) => {
    const isTracking = TRACKING_EVENT_TYPES.has(entry.eventType); // Check if entry is a tracking event
    if (isTracking) {
      if (cluster.length === 0 || withinWindow(cluster[cluster.length - 1].timestamp, entry.timestamp, CLUSTER_WINDOW_MS)) {
        cluster.push(entry); // Add to current cluster if within time window
      } else {
        flushCluster(); // Close current cluster and start a new one
        cluster.push(entry);
      }
    } else {
      flushCluster(); // Non-tracking entry breaks the cluster
      result.push(entry); // Pass through as-is
    }
  });

  flushCluster(); // Flush any remaining cluster at the end
  return result;
}

// Identify and group consecutive clocking pairs (clock-on followed by clock-off for same user).
// Exported as a named export so phaseGrouping.js can reuse it.
export function groupClockingPairs(entries) {
  const result = []; // Output array
  let i = 0; // Index cursor

  while (i < entries.length) {
    const current = entries[i]; // Current entry
    const next = entries[i + 1] || null; // Next entry (if any)

    // Check if current and next form a clock-on / clock-off pair for the same user.
    const isClockOn = current.eventType === "clocking" && !current.meta?.clockOut; // Clock-on has no clockOut
    const isClockOff = next?.eventType === "clocking" && next?.meta?.clockOut; // Clock-off has clockOut
    const sameUser = current.userId && next?.userId && String(current.userId) === String(next.userId); // Same technician

    if (isClockOn && isClockOff && sameUser) {
      const clockInMs = new Date(current.meta?.clockIn || current.timestamp).getTime(); // Parse clock-in time
      const clockOutMs = new Date(next.meta?.clockOut).getTime(); // Parse clock-out time
      const durationSeconds = (!Number.isNaN(clockInMs) && !Number.isNaN(clockOutMs) && clockOutMs > clockInMs)
        ? Math.floor((clockOutMs - clockInMs) / 1000) // Calculate duration in seconds
        : 0;
      const durationLabel = formatDuration(durationSeconds); // Human-readable duration
      const techName = current.userName || next.userName || "Technician"; // Resolve technician name

      result.push({
        ...current, // Use clock-on entry as the base
        group: {
          groupId: `clocking-${current.timestamp}-${current.userId}`, // Unique ID
          groupLabel: durationLabel
            ? `${techName} Session: ${durationLabel}` // Include duration when calculable
            : `${techName} Session`, // Fallback without duration
          items: [current, next], // Both entries in the group
          isCollapsible: true,
        },
      });
      i += 2; // Skip both entries
    } else {
      result.push(current); // Pass through non-paired entry
      i += 1;
    }
  }

  return result;
}

// Identify and group consecutive VHC workflow sub-status events.
function groupVhcWorkflow(entries) {
  const result = []; // Output array
  let cluster = []; // Accumulator for VHC cluster

  const flushCluster = () => {
    if (cluster.length <= 1) {
      cluster.forEach((entry) => result.push(entry)); // Single entries pass through
    } else {
      result.push({
        ...cluster[0], // Use first entry as the base
        group: {
          groupId: `vhc-${cluster[0].timestamp}`, // Unique ID
          groupLabel: `VHC Workflow (${cluster.length})`, // Display label with count
          items: cluster, // Child entries
          isCollapsible: true,
        },
      });
    }
    cluster = []; // Reset accumulator
  };

  entries.forEach((entry) => {
    const isVhc = VHC_EVENT_STATUSES.has(entry.status); // Check if entry is a VHC sub-status
    if (isVhc) {
      cluster.push(entry); // Add to VHC cluster
    } else {
      flushCluster(); // Non-VHC entry breaks the cluster
      result.push(entry);
    }
  });

  flushCluster(); // Flush any remaining cluster
  return result;
}

// Main export: run all grouping passes on the timeline entries.
// Kept for backward compatibility — phaseGrouping.js is the preferred grouping engine.
export function groupTimelineEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return []; // Guard against invalid input
  let result = groupTrackingClusters(entries); // First pass: tracking clusters
  result = groupClockingPairs(result); // Second pass: clocking pairs
  result = groupVhcWorkflow(result); // Third pass: VHC workflow clusters
  return result;
}
