// ✅ Connected to Supabase (server-side)
// file location: src/pages/api/users/roster.js
import { getAllUsers, getUsersGroupedByRole } from "@/lib/database/users";
import { buildCiRoster, isPlaywrightCi } from "@/lib/api/ciMocks";

const mapUsersToNameList = (grouped = {}) =>
  Object.fromEntries(
    Object.entries(grouped).map(([role, users]) => [
      role,
      users.map((user) => user.name || "Unknown user"),
    ])
  );

const sanitizeUser = (user = {}) => ({
  id: user.id ?? null,
  name: user.name || "Unknown user",
  firstName: user.firstName || "",
  lastName: user.lastName || "",
  email: user.email || "",
  role: user.role || "",
  department: user.department || "",
});

const sanitizeGroupedUsers = (grouped = {}) =>
  Object.fromEntries(
    Object.entries(grouped).map(([role, users]) => [
      role,
      (users || []).map((user) => sanitizeUser(user)),
    ])
  );

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  if (isPlaywrightCi()) {
    return res.status(200).json({
      success: true,
      data: buildCiRoster(),
      source: "playwright-ci",
    });
  }

  try {
    const [grouped, allUsers] = await Promise.all([
      getUsersGroupedByRole(),
      getAllUsers(),
    ]);

    const sanitizedGrouped = sanitizeGroupedUsers(grouped);
    const sanitizedAllUsers = (allUsers || []).map((user) => sanitizeUser(user));
    const usersByRole = mapUsersToNameList(sanitizedGrouped);

    return res.status(200).json({
      success: true,
      data: {
        usersByRole,
        usersByRoleDetailed: sanitizedGrouped,
        allUsers: sanitizedAllUsers,
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

export default handler;
