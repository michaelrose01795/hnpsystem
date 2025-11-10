// file location: src/pages/api/hr/mock-data.js

import { getHrOperationsSnapshot } from "../../../lib/database/hr"; // fetch combined HR datasets from Supabase
import { withRoleGuard } from "../../../lib/auth/roleGuard"; // enforce RBAC on the endpoint
import { HR_CORE_ROLES, MANAGER_SCOPED_ROLES } from "../../../lib/auth/roles"; // role constants reused across APIs

const ALLOWED_ROLES = Array.from(new Set([...HR_CORE_ROLES, ...MANAGER_SCOPED_ROLES].map((role) => role.toLowerCase()))); // flatten and normalise all permitted roles

const handler = async (req, res) => {
  if (req.method !== "GET") { // only GET requests are supported
    res.setHeader("Allow", ["GET"]); // inform client of the permitted method
    res.status(405).json({ success: false, message: "Method not allowed" }); // respond with standard 405 body
    return; // bail early
  }

  try {
    const data = await getHrOperationsSnapshot(); // gather all HR datasets in one go
    res.status(200).json({ success: true, data }); // respond with aggregated payload
  } catch (error) {
    console.error("❌ /api/hr/mock-data error", error); // surface unexpected Supabase/runtime failures
    res.status(500).json({ success: false, message: "Failed to load HR datasets", error: error.message }); // friendly error for UI
  }
};

export default withRoleGuard(handler, { allow: ALLOWED_ROLES }); // wrap handler with role guard middleware
