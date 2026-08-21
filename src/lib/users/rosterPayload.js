// file location: src/lib/users/rosterPayload.js
import { buildCiRoster, isPlaywrightCi } from "@/lib/api/ciMocks";
import { getDatabaseClient } from "@/lib/database/client";
import { isDevAuthAllowed } from "@/lib/auth/devAuth";
import { getAllUsers } from "@/lib/database/users";

const db = getDatabaseClient();
const CUSTOMER_ROLE = "Customer";

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
  customerId: user.customerId || null,
});

const sanitizeGroupedUsers = (grouped = {}) =>
  Object.fromEntries(
    Object.entries(grouped).map(([role, users]) => [
      role,
      (users || []).map((user) => sanitizeUser(user)),
    ])
  );

const getCustomerDevLoginUsers = async () => {
  const { data, error } = await db
    .from("customers")
    .select("id, firstname, lastname, email, mobile, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch customer dev login roster: ${error.message}`);
  }

  return (data || []).map((customer) => {
    const firstName = customer.firstname || "";
    const lastName = customer.lastname || "";
    const name =
      [firstName, lastName].filter(Boolean).join(" ").trim() ||
      customer.email ||
      customer.mobile ||
      "Customer";

    return {
      id: customer.id,
      customerId: customer.id,
      name,
      firstName,
      lastName,
      email: customer.email || "",
      role: CUSTOMER_ROLE,
      department: CUSTOMER_ROLE,
    };
  });
};

// Group an already-fetched user list by role, reproducing the ordering the
// database applied in getUsersGroupedByRole (role, first name, last name, id).
const groupUsersByRole = (users = []) => {
  const sorted = [...users].sort((a, b) => {
    const byRole = String(a.role || "").localeCompare(String(b.role || ""));
    if (byRole !== 0) return byRole;
    const byFirst = String(a.firstName || "").localeCompare(String(b.firstName || ""));
    if (byFirst !== 0) return byFirst;
    const byLast = String(a.lastName || "").localeCompare(String(b.lastName || ""));
    if (byLast !== 0) return byLast;
    return Number(a.id || 0) - Number(b.id || 0);
  });

  return sorted.reduce((acc, shaped) => {
    const key = shaped.role || "Unassigned";
    if (!acc[key]) acc[key] = [];
    acc[key].push(shaped);
    return acc;
  }, {});
};

export async function buildRosterPayload() {
  if (isPlaywrightCi()) {
    return buildCiRoster();
  }

  // This runs on EVERY authenticated page boot (RosterProvider). It used to
  // issue three queries:
  //
  //   getUsersGroupedByRole()   — every active user
  //   getAllUsers()             — the same rows again, same columns, only a
  //                               different ORDER BY
  //   getCustomerDevLoginUsers()— every customer row in the database, unbounded
  //
  // The two user queries are now one fetch grouped in memory, and the customer
  // list — which exists only to populate the DEV LOGIN picker — is skipped
  // unless dev auth is actually available. In production that removes an
  // unbounded scan that grows with the customer base, and stops sending every
  // customer's name and email to every staff member on every page load.
  const allUsers = await getAllUsers();
  const customers = isDevAuthAllowed() ? await getCustomerDevLoginUsers() : [];

  const grouped = groupUsersByRole(allUsers);
  const groupedWithCustomers = {
    ...(grouped || {}),
    [CUSTOMER_ROLE]: customers,
  };
  const usersByRoleDetailed = sanitizeGroupedUsers(groupedWithCustomers);
  const sanitizedAllUsers = [
    ...(allUsers || []).map((user) => sanitizeUser(user)),
    ...customers.map((customer) => sanitizeUser(customer)),
  ];

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
