// ✅ Connected to Supabase (server-side)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/lib/database/adminUsers.js
import { supabase, supabaseService } from "@/lib/database/supabaseClient";

const adminClient = supabaseService || supabase;

const isServiceClient = Boolean(supabaseService);

const USERS_TABLE = "users";
const ACTIVITY_TABLE = "activity_logs";

const baseSelectColumns = [
  "user_id",
  "first_name",
  "last_name",
  "email",
  "role",
  "phone",
  "created_at",
  "sidebar_access",
];
const baseSelectColumnsWithoutSidebarAccess = baseSelectColumns.filter(
  (column) => column !== "sidebar_access"
);
const isMissingSidebarAccessColumnError = (error) =>
  Boolean(
    error?.message &&
    /users\.sidebar_access|sidebar_access/i.test(error.message) &&
    /does not exist/i.test(error.message)
  );

const mapRow = (row) => ({
  id: row.user_id,
  firstName: row.first_name,
  lastName: row.last_name,
  email: row.email,
  role: row.role,
  phone: row.phone,
  createdAt: row.created_at,
  sidebarAccess: row.sidebar_access ?? null,
});
const isStaffUser = (user) =>
  Boolean(user?.role && !String(user.role).toLowerCase().includes("customer"));

export async function updateAdminUserSidebarAccess(userId, sidebarAccess) {
  const numericUserId = Number(userId);
  if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
    throw new Error("A valid user id is required to update sidebar access.");
  }
  const { data, error } = await adminClient
    .from(USERS_TABLE)
    .update({ sidebar_access: sidebarAccess })
    .eq("user_id", numericUserId)
    .select(baseSelectColumns.join(","))
    .maybeSingle();
  if (error) {
    if (isMissingSidebarAccessColumnError(error)) {
      throw new Error(
        "The users.sidebar_access database migration has not been applied. Run the pending Supabase migration before saving access changes."
      );
    }
    throw error;
  }
  return data ? mapRow(data) : null;
}

export async function isSidebarAccessPersistenceReady() {
  const { error } = await adminClient
    .from(USERS_TABLE)
    .select("sidebar_access")
    .limit(1);
  if (isMissingSidebarAccessColumnError(error)) return false;
  if (error) throw error;
  return true;
}

export async function listAdminUsers() {
  let { data, error } = await adminClient
    .from(USERS_TABLE)
    .select(baseSelectColumns.join(","))
    .order("created_at", { ascending: false });

  if (isMissingSidebarAccessColumnError(error)) {
    const fallback = await adminClient
      .from(USERS_TABLE)
      .select(baseSelectColumnsWithoutSidebarAccess.join(","))
      .order("created_at", { ascending: false });
    data = (fallback.data || []).map((row) => ({ ...row, sidebar_access: null }));
    error = fallback.error;
  }

  if (error) throw error;
  return (data || []).map(mapRow).filter(isStaffUser);
}

export async function createAdminUser(payload) {
  throw new Error("Direct user table writes are disabled. Use HR Manager > Employees.");

  void payload;
}

export async function deleteAdminUser(userId, actorId) {
  void userId;
  void actorId;
  throw new Error("Direct user table writes are disabled. Use HR Manager > Employees.");
}

async function logActivity({ action, tableName, recordId, userId }) {
  if (!isServiceClient) return;
  await adminClient.from(ACTIVITY_TABLE).insert({
    user_id: userId,
    action,
    table_name: tableName,
    record_id: recordId,
  });
}
