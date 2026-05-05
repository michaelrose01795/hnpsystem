// file location: src/lib/users/rosterPayload.js
import { buildCiRoster, isPlaywrightCi } from "@/lib/api/ciMocks";
import { getDatabaseClient } from "@/lib/database/client";
import { getAllUsers, getUsersGroupedByRole } from "@/lib/database/users";

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

export async function buildRosterPayload() {
  if (isPlaywrightCi()) {
    return buildCiRoster();
  }

  const [grouped, allUsers, customers] = await Promise.all([
    getUsersGroupedByRole(),
    getAllUsers(),
    getCustomerDevLoginUsers(),
  ]);

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
