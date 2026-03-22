import {
  buildPersonalApiError,
  mapTransactionRow,
  PERSONAL_TABLES,
  requirePersonalAccess,
} from "@/lib/profile/personalServer";

function toAmount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Number(parsed.toFixed(2));
}

function buildTransactionPayload(body = {}, userId) {
  const type = String(body.type || "expense").toLowerCase();
  if (!["income", "expense"].includes(type)) {
    const error = new Error("Transaction type must be income or expense.");
    error.statusCode = 400;
    throw error;
  }

  return {
    user_id: userId,
    type,
    category: String(body.category || "General").trim() || "General",
    amount: toAmount(body.amount),
    date: body.date || new Date().toISOString().split("T")[0],
    is_recurring: body.isRecurring === true,
    notes: String(body.notes || ""),
    updated_at: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  try {
    const { userId, db } = await requirePersonalAccess(req, res);

    if (req.method === "GET") {
      const { data, error } = await db
        .from(PERSONAL_TABLES.transactions)
        .select("id, user_id, type, category, amount, date, is_recurring, notes, created_at, updated_at")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return res.status(200).json({
        success: true,
        data: (data || []).map(mapTransactionRow),
      });
    }

    if (req.method === "POST") {
      const { data, error } = await db
        .from(PERSONAL_TABLES.transactions)
        .insert({
          ...buildTransactionPayload(req.body, userId),
          created_at: new Date().toISOString(),
        })
        .select("id, user_id, type, category, amount, date, is_recurring, notes, created_at, updated_at")
        .maybeSingle();

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true, data: mapTransactionRow(data) });
    }

    if (req.method === "PUT") {
      const id = String(req.body?.id || "");
      if (!id) {
        return res.status(400).json({ success: false, message: "Transaction id is required." });
      }

      const { data, error } = await db
        .from(PERSONAL_TABLES.transactions)
        .update(buildTransactionPayload(req.body, userId))
        .eq("user_id", userId)
        .eq("id", id)
        .select("id, user_id, type, category, amount, date, is_recurring, notes, created_at, updated_at")
        .maybeSingle();

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true, data: mapTransactionRow(data) });
    }

    if (req.method === "DELETE") {
      const id = String(req.body?.id || req.query.id || "");
      if (!id) {
        return res.status(400).json({ success: false, message: "Transaction id is required." });
      }

      const { error } = await db
        .from(PERSONAL_TABLES.transactions)
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
    return buildPersonalApiError(res, error, "Failed to handle personal transactions request.");
  }
}
