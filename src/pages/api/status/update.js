// ✅ Connected to Supabase (server-side)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/api/status/update.js
import { createClient } from "@supabase/supabase-js"; // Import Supabase factory to optionally use service role credentials
import { supabase as browserSupabase } from "@/lib/supabaseClient"; // Import shared Supabase client for fallback usage
import {
  SERVICE_STATUS_FLOW,
  isValidTransition,
  getMainStatusMetadata,
  resolveMainStatusId,
  resolveSubStatusId,
} from "@/lib/status/statusFlow"; // Import status flow helpers for validation and metadata

// TODO: Delegate reads/writes to src/lib/database/jobs helpers so status updates share the same data layer as the rest of the app.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; // Read Supabase project URL from environment variables
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Read optional service role key for privileged access
const dbClient = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : browserSupabase; // Prefer service role when available to bypass RLS in server routes

const normalizeJobIdentifier = (raw) => {
  const trimmed = typeof raw === "string" ? raw.trim() : raw; // Normalise incoming identifier values
  if (trimmed === null || typeof trimmed === "undefined" || trimmed === "") {
    return { type: "invalid", value: null }; // Reject missing identifiers early
  }

  const numericValue = Number(trimmed); // Attempt numeric conversion for job ID
  if (Number.isInteger(numericValue) && !Number.isNaN(numericValue)) {
    return { type: "id", value: numericValue }; // Treat numeric values as primary keys
  }

  return { type: "job_number", value: String(trimmed) }; // Otherwise treat as external job number string
};

const buildStatusMetadata = (status) => {
  return getMainStatusMetadata(status); // Lookup metadata using main status flow
};

const REQUIRED_INVOICE_SUB_STATUSES = new Set([
  "technician_work_completed",
  "vhc_completed",
  "pricing_completed",
]);

const fetchSubStatusSet = async (jobId) => {
  const { data, error } = await dbClient
    .from("job_status_history")
    .select("to_status, from_status")
    .eq("job_id", jobId);

  if (error) {
    throw error;
  }

  const set = new Set();
  (data || []).forEach((row) => {
    const toId = resolveSubStatusId(row.to_status);
    const fromId = resolveSubStatusId(row.from_status);
    if (toId) set.add(toId);
    if (fromId) set.add(fromId);
  });

  return set;
};

const hasInvoiceForJob = async (jobId) => {
  const { data, error } = await dbClient
    .from("invoices")
    .select("id")
    .eq("job_id", jobId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.id);
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" }); // Enforce POST-only semantics
  }

  const { jobId: rawJobId, newStatus, userId, notes } = req.body || {}; // Extract payload fields from request body

  if (!rawJobId || !newStatus || !userId) {
    return res.status(400).json({
      error: "Missing required fields: jobId, newStatus, userId",
    }); // Validate presence of critical fields
  }

  const jobIdentifier = normalizeJobIdentifier(rawJobId); // Determine lookup strategy for the job record
  if (jobIdentifier.type === "invalid") {
    return res.status(400).json({ error: "Invalid job identifier" }); // Reject invalid identifiers
  }

  const normalizedTargetStatus = resolveMainStatusId(newStatus); // Normalise the target status for validation and metadata
  if (!normalizedTargetStatus) {
    return res.status(400).json({
      error: "Main job status required",
      message: "Use main statuses only: Booked, Checked In, In Progress, Invoiced, Complete.",
    }); // Reject empty or malformed statuses
  }

  try {
    const jobQuery = dbClient
      .from("jobs")
      .select(
        `id, job_number, status, status_updated_at, status_updated_by, created_at, updated_at`
      ); // Prepare query selecting metadata required for auditing

    if (jobIdentifier.type === "id") {
      jobQuery.eq("id", jobIdentifier.value); // Filter by numeric job ID when supplied
    } else {
      jobQuery.eq("job_number", jobIdentifier.value); // Otherwise match on job number string
    }

    jobQuery.limit(1); // Restrict to single result for safety

    const { data: jobRow, error: jobError } = await jobQuery.maybeSingle(); // Execute job lookup with tolerant response for empty set

    if (jobError && jobError.code !== "PGRST116") {
      throw jobError; // Bubble up unexpected database errors
    }

    if (!jobRow) {
      return res.status(404).json({ error: "Job not found" }); // Notify caller when job cannot be located
    }

    const normalizedCurrentStatus = resolveMainStatusId(jobRow.status); // Normalise existing status for comparison

    if (
      normalizedCurrentStatus &&
      normalizedTargetStatus &&
      SERVICE_STATUS_FLOW[normalizedCurrentStatus.toUpperCase()] &&
      !isValidTransition(normalizedCurrentStatus, normalizedTargetStatus)
    ) {
      const allowedNext =
        SERVICE_STATUS_FLOW[normalizedCurrentStatus.toUpperCase()]?.next || []; // Resolve allowed transitions for messaging
      return res.status(400).json({
        error: "Invalid status transition",
        from: normalizedCurrentStatus,
        to: normalizedTargetStatus,
        allowedNext,
      }); // Halt when transition violates configured flow
    }

    if (normalizedTargetStatus === "invoiced") {
      const subStatusSet = await fetchSubStatusSet(jobRow.id);
      const missing = Array.from(REQUIRED_INVOICE_SUB_STATUSES).filter(
        (status) => !subStatusSet.has(status)
      );
      if (missing.length) {
        return res.status(400).json({
          error: "Job not ready for invoicing",
          missingSubStatuses: missing,
        });
      }
    }

    if (normalizedTargetStatus === "complete") {
      const hasInvoice = await hasInvoiceForJob(jobRow.id);
      if (!hasInvoice) {
        return res.status(400).json({
          error: "Job cannot be completed without an invoice",
        });
      }
    }

    const timestamp = new Date().toISOString(); // Generate consistent timestamp for update + history insertion

    const statusMetadata = buildStatusMetadata(normalizedTargetStatus); // Retrieve metadata for the new status
    const targetStatusLabel = statusMetadata?.label || newStatus;

    const { data: updatedJob, error: updateError } = await dbClient
      .from("jobs")
      .update({
        status: targetStatusLabel,
        status_updated_at: timestamp,
        status_updated_by: String(userId),
        updated_at: timestamp,
      })
      .eq("id", jobRow.id)
      .select(
        `id, job_number, status, status_updated_at, status_updated_by, created_at, updated_at`
      )
      .single(); // Persist status change and retrieve updated row for response

    if (updateError) {
      throw updateError; // Surface update failures to caller
    }

    const { data: historyEntry, error: historyError } = await dbClient
      .from("job_status_history")
      .insert([
        {
          job_id: jobRow.id,
          from_status: jobRow.status || null,
          to_status: targetStatusLabel,
          changed_by: String(userId),
          reason: notes || null,
          changed_at: timestamp,
        },
      ])
      .select("id, job_id, from_status, to_status, changed_by, reason, changed_at")
      .single(); // Record the status transition in the audit history table

    if (historyError) {
      throw historyError; // Surface insert failures to caller
    }

    if (statusMetadata?.notifyDepartment) {
      console.log(
        `Notification queued for department: ${statusMetadata.notifyDepartment}`
      ); // Placeholder hook for department notifications
    }

    if (Array.isArray(statusMetadata?.notifyDepartments)) {
      statusMetadata.notifyDepartments.forEach((dept) =>
        console.log(`Notification queued for department: ${dept}`)
      ); // Placeholder multi-department notification hook
    }

    if (statusMetadata?.notifyCustomer) {
      console.log("Customer notification queued for status update"); // Placeholder hook for customer messaging
    }

    if (statusMetadata?.pausesTime) {
      console.log("Job timer paused due to status change"); // Placeholder integration for pausing timers
    } else {
      console.log("Job timer continues to run for this status"); // Placeholder integration for resuming timers
    }

    return res.status(200).json({
      success: true,
      message: "Status updated successfully",
      jobId: updatedJob.id,
      jobNumber: updatedJob.job_number,
      status: normalizedTargetStatus,
      rawStatus: updatedJob.status,
      statusLabel: statusMetadata?.label || updatedJob.status,
      timestamp,
      historyEntry,
      metadata: {
        department: statusMetadata?.department || null,
        color: statusMetadata?.color || null,
        pausesTime: Boolean(statusMetadata?.pausesTime),
        notifyDepartment: statusMetadata?.notifyDepartment || null,
        notifyDepartments: statusMetadata?.notifyDepartments || [],
        notifyCustomer: Boolean(statusMetadata?.notifyCustomer),
      },
    }); // Return enriched payload to inform calling UI of the successful transition
  } catch (error) {
    console.error("Error updating status:", error); // Log server-side error for observability
    return res.status(500).json({ error: "Internal server error" }); // Mask internal error details from client
  }
}
