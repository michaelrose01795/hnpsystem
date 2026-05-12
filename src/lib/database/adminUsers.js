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
];

const mapRow = (row) => ({
  id: row.user_id,
  firstName: row.first_name,
  lastName: row.last_name,
  email: row.email,
  role: row.role,
  phone: row.phone,
  createdAt: row.created_at,
});

export async function listAdminUsers() {
  const { data, error } = await adminClient
    .from(USERS_TABLE)
    .select(baseSelectColumns.join(","))
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapRow);
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
