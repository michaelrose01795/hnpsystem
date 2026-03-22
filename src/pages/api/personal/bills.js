import {
  buildPersonalApiError,
  mapBillRow,
  PERSONAL_TABLES,
  requirePersonalAccess,
} from "@/lib/profile/personalServer";

function buildBillPayload(body = {}, userId) {
  const dueDay = Number.parseInt(String(body.dueDay ?? body.due_day ?? 1), 10);
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    const error = new Error("Bill due day must be between 1 and 31.");
    error.statusCode = 400;
    throw error;
  }

  return {
    user_id: userId,
    name: String(body.name || "Bill").trim() || "Bill",
    amount: Number(body.amount || 0),
    due_day: dueDay,
    is_recurring: body.isRecurring !== false,
    updated_at: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  try {
    const { userId, db } = await requirePersonalAccess(req, res);

    if (req.method === "GET") {
      const { data, error } = await db
        .from(PERSONAL_TABLES.bills)
        .select("id, user_id, name, amount, due_day, is_recurring, created_at, updated_at")
        .eq("user_id", userId)
        .order("due_day", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true, data: (data || []).map(mapBillRow) });
    }

    if (req.method === "POST") {
      const { data, error } = await db
        .from(PERSONAL_TABLES.bills)
        .insert({
          ...buildBillPayload(req.body, userId),
          created_at: new Date().toISOString(),
        })
        .select("id, user_id, name, amount, due_day, is_recurring, created_at, updated_at")
        .maybeSingle();

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true, data: mapBillRow(data) });
    }

    if (req.method === "PUT") {
      const id = String(req.body?.id || "");
      if (!id) {
        return res.status(400).json({ success: false, message: "Bill id is required." });
      }

      const { data, error } = await db
        .from(PERSONAL_TABLES.bills)
        .update(buildBillPayload(req.body, userId))
        .eq("user_id", userId)
        .eq("id", id)
        .select("id, user_id, name, amount, due_day, is_recurring, created_at, updated_at")
        .maybeSingle();

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true, data: mapBillRow(data) });
    }

    if (req.method === "DELETE") {
      const id = String(req.body?.id || req.query.id || "");
      if (!id) {
        return res.status(400).json({ success: false, message: "Bill id is required." });
      }

      const { error } = await db
        .from(PERSONAL_TABLES.bills)
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
    return buildPersonalApiError(res, error, "Failed to handle personal bills request.");
  }
}
