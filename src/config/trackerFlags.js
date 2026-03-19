// file location: src/config/trackerFlags.js
// Feature flags for the Job Progress Tracker AI-like enhancements.

const TRACKER_FLAGS = {
  smart_summary_enabled: true, // Show the Smart Summary block above the timeline
  ai_text_enhancement_enabled: false, // Placeholder for optional AI text refinement (not implemented yet)
  grouping_enabled: true, // Group related low-value timeline entries visually
  debug_mode_enabled: false, // Show raw status IDs and entry metadata in the tracker
};

// Read a tracker flag, allowing env var override via NEXT_PUBLIC_TRACKER_<KEY>.
export function getTrackerFlag(key) {
  const envKey = `NEXT_PUBLIC_TRACKER_${key.toUpperCase()}`; // Build env var name from flag key
  const envValue = typeof window !== "undefined"
    ? process.env[envKey] // Client-side reads from build-time env injection
    : process.env[envKey]; // Server-side reads directly from process.env
  if (envValue === "true") return true; // Env var explicitly enables the flag
  if (envValue === "false") return false; // Env var explicitly disables the flag
  return TRACKER_FLAGS[key] ?? false; // Fall back to default config value
}

// Return all flags as a resolved object for passing to components.
export function getAllTrackerFlags() {
  return {
    smart_summary_enabled: getTrackerFlag("smart_summary_enabled"),
    ai_text_enhancement_enabled: getTrackerFlag("ai_text_enhancement_enabled"),
    grouping_enabled: getTrackerFlag("grouping_enabled"),
    debug_mode_enabled: getTrackerFlag("debug_mode_enabled"),
  };
}

export default TRACKER_FLAGS;
