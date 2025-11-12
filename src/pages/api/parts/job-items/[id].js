// file location: src/pages/api/parts/job-items/[id].js
import { updateJobItem, deleteJobItem } from "@/lib/database/parts"; // Import job item mutation helpers.
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"; // Resolve caller context for RBAC.

const MANAGER_ROLE_KEYWORDS = ["parts", "manager", "admin"]; // Role keywords permitted to mutate existing job items.
const VALID_STATUSES = new Set(["pending", "awaiting_stock", "allocated", "picked", "fitted", "cancelled"]); // Allowed statuses.

const normaliseRole = (role) => (typeof role === "string" ? role.trim().toLowerCase() : ""); // Lowercase helper for comparisons.

const hasManagerPrivileges = (role) => MANAGER_ROLE_KEYWORDS.some((keyword) => normaliseRole(role).includes(keyword)); // Evaluate RBAC.

const normaliseStatus = (status) => { // Validate status inputs before forwarding to data layer.
  if (status === undefined || status === null) { // Allow status omission.
    return undefined; // Pass through undefined for optional updates.
  } // Close guard.
  const lower = typeof status === "string" ? status.toLowerCase() : ""; // Normalise string input.
  if (!VALID_STATUSES.has(lower)) { // Reject invalid statuses.
    throw new Error("Invalid status provided"); // Provide descriptive error.
  } // Close validation guard.
  return lower; // Return normalised value.
};

export default async function handler(req, res) { // API handler for updating and deleting job items.
  const { id: rawId } = req.query || {}; // Extract route param from Next.js dynamic route.
  const id = Array.isArray(rawId) ? rawId[0] : rawId; // Normalise to a single id string.

  if (!id) { // Validate identifier presence.
    res.status(400).json({ ok: false, error: "id is required" }); // Return validation error.
    return; // Exit early when identifier missing.
  }

  try { // Wrap logic in try/catch for consistent error payloads.
    if (req.method === "PATCH") { // Handle updates.
      const user = await getUserFromRequest(req); // Resolve caller role.
      if (!hasManagerPrivileges(user?.role)) { // Enforce Parts/Manager/Admin permissions.
        res.status(403).json({ ok: false, error: "Insufficient permissions" }); // Return forbidden response.
        return; // Exit early when not authorised.
      }

      const updates = { ...(req.body || {}) }; // Clone incoming updates to mutate safely.
      if (Object.prototype.hasOwnProperty.call(updates, "status")) { // Validate status when provided.
        updates.status = normaliseStatus(updates.status); // Normalise or throw on invalid value.
      }

      const updated = await updateJobItem(id, updates); // Apply update through data layer.
      if (!updated) { // Handle missing records gracefully.
        res.status(404).json({ ok: false, error: "Job item not found" }); // Return not-found response.
        return; // Exit handler.
      }
      res.status(200).json({ ok: true, data: updated }); // Return updated record.
      return; // Exit after responding.
    }

    if (req.method === "DELETE") { // Handle deletion.
      const user = await getUserFromRequest(req); // Resolve caller role.
      if (!hasManagerPrivileges(user?.role)) { // Enforce Parts/Manager/Admin permissions.
        res.status(403).json({ ok: false, error: "Insufficient permissions" }); // Return forbidden response.
        return; // Exit early.
      }

      const success = await deleteJobItem(id); // Delete the record.
      res.status(200).json({ ok: true, data: { deleted: success, id } }); // Return acknowledgement payload.
      return; // Exit handler after responding.
    }

    res.setHeader("Allow", ["PATCH", "DELETE"]); // Advertise supported methods.
    res.status(405).json({ ok: false, error: `Method ${req.method} not allowed` }); // Return method-not-allowed response.
  } catch (error) { // Catch unexpected failures.
    console.error(`/api/parts/job-items/${id} error`, error); // Emit diagnostic log.
    const message = error?.message || "Unexpected error"; // Prefer detailed error messages.
    const statusCode = message === "Invalid status provided" ? 400 : 500; // Treat status validation as bad request.
    res.status(statusCode).json({ ok: false, error: message }); // Return error payload with appropriate status code.
  }
}
