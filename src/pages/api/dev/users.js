// file location: src/pages/api/dev/users.js
//
// Dev-only user directory for the Developer Platform "Sidebar Access" area.
// Returns the same rows as the Admin user list (listAdminUsers) but gated
// strictly to the synthetic `dev` role — the Admin users endpoint is scoped to
// admin/owner roles, which a dev session does not carry. Read-only (GET).
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { listAdminUsers } from "@/lib/database/adminUsers";

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  try {
    const users = await listAdminUsers();
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error("/api/dev/users error", error);
    res.status(500).json({ success: false, message: error.message || "Unexpected error" });
  }
}

export default withRoleGuard(handler, { allow: DEV_PLATFORM_ROLES });
