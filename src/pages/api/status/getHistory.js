// ✅ Connected to Supabase (server-side)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/api/status/getHistory.js
import { createClient } from "@supabase/supabase-js"; // Import Supabase factory for privileged server access
import { supabase as browserSupabase } from "@/lib/supabaseClient"; // Import shared Supabase client as fallback
import { SERVICE_STATUS_FLOW } from "@/lib/status/statusFlow"; // Import status metadata map for enrichment

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; // Read Supabase project URL from environment
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Read optional service role key for elevated permissions
const dbClient = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : browserSupabase; // Prefer service role client when available for unrestricted reads

const normalizeJobIdentifier = (raw) => {
  const trimmed = typeof raw === "string" ? raw.trim() : raw; // Trim whitespace from incoming identifiers
  if (trimmed === null || typeof trimmed === "undefined" || trimmed === "") {
    return { type: "invalid", value: null }; // Flag missing identifiers as invalid
  }

  const numericValue = Number(trimmed); // Attempt to coerce into numeric job ID
  if (Number.isInteger(numericValue) && !Number.isNaN(numericValue)) {
    return { type: "id", value: numericValue }; // Treat numeric values as primary key IDs
  }

  return { type: "job_number", value: String(trimmed) }; // Otherwise treat as external job number string
};

const normalizeStatusId = (status) => {
  if (!status) return null; // Guard clause for falsy inputs
  return String(status)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_"); // Convert textual statuses to snake_case identifiers
};

const buildStatusPayload = (statusText) => {
  const normalizedId = normalizeStatusId(statusText); // Derive snake_case identifier from stored text
  if (!normalizedId) {
    return {
      id: null,
      label: statusText || null,
      color: null,
      department: null,
      pausesTime: true,
    }; // Provide minimal payload when status cannot be resolved
  }

  const statusConfig = SERVICE_STATUS_FLOW[normalizedId.toUpperCase()] || null; // Lookup metadata from status flow map

  return {
    id: normalizedId,
    label: statusConfig?.label || statusText || normalizedId,
    color: statusConfig?.color || null,
    department: statusConfig?.department || null,
    pausesTime: Boolean(statusConfig?.pausesTime),
  }; // Return normalized status payload used by UI timeline
};

const attachDurations = (entries, nowIso) => {
  const nowMs = new Date(nowIso).getTime(); // Convert reference timestamp to milliseconds
  return entries.map((entry, index) => {
    const currentStart = new Date(entry.timestamp).getTime(); // Convert entry timestamp into milliseconds
    const nextStart =
      index < entries.length - 1
        ? new Date(entries[index + 1].timestamp).getTime()
        : nowMs; // Determine end boundary using next entry or "now"

    const hasValidRange = Number.isFinite(currentStart) && Number.isFinite(nextStart) && nextStart >= currentStart; // Check for valid times
    const durationSeconds = hasValidRange
      ? Math.floor((nextStart - currentStart) / 1000)
      : 0; // Compute duration in seconds when valid

    return {
      ...entry,
      duration: durationSeconds,
    }; // Merge duration into entry payload
  });
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" }); // Enforce GET-only semantics for history endpoint
  }

  const { jobId: rawJobId } = req.query; // Extract job identifier from query parameters
  const jobIdentifier = normalizeJobIdentifier(rawJobId); // Determine lookup mode for job records

  if (jobIdentifier.type === "invalid") {
    return res.status(400).json({ error: "Missing jobId parameter" }); // Fail fast when identifier is absent
  }

  try {
    const jobQuery = dbClient
      .from("jobs")
      .select(
        `id, job_number, status, status_updated_at, status_updated_by, created_at, updated_at`
      ); // Prepare base query for job metadata

    if (jobIdentifier.type === "id") {
      jobQuery.eq("id", jobIdentifier.value); // Filter by primary key ID when numeric identifier provided
    } else {
      jobQuery.eq("job_number", jobIdentifier.value); // Otherwise match against job number column
    }

    jobQuery.limit(1); // Restrict to single job row for determinism

    const { data: jobRow, error: jobError } = await jobQuery.maybeSingle(); // Execute lookup with graceful handling of empty results

    if (jobError && jobError.code !== "PGRST116") {
      throw jobError; // Bubble up unexpected database errors
    }

    if (!jobRow) {
      return res.status(404).json({ error: "Job not found" }); // Inform caller when job is missing
    }

    const { data: historyRows, error: historyError } = await dbClient
      .from("job_status_history")
      .select("id, from_status, to_status, changed_by, reason, changed_at")
      .eq("job_id", jobRow.id)
      .order("changed_at", { ascending: true }); // Retrieve ordered status history entries

    if (historyError) {
      throw historyError; // Surface history query issues
    }

    const baselineEntries = (historyRows || []).map((row) => {
      const statusPayload = buildStatusPayload(row.to_status || row.from_status); // Build metadata payload for the history status
      return {
        id: row.id,
        status: statusPayload.id,
        statusLabel: statusPayload.label,
        timestamp: row.changed_at,
        userId: row.changed_by || null,
        reason: row.reason || null,
        color: statusPayload.color,
        department: statusPayload.department,
        pausesTime: statusPayload.pausesTime,
      }; // Normalise the database row into API response shape
    });

    if (baselineEntries.length === 0 && jobRow.status) {
      const statusPayload = buildStatusPayload(jobRow.status); // Create synthetic entry when history is empty
      baselineEntries.push({
        id: null,
        status: statusPayload.id,
        statusLabel: statusPayload.label,
        timestamp:
          jobRow.status_updated_at || jobRow.updated_at || jobRow.created_at || new Date().toISOString(),
        userId: jobRow.status_updated_by || null,
        reason: null,
        color: statusPayload.color,
        department: statusPayload.department,
        pausesTime: statusPayload.pausesTime,
      });
    }

    const referenceNow = new Date().toISOString(); // Capture reference timestamp for duration calculations
    const timelineEntries = attachDurations(baselineEntries, referenceNow); // Attach computed durations to each entry

    const totalRecordedSeconds = timelineEntries.reduce(
      (total, entry) => total + (entry.duration || 0),
      0
    ); // Calculate total recorded seconds across all statuses

    const totalActiveSeconds = timelineEntries.reduce((total, entry) => {
      if (entry.pausesTime === false) {
        return total + (entry.duration || 0); // Sum durations only for statuses where time is active
      }
      return total;
    }, 0);

    const currentStatusPayload = buildStatusPayload(jobRow.status); // Prepare metadata for the job's current status

    return res.status(200).json({
      success: true,
      jobId: jobRow.id,
      jobNumber: jobRow.job_number,
      currentStatus: currentStatusPayload.id,
      currentStatusLabel: currentStatusPayload.label,
      history: timelineEntries,
      totalTime: totalActiveSeconds,
      totalRecordedTime: totalRecordedSeconds,
      generatedAt: referenceNow,
    }); // Respond with structured timeline data for UI consumption
  } catch (error) {
    console.error("Error fetching status history:", error); // Log server-side error for observability
    return res.status(500).json({ error: "Internal server error" }); // Mask underlying error details from caller
  }
}
