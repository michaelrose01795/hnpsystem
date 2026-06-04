// file location: src/pages/api/vhc/pre-pick-location.js
//
// RETIRED ENDPOINT.
//
// Pre-pick location used to be writable at the *request* level here, fanning a
// single value out across job_requests.pre_pick_location, vhc_checks.pre_pick_location
// and the linked parts_job_items rows. That created four competing stores for one
// concept and meant the value a user saw depended on which table a given screen
// happened to read.
//
// Pre-pick location is now a single source of truth on
// parts_job_items.pre_pick_location, set per-part from the Parts tab "Part Details"
// popup via PATCH /api/parts/update-status. Every job-card screen renders a
// read-only label resolved from the linked part(s) (see resolveLinkedPrePickLocation
// in src/lib/prePickLocations.js), with the old job_requests / vhc_checks columns
// used only as a read fallback for legacy data.
//
// This route is intentionally left as a no-op so any stale client that still calls
// it cannot resurrect the second write path. It performs no database writes.

import { withRoleGuard } from "@/lib/auth/roleGuard";

async function handler(req, res) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(410).json({
    success: false,
    deprecated: true,
    error:
      "Request-level pre-pick updates are retired. Set pre-pick per part via " +
      "/api/parts/update-status (Parts tab → Part Details popup).",
  });
}

export default withRoleGuard(handler);
