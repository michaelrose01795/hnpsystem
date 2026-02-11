// ✅ Connected to Supabase (server-side)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/lib/database/users.js
import { getDatabaseClient } from "@/lib/database/client";
import { getDisplayName } from "@/lib/users/displayName";

const db = getDatabaseClient();
const USERS_TABLE = "users";
const USER_COLUMNS = [
  "user_id",
  "first_name",
  "last_name",
  "email",
  "password_hash",
  "role",
  "job_title",
  "phone",
  "created_at",
  "updated_at",
  "dark_mode",
  "is_active",
  "department",
  "employment_type",
  "start_date",
  "manager_id",
  "photo_url",
  "emergency_contact",
  "documents",
  "employment_status",
  "contracted_hours",
  "hourly_rate",
  "overtime_rate",
  "annual_salary",
  "payroll_reference",
  "national_insurance_number",
  "keycloak_user_id",
  "home_address",
  "signature_storage_path",
  "signature_file_url",
].join(", ");

const mapUserRow = (row = {}) => ({
  id: row.user_id,
  firstName: row.first_name,
  lastName: row.last_name,
  name: getDisplayName(row),
  email: row.email,
  role: row.role,
  jobTitle: row.job_title,
  phone: row.phone,
  passwordHash: row.password_hash,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  darkMode: row.dark_mode,
  isActive: row.is_active,
  department: row.department,
  employmentType: row.employment_type,
  startDate: row.start_date,
  managerId: row.manager_id,
  photoUrl: row.photo_url,
  emergencyContact: row.emergency_contact,
  documents: row.documents,
  employmentStatus: row.employment_status,
  contractedHours: row.contracted_hours,
  hourlyRate: row.hourly_rate,
  overtimeRate: row.overtime_rate,
  annualSalary: row.annual_salary,
  payrollReference: row.payroll_reference,
  nationalInsuranceNumber: row.national_insurance_number,
  keycloakUserId: row.keycloak_user_id,
  homeAddress: row.home_address,
  signatureStoragePath: row.signature_storage_path,
  signatureFileUrl: row.signature_file_url,
});

const ensureUserPayload = (payload = {}) => {
  const requiredFields = ["first_name", "last_name", "email", "password_hash", "role"];
  const missing = requiredFields.filter((field) => !payload[field]);
  if (missing.length) {
    throw new Error(`Missing required user fields: ${missing.join(", ")}`);
  }
};

const DEFAULT_TECH_ROLES = ["Techs", "Technician", "Technician Lead", "Lead Technician"];
const DEFAULT_TEST_ROLES = ["MOT Tester", "Tester"];

const fetchUsersByRoles = async (roles) => {
  if (!roles || roles.length === 0) {
    return [];
  }
  const escapedList = roles
    .map((roleName) => `"${roleName.replace(/"/g, '\\"')}"`)
    .join(",");
  const roleFilter = `role.in.(${escapedList})`;
  const { data, error } = await db
    .from(USERS_TABLE)
    .select(USER_COLUMNS)
    .eq("is_active", true)
    .or(roleFilter)
    .order("first_name", { ascending: true });
  if (error) {
    throw new Error(`Failed to fetch users by role: ${error.message}`);
  }
  return (data || []).map(mapUserRow);
};

export const getTechnicianUsers = () => fetchUsersByRoles(DEFAULT_TECH_ROLES);

export const getMotTesterUsers = () => fetchUsersByRoles(DEFAULT_TEST_ROLES);

export const getAllUsers = async ({ includeInactive = false } = {}) => {
  let query = db
    .from(USERS_TABLE)
    .select(USER_COLUMNS)
    .order("user_id", { ascending: true });
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }
  return (data || []).map(mapUserRow);
};

export const getUsersGroupedByRole = async () => {
  const { data, error } = await db
    .from(USERS_TABLE)
    .select(USER_COLUMNS)
    .eq("is_active", true)
    .order("role", { ascending: true })
    .order("first_name", { ascending: true })
    .order("last_name", { ascending: true })
    .order("user_id", { ascending: true });
  if (error) {
    throw new Error(`Failed to fetch users grouped by role: ${error.message}`);
  }
  return (data || []).reduce((acc, row) => {
    const shaped = mapUserRow(row);
    const key = shaped.role || "Unassigned";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(shaped);
    return acc;
  }, {});
};

export const getUserById = async (userId, { includeInactive = false } = {}) => {
  if (typeof userId !== "number") {
    throw new Error("getUserById requires a numeric userId.");
  }
  let query = db
    .from(USERS_TABLE)
    .select(USER_COLUMNS)
    .eq("user_id", userId);
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`Failed to fetch user ${userId}: ${error.message}`);
  }
  return data ? mapUserRow(data) : null;
};

export const createUser = async (payload) => {
  ensureUserPayload(payload);
  const { data, error } = await db
    .from(USERS_TABLE)
    .insert([payload])
    .select(USER_COLUMNS)
    .single();
  if (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }
  return mapUserRow(data);
};

export const updateUser = async (userId, updates = {}) => {
  if (typeof userId !== "number") {
    throw new Error("updateUser requires a numeric userId.");
  }
  if (Object.keys(updates).length === 0) {
    throw new Error("updateUser requires at least one field to update.");
  }
  const { data, error } = await db
    .from(USERS_TABLE)
    .update(updates)
    .eq("user_id", userId)
    .select(USER_COLUMNS)
    .single();
  if (error) {
    throw new Error(`Failed to update user ${userId}: ${error.message}`);
  }
  return mapUserRow(data);
};

export const deleteUser = async (userId) => {
  if (typeof userId !== "number") {
    throw new Error("deleteUser requires a numeric userId.");
  }
  const { error } = await db
    .from(USERS_TABLE)
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) {
    throw new Error(`Failed to deactivate user ${userId}: ${error.message}`);
  }
  return { success: true, deactivatedId: userId };
};
