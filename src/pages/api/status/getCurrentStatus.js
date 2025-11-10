// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/api/status/getCurrentStatus.js
import { createClient } from "@supabase/supabase-js"; // Import Supabase factory for service role usage
import { supabase as browserSupabase } from "@/lib/supabaseClient"; // Import shared Supabase client for fallback use
import { SERVICE_STATUS_FLOW } from "@/lib/status/statusFlow"; // Import status flow definition for metadata enrichment

// TODO: Replace these inline Supabase queries with src/lib/database/jobs helpers (getDashboardData/getCurrentStatus) for consistency.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; // Read Supabase project URL from environment
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Read optional service role key for server-side elevated access
const dbClient = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : browserSupabase; // Prefer service role client when available to bypass RLS restrictions

const normalizeJobIdentifier = (raw) => {
  const trimmed = typeof raw === "string" ? raw.trim() : raw; // Ensure incoming identifier is trimmed
  if (trimmed === null || typeof trimmed === "undefined" || trimmed === "") {
    return { type: "invalid", value: null }; // Reject empty identifiers
  }

  const numericValue = Number(trimmed); // Attempt numeric conversion for job ID lookups
  if (Number.isInteger(numericValue) && !Number.isNaN(numericValue)) {
    return { type: "id", value: numericValue }; // Treat as primary key ID
  }

  return { type: "job_number", value: String(trimmed) }; // Default to job number lookups
};

const normalizeStatusId = (status) => {
  if (!status) return null; // Guard against missing statuses
  return String(status)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_"); // Convert to snake_case identifier used throughout the app
};

const buildStatusMetadata = (status) => {
  const normalizedId = normalizeStatusId(status); // Normalize the status to snake_case
  const statusConfig = normalizedId
    ? SERVICE_STATUS_FLOW[normalizedId.toUpperCase()]
    : null; // Resolve metadata from status flow map

  return {
    id: normalizedId,
    label: statusConfig?.label || status || null,
    department: statusConfig?.department || null,
    pausesTime: Boolean(statusConfig?.pausesTime),
    color: statusConfig?.color || null,
  }; // Provide enriched metadata for UI consumers
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" }); // Reject unsupported HTTP verbs
  }

  const { jobId: rawJobId } = req.query; // Extract job identifier from query string
  const jobIdentifier = normalizeJobIdentifier(rawJobId); // Determine whether jobId references ID or job number

  if (jobIdentifier.type === "invalid") {
    return res.status(400).json({ error: "Missing jobId parameter" }); // Fail fast when identifier is absent
  }

  try {
    const jobQuery = dbClient
      .from("jobs")
      .select(
        `id, job_number, status, status_updated_at, status_updated_by, created_at, updated_at`
      ); // Prepare query for essential job metadata

    if (jobIdentifier.type === "id") {
      jobQuery.eq("id", jobIdentifier.value); // Filter by primary key when numeric job ID supplied
    } else {
      jobQuery.eq("job_number", jobIdentifier.value); // Otherwise filter by external job number string
    }

    jobQuery.limit(1); // Constrain to a single row for safety

    const { data: jobRow, error: jobError } = await jobQuery.maybeSingle(); // Execute query with graceful empty handling

    if (jobError && jobError.code !== "PGRST116") {
      throw jobError; // Surface unexpected database errors
    }

    if (!jobRow) {
      return res.status(404).json({ success: false, error: "Job not found" }); // Inform caller when no job matches identifier
    }

    const { data: lastHistoryRow, error: historyError } = await dbClient
      .from("job_status_history")
      .select("to_status, changed_at, changed_by")
      .eq("job_id", jobRow.id)
      .order("changed_at", { ascending: false })
      .limit(1)
      .maybeSingle(); // Fetch the most recent status history entry for context

    if (historyError && historyError.code !== "PGRST116") {
      throw historyError; // Surface unexpected history query errors
    }

    const statusMetadata = buildStatusMetadata(jobRow.status); // Enrich status with timeline metadata

    return res.status(200).json({
      success: true,
      jobId: jobRow.id,
      jobNumber: jobRow.job_number,
      status: statusMetadata.id || normalizeStatusId(jobRow.status) || jobRow.status,
      statusLabel: statusMetadata.label,
      department: statusMetadata.department,
      color: statusMetadata.color,
      pausesTime: statusMetadata.pausesTime,
      lastUpdated:
        jobRow.status_updated_at ||
        lastHistoryRow?.changed_at ||
        jobRow.updated_at ||
        jobRow.created_at,
      updatedBy: jobRow.status_updated_by || lastHistoryRow?.changed_by || null,
      rawStatus: jobRow.status,
    }); // Return structured payload consumed by status widgets
  } catch (error) {
    console.error("Error fetching current status:", error); // Log server-side for observability
    return res.status(500).json({ error: "Internal server error" }); // Protect internal error details from client
  }
}
