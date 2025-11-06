// file location: src/pages/api/admin/users.js
import { withRoleGuard } from "../../../lib/auth/roleGuard";
import {
  listAdminUsers,
  createAdminUser,
  deleteAdminUser,
} from "../../../lib/database/adminUsers";

const allowedRoles = ["admin manager", "admin", "owner"];

async function handler(req, res, session) {
  try {
    if (req.method === "GET") {
      const users = await listAdminUsers();
      res.status(200).json({ success: true, data: users });
      return;
    }

    if (req.method === "POST") {
      const { firstName, lastName, email, role, phone } = req.body || {};

      if (!firstName || !lastName || !email || !role) {
        res.status(400).json({ success: false, message: "firstName, lastName, email, and role are required" });
        return;
      }

      const created = await createAdminUser({
        firstName,
        lastName,
        email,
        role,
        phone,
        actorId: session?.user?.id || null,
      });

      res.status(201).json({ success: true, data: created });
      return;
    }

    if (req.method === "DELETE") {
      const { userId } = req.query;
      if (!userId) {
        res.status(400).json({ success: false, message: "userId query param is required" });
        return;
      }

      await deleteAdminUser(Number(userId), session?.user?.id || null);
      res.status(200).json({ success: true });
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
