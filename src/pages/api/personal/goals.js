import {
  buildPersonalApiError,
  mapGoalRow,
  PERSONAL_TABLES,
  requirePersonalAccess,
} from "@/lib/profile/personalServer";

function buildGoalPayload(body = {}, userId) {
  const type = String(body.type || "custom").toLowerCase();
  if (!["house", "holiday", "custom"].includes(type)) {
    const error = new Error("Goal type must be house, holiday, or custom.");
    error.statusCode = 400;
    throw error;
  }

  return {
    user_id: userId,
    type,
    target: Number(body.target || 0),
    current: Number(body.current || 0),
    deadline: body.deadline || null,
    updated_at: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  try {
    const { userId, db } = await requirePersonalAccess(req, res);

    if (req.method === "GET") {
      const { data, error } = await db
        .from(PERSONAL_TABLES.goals)
        .select("id, user_id, type, target, current, deadline, created_at, updated_at")
        .eq("user_id", userId)
        .order("deadline", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true, data: (data || []).map(mapGoalRow) });
    }

    if (req.method === "POST") {
      const { data, error } = await db
        .from(PERSONAL_TABLES.goals)
        .insert({
          ...buildGoalPayload(req.body, userId),
          created_at: new Date().toISOString(),
        })
        .select("id, user_id, type, target, current, deadline, created_at, updated_at")
        .maybeSingle();

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true, data: mapGoalRow(data) });
    }

    if (req.method === "PUT") {
      const id = String(req.body?.id || "");
      if (!id) {
        return res.status(400).json({ success: false, message: "Goal id is required." });
      }

      const { data, error } = await db
        .from(PERSONAL_TABLES.goals)
        .update(buildGoalPayload(req.body, userId))
        .eq("user_id", userId)
        .eq("id", id)
        .select("id, user_id, type, target, current, deadline, created_at, updated_at")
        .maybeSingle();

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true, data: mapGoalRow(data) });
    }

    if (req.method === "DELETE") {
      const id = String(req.body?.id || req.query.id || "");
      if (!id) {
        return res.status(400).json({ success: false, message: "Goal id is required." });
      }

      const { error } = await db
        .from(PERSONAL_TABLES.goals)
        .delete()
        .eq("user_id", userId)
        .eq("id", id);

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true, data: { id } });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    return buildPersonalApiError(res, error, "Failed to handle personal goals request.");
  }
}
