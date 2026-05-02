// file location: src/lib/users/rosterPayload.js
import { buildCiRoster, isPlaywrightCi } from "@/lib/api/ciMocks";
import { getAllUsers, getUsersGroupedByRole } from "@/lib/database/users";

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

export async function buildRosterPayload() {
  if (isPlaywrightCi()) {
    return buildCiRoster();
  }

  const [grouped, allUsers] = await Promise.all([
    getUsersGroupedByRole(),
    getAllUsers(),
  ]);

  const usersByRoleDetailed = sanitizeGroupedUsers(grouped);
  const sanitizedAllUsers = (allUsers || []).map((user) => sanitizeUser(user));

  return {
    usersByRole: mapUsersToNameList(usersByRoleDetailed),
    usersByRoleDetailed,
    allUsers: sanitizedAllUsers,
  };
}

export const EMPTY_ROSTER_PAYLOAD = {
  usersByRole: {},
  usersByRoleDetailed: {},
  allUsers: [],
};
