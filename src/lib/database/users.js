// file location: src/lib/database/users.js
import { supabase } from "../supabaseClient";

const DEFAULT_TECH_ROLES = ["Techs", "Technician", "Technician Lead", "Lead Technician"];
const DEFAULT_TEST_ROLES = ["MOT Tester", "Tester"];

const normalizeUserName = (user) => {
  const first = user?.first_name?.trim() || "";
  const last = user?.last_name?.trim() || "";
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return combined || user?.name?.trim() || user?.email?.trim() || "";
};

const shapeUserRecord = (user) => {
  const name = normalizeUserName(user);
  return {
    id: user?.user_id ?? user?.id ?? null,
    name: name || user?.email || "Unnamed Tech",
    email: user?.email || "",
    role: user?.role || "",
  };
};

const fetchUsersByRoles = async (roles) => {
  if (!roles || roles.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from("users")
      .select("user_id, first_name, last_name, email, role")
      .in("role", roles)
      .order("first_name", { ascending: true });

    if (error) {
      console.error("❌ fetchUsersByRoles error:", error);
      return [];
    }

    return (data || []).map(shapeUserRecord);
  } catch (err) {
    console.error("❌ fetchUsersByRoles exception:", err);
    return [];
  }
};

export const getTechnicianUsers = async () => fetchUsersByRoles(DEFAULT_TECH_ROLES);

export const getMotTesterUsers = async () => fetchUsersByRoles(DEFAULT_TEST_ROLES);

export const getUsersGroupedByRole = async () => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("user_id, first_name, last_name, email, role")
      .order("role", { ascending: true })
      .order("first_name", { ascending: true });

    if (error) throw error;

    return (data || []).reduce((acc, user) => {
      const shaped = shapeUserRecord(user);
      const roleKey = shaped.role || "Unassigned";
      if (!acc[roleKey]) acc[roleKey] = [];
      acc[roleKey].push(shaped);
      return acc;
    }, {});
  } catch (err) {
    console.error("❌ getUsersGroupedByRole error:", err);
    return {};
  }
};

export const getUserById = async (userId) => {
  if (!userId && userId !== 0) return null;
  try {
    const { data, error } = await supabase
      .from("users")
      .select("user_id, first_name, last_name, email, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data ? shapeUserRecord(data) : null;
  } catch (err) {
    console.error("❌ getUserById error:", err);
    return null;
  }
};
