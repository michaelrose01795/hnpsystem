// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/api/admin/users.js
import { withRoleGuard } from "@/lib/auth/roleGuard";
import {
  listAdminUsers,
} from "@/lib/database/adminUsers";

const allowedRoles = ["admin manager", "admin", "owner"];

async function handler(req, res, session) {
  try {
    if (req.method === "GET") {
      const users = await listAdminUsers();
      res.status(200).json({ success: true, data: users });
      return;
    }

    if (req.method === "POST") {
      res.status(403).json({
        success: false,
        message:
          "Direct user table writes are disabled here. Use HR Manager > Employees to create or edit users.",
      });
      return;
    }

    if (req.method === "DELETE") {
      res.status(403).json({
        success: false,
        message:
          "Direct user table writes are disabled here. Use HR Manager > Employees to manage users.",
      });
      return;
    }

    res.setHeader("Allow", ["GET", "POST", "DELETE"]);
    res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("/api/admin/users error", error);
    res.status(500).json({ success: false, message: error.message || "Unexpected error" });
  }
}

export default withRoleGuard(handler, { allow: allowedRoles });
