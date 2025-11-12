// file location: src/pages/api/vhc/declinations/index.js
import { createDeclination } from "@/lib/database/vhc"; // Import VHC declination helper.
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"; // Resolve caller context for RBAC enforcement.

const SERVICE_ROLE_KEYWORDS = ["service", "manager", "admin"]; // Roles allowed to record declinations.

const normaliseRole = (role) => (typeof role === "string" ? role.trim().toLowerCase() : ""); // Lowercase helper for comparisons.

const hasServicePrivileges = (role) => SERVICE_ROLE_KEYWORDS.some((keyword) => normaliseRole(role).includes(keyword)); // Evaluate RBAC.

export default async function handler(req, res) { // API handler for recording VHC declinations.
  if (req.method !== "POST") { // Only POST is supported.
    res.setHeader("Allow", ["POST"]); // Advertise supported method.
    res.status(405).json({ ok: false, error: `Method ${req.method} not allowed` }); // Return method-not-allowed response.
    return; // Exit early for unsupported verbs.
  }

  try { // Wrap logic in try/catch for consistent error handling.
    const user = await getUserFromRequest(req); // Resolve caller role.
    if (!hasServicePrivileges(user?.role)) { // Enforce Service/Manager/Admin permissions.
      res.status(403).json({ ok: false, error: "Insufficient permissions" }); // Return forbidden response.
      return; // Exit early when not authorised.
    }

    const { job_id, jobId, declined_by, declinedBy, customer_notes, customerNotes } = req.body || {}; // Extract payload fields.
    const resolvedJobId = typeof job_id === "number" ? job_id : jobId; // Normalise job id.
    const resolvedDeclinedBy = declined_by ?? declinedBy; // Normalise actor string.
    const resolvedNotes = customer_notes ?? customerNotes ?? null; // Normalise optional notes.

    if (typeof resolvedJobId !== "number") { // Validate job id.
      res.status(400).json({ ok: false, error: "job_id must be a number" }); // Return validation error.
      return; // Exit handler.
    }

    if (!resolvedDeclinedBy || typeof resolvedDeclinedBy !== "string") { // Validate actor string.
      res.status(400).json({ ok: false, error: "declined_by is required" }); // Return validation error.
      return; // Exit handler.
    }

    const record = await createDeclination({ job_id: resolvedJobId, declined_by: resolvedDeclinedBy, customer_notes: resolvedNotes }); // Insert declination.
    res.status(201).json({ ok: true, data: record }); // Return inserted record.
  } catch (error) { // Catch unexpected failures.
    console.error("/api/vhc/declinations error", error); // Emit diagnostic log.
    res.status(500).json({ ok: false, error: error?.message || "Unexpected error" }); // Return generic failure payload.
  }
}
