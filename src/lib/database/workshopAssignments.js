import { supabaseService } from "@/lib/database/supabaseClient";

const SETTINGS_TABLE = "company_settings";
const ASSIGNMENT_KEY_PREFIX = "workshop_daily_assignment";

const requireServiceClient = () => {
  if (!supabaseService) throw new Error("Server missing Supabase service client");
  return supabaseService;
};

const buildAssignmentKey = (assignmentDate, userId) =>
  `${ASSIGNMENT_KEY_PREFIX}:${assignmentDate}:${userId}`;

export async function getWorkshopDailyAssignments({ assignmentDate }) {
  const db = requireServiceClient();
  const { data, error } = await db
    .from(SETTINGS_TABLE)
    .select("setting_key, setting_value, updated_at")
    .like("setting_key", `${ASSIGNMENT_KEY_PREFIX}:${assignmentDate}:%`);

  if (error) throw error;

  return (data || []).flatMap((setting) => {
    const userId = Number(String(setting.setting_key || "").split(":").at(-1));
    if (!Number.isInteger(userId) || userId <= 0) return [];
    return [{
      user_id: userId,
      assignment_date: assignmentDate,
      assignment_type: setting.setting_value,
      updated_at: setting.updated_at,
    }];
  });
}

export async function saveWorkshopDailyAssignment({
  userId,
  assignmentDate,
  assignmentType,
  actorUserId = null,
}) {
  const db = requireServiceClient();
  const settingKey = buildAssignmentKey(assignmentDate, userId);
  const { data: previous, error: previousError } = await db
    .from(SETTINGS_TABLE)
    .select("setting_key, setting_value, updated_at")
    .eq("setting_key", settingKey)
    .maybeSingle();

  if (previousError) throw previousError;

  const now = new Date().toISOString();
  const { data, error } = await db
    .from(SETTINGS_TABLE)
    .upsert({
      setting_key: settingKey,
      setting_value: assignmentType,
      setting_type: "string",
      description: `Workshop board assignment for user ${userId} on ${assignmentDate}`,
      updated_by: actorUserId || null,
      updated_at: now,
    }, { onConflict: "setting_key" })
    .select("setting_key, setting_value, updated_at")
    .single();

  if (error) throw error;
  return {
    previous: previous ? { assignment_type: previous.setting_value } : null,
    assignment: {
      user_id: userId,
      assignment_date: assignmentDate,
      assignment_type: data.setting_value,
      updated_at: data.updated_at,
    },
  };
}
