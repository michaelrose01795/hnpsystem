// ✅ Connected to Supabase (server-side)
// file location: src/pages/api/users/roster.js
import { getAllUsers, getUsersGroupedByRole } from "@/lib/database/users";
import { withRoleGuard } from "@/lib/auth/roleGuard";

const mapUsersToNameList = (grouped = {}) =>
  Object.fromEntries(
    Object.entries(grouped).map(([role, users]) => [
      role,
      users.map((user) => user.name || "Unknown user"),
    ])
  );

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const [grouped, allUsers] = await Promise.all([
      getUsersGroupedByRole(),
      getAllUsers(),
    ]);

    const usersByRole = mapUsersToNameList(grouped);

    return res.status(200).json({
      success: true,
      data: {
        usersByRole,
        usersByRoleDetailed: grouped,
        allUsers,
      },
    });
  } catch (error) {
    console.error("❌ /api/users/roster error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load users roster",
      error: error.message,
    });
  }
}

export default withRoleGuard(handler);
