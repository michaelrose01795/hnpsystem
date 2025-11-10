// ✅ Connected to Supabase (server-side)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/lib/database/adminUsers.js
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminClient = serviceKey
  ? createClient(supabaseUrl, serviceKey)
  : supabase;

const isServiceClient = Boolean(serviceKey);

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
  if (!isServiceClient) {
    throw new Error("Server missing SUPABASE_SERVICE_ROLE_KEY; cannot create users.");
  }

  const insertPayload = {
    first_name: payload.firstName,
    last_name: payload.lastName,
    email: payload.email,
    password_hash: payload.password || "external_auth",
    role: payload.role,
    phone: payload.phone || null,
  };

  const { data, error } = await adminClient
    .from(USERS_TABLE)
    .insert(insertPayload)
    .select(baseSelectColumns.join(","))
    .single();

  if (error) throw error;

  await logActivity({
    action: "create",
    tableName: USERS_TABLE,
    recordId: data.user_id,
    userId: payload.actorId || null,
  });

  return mapRow(data);
}

export async function deleteAdminUser(userId, actorId) {
  if (!isServiceClient) {
    throw new Error("Server missing SUPABASE_SERVICE_ROLE_KEY; cannot delete users.");
  }

  const { error } = await adminClient.from(USERS_TABLE).delete().eq("user_id", userId);
  if (error) throw error;

  await logActivity({
    action: "delete",
    tableName: USERS_TABLE,
    recordId: userId,
    userId: actorId || null,
  });

  return { success: true };
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
