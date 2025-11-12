// file location: src/pages/api/parts/job-items/index.js
import { listJobItems, createJobItem } from "@/lib/database/parts"; // Import job item data helpers.
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"; // Resolve the caller's role for RBAC.

const WRITE_ROLE_KEYWORDS = ["tech", "parts", "manager", "admin"]; // Role keywords permitted to create records.
const VALID_STATUSES = new Set(["pending", "awaiting_stock", "allocated", "picked", "fitted", "cancelled"]); // Allowed statuses.

const normaliseRole = (role) => (typeof role === "string" ? role.trim().toLowerCase() : ""); // Lowercase helper for comparisons.

const hasWriteAccess = (role) => WRITE_ROLE_KEYWORDS.some((keyword) => normaliseRole(role).includes(keyword)); // Evaluate RBAC.

const normaliseStatus = (status) => { // Validate and normalise status input.
  if (!status) { // Reject missing status values.
    return null; // Return null to trigger validation downstream.
  } // Close guard.
  const lower = status.toLowerCase(); // Lowercase for comparison.
  return VALID_STATUSES.has(lower) ? lower : null; // Return normalised value or null if invalid.
};

export default async function handler(req, res) { // API handler for listing and creating job items.
  try { // Wrap logic in try/catch for consistent error responses.
    if (req.method === "GET") { // Handle list by job id.
      const { jobId, job_id } = req.query || {}; // Extract query parameters supporting both casings.
      const resolvedJobId = job_id ?? jobId; // Prefer snake_case to align with database column.
      if (!resolvedJobId) { // Require a job id for listing.
        res.status(400).json({ ok: false, error: "job_id query param is required" }); // Return validation error.
        return; // Exit handler.
      }
      const items = await listJobItems(resolvedJobId); // Fetch job-linked parts.
      res.status(200).json({ ok: true, data: items }); // Return results.
      return; // Exit handler after responding.
    }

    if (req.method === "POST") { // Handle creation of a new job item.
      const user = await getUserFromRequest(req); // Resolve caller role.
      if (!hasWriteAccess(user?.role)) { // Enforce Tech/Parts/Manager/Admin permissions.
        res.status(403).json({ ok: false, error: "Insufficient permissions" }); // Return forbidden response.
        return; // Exit early when not authorised.
      }

      const body = req.body || {}; // Capture request payload.
      const jobId = body.job_id ?? body.jobId; // Accept both casings for job id.
      const partId = body.part_id ?? body.partId; // Accept both casings for part id.
      const status = normaliseStatus(body.status || "pending"); // Normalise status with default pending.

      if (!jobId || !partId) { // Validate required identifiers.
        res.status(400).json({ ok: false, error: "job_id and part_id are required" }); // Return validation error.
        return; // Exit handler.
      }

      if (!status) { // Ensure status is valid.
        res.status(400).json({ ok: false, error: "Invalid status provided" }); // Return validation error.
        return; // Exit handler.
      }

      const payload = { // Build payload forwarded to data layer.
        job_id: jobId, // Provide job reference.
        part_id: partId, // Provide part reference.
        status, // Provide validated status.
        quantity_requested: body.quantity_requested ?? body.quantityRequested ?? 0, // Pass raw counts for normalisation downstream.
        quantity_allocated: body.quantity_allocated ?? body.quantityAllocated ?? 0, // Pass allocated quantity.
        quantity_fitted: body.quantity_fitted ?? body.quantityFitted ?? 0, // Pass fitted quantity.
        request_notes: body.request_notes ?? body.requestNotes ?? null, // Optional notes.
        pre_pick_location: body.pre_pick_location ?? body.prePickLocation ?? null, // Optional pre-pick location.
        storage_location: body.storage_location ?? body.storageLocation ?? null, // Optional storage bin.
        unit_cost: body.unit_cost ?? body.unitCost ?? null, // Optional cost.
        unit_price: body.unit_price ?? body.unitPrice ?? null, // Optional price.
        origin: body.origin ?? null, // Optional origin tag.
        allocated_by: body.allocated_by ?? body.allocatedBy ?? null, // Optional allocated-by id.
        picked_by: body.picked_by ?? body.pickedBy ?? null, // Optional picked-by id.
        fitted_by: body.fitted_by ?? body.fittedBy ?? null, // Optional fitted-by id.
      }; // Close payload object.

      const created = await createJobItem(payload); // Insert the job item.
      res.status(201).json({ ok: true, data: created }); // Return created record.
      return; // Exit handler after responding.
    }

    res.setHeader("Allow", ["GET", "POST"]); // Advertise supported methods.
    res.status(405).json({ ok: false, error: `Method ${req.method} not allowed` }); // Return method-not-allowed.
  } catch (error) { // Catch unhandled exceptions.
    console.error("/api/parts/job-items error", error); // Emit diagnostic log.
    res.status(500).json({ ok: false, error: error?.message || "Unexpected error" }); // Return generic error response.
  }
}
