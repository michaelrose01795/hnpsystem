import {
  buildPersonalApiError,
  mapNoteRow,
  PERSONAL_TABLES,
  requirePersonalAccess,
} from "@/lib/profile/personalServer";

function buildNotePayload(body = {}, userId) {
  return {
    user_id: userId,
    content: String(body.content || ""),
    updated_at: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  try {
    const { userId, db } = await requirePersonalAccess(req, res);

    if (req.method === "GET") {
      const { data, error } = await db
        .from(PERSONAL_TABLES.notes)
        .select("id, user_id, content, created_at, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true, data: (data || []).map(mapNoteRow) });
    }

    if (req.method === "POST") {
      const { data, error } = await db
        .from(PERSONAL_TABLES.notes)
        .insert({
          ...buildNotePayload(req.body, userId),
          created_at: new Date().toISOString(),
        })
        .select("id, user_id, content, created_at, updated_at")
        .maybeSingle();

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true, data: mapNoteRow(data) });
    }

    if (req.method === "PUT") {
      const id = String(req.body?.id || "");
      if (!id) {
        return res.status(400).json({ success: false, message: "Note id is required." });
      }

      const { data, error } = await db
        .from(PERSONAL_TABLES.notes)
        .update(buildNotePayload(req.body, userId))
        .eq("user_id", userId)
        .eq("id", id)
        .select("id, user_id, content, created_at, updated_at")
        .maybeSingle();

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true, data: mapNoteRow(data) });
    }

    if (req.method === "DELETE") {
      const id = String(req.body?.id || req.query.id || "");
      if (!id) {
        return res.status(400).json({ success: false, message: "Note id is required." });
      }

      const { error } = await db
        .from(PERSONAL_TABLES.notes)
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
    return buildPersonalApiError(res, error, "Failed to handle personal notes request.");
  }
}
