import { supabaseService } from "@/lib/database/supabaseClient";
import { TECHNICIAN_ROLES } from "@/lib/auth/roles";
import { buildTechnicianCapacitySchedule } from "@/lib/capacity/technicianCapacity";

const CAPACITY_TABLE = "technician_capacity_overrides";

const requireServiceClient = () => {
  if (!supabaseService) throw new Error("Server missing Supabase service client");
  return supabaseService;
};

export async function getTechnicianCapacitySchedule({ startDate, endDate, dates }) {
  const db = requireServiceClient();
  const [{ data: users, error: usersError }, { data: absences, error: absencesError }, { data: overrides, error: overridesError }] = await Promise.all([
    db
      .from("users")
      .select("user_id, first_name, last_name, email, role, contracted_hours")
      .in("role", TECHNICIAN_ROLES)
      .eq("is_active", true)
      .order("first_name", { ascending: true }),
    db
      .from("hr_absences")
      .select("absence_id, user_id, type, start_date, end_date, notes")
      .eq("approval_status", "Approved")
      .lte("start_date", endDate)
      .gte("end_date", startDate),
    db
      .from(CAPACITY_TABLE)
      .select("user_id, capacity_date, available_hours")
      .gte("capacity_date", startDate)
      .lte("capacity_date", endDate),
  ]);

  if (usersError) throw usersError;
  if (absencesError) throw absencesError;
  if (overridesError) throw overridesError;

  return buildTechnicianCapacitySchedule({ users, absences, overrides, dates });
}

export async function saveTechnicianCapacityOverrides({ changes = [], resets = [], actorUserId = null }) {
  const db = requireServiceClient();
  if (changes.length > 0) {
    const rows = changes.map((change) => ({
      user_id: change.userId,
      capacity_date: change.date,
      available_hours: change.availableHours,
      updated_by: actorUserId,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await db.from(CAPACITY_TABLE).upsert(rows, { onConflict: "user_id,capacity_date" });
    if (error) throw error;
  }

  const resetDatesByUser = resets.reduce((groups, reset) => {
    const userId = Number(reset.userId);
    groups.set(userId, [...new Set([...(groups.get(userId) || []), reset.date])]);
    return groups;
  }, new Map());

  for (const [userId, dates] of resetDatesByUser) {
    const { error } = await db
      .from(CAPACITY_TABLE)
      .delete()
      .eq("user_id", userId)
      .in("capacity_date", dates);
    if (error) throw error;
  }
}
