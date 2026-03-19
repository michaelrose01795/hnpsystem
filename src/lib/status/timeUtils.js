// file location: src/lib/status/timeUtils.js
// Shared time utilities used across the tracker enhancement layer.

// Format a timestamp as a relative time string ("5 min ago", "2 hours ago").
export function relativeTime(timestamp) {
  if (!timestamp) return null; // No timestamp to format
  const ms = new Date(timestamp).getTime(); // Parse timestamp to milliseconds
  if (Number.isNaN(ms)) return null; // Invalid date guard
  const diffMs = Date.now() - ms; // Milliseconds since the event
  const diffMin = Math.floor(diffMs / 60000); // Convert to minutes
  if (diffMin < 1) return "just now"; // Less than a minute ago
  if (diffMin < 60) return `${diffMin} min ago`; // Minutes
  const diffHours = Math.floor(diffMin / 60); // Convert to hours
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`; // Hours
  const diffDays = Math.floor(diffHours / 24); // Convert to days
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`; // Days
}

// Format seconds into a human-readable duration string.
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return null; // No duration to display
  const hours = Math.floor(seconds / 3600); // Calculate whole hours
  const minutes = Math.floor((seconds % 3600) / 60); // Calculate remaining minutes
  if (hours > 0) return `${hours}h ${minutes}m`; // Hours and minutes
  return `${minutes}m`; // Minutes only
}

// Return the number of hours (as a float) since the given timestamp.
export function hoursSince(timestamp) {
  if (!timestamp) return 0; // No timestamp means zero hours
  const ms = new Date(timestamp).getTime(); // Parse timestamp to milliseconds
  if (Number.isNaN(ms)) return 0; // Invalid date guard
  const diffMs = Date.now() - ms; // Milliseconds since the event
  return diffMs / 3600000; // Convert to hours as a float
}

// Check if two timestamps are within a given window in milliseconds.
export function withinWindow(timestampA, timestampB, windowMs) {
  if (!timestampA || !timestampB) return false; // Guard against missing timestamps
  const msA = new Date(timestampA).getTime(); // Parse first timestamp
  const msB = new Date(timestampB).getTime(); // Parse second timestamp
  if (Number.isNaN(msA) || Number.isNaN(msB)) return false; // Guard against invalid dates
  return Math.abs(msA - msB) <= windowMs; // Compare distance against window
}

// Format a timestamp as a short date string (e.g. "18 Mar").
export function shortDate(timestamp) {
  if (!timestamp) return null; // No timestamp to format
  const date = new Date(timestamp); // Parse the timestamp
  if (Number.isNaN(date.getTime())) return null; // Invalid date guard
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); // Short format
}
