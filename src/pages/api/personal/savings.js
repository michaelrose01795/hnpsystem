import {
  buildPersonalApiError,
  mapSavingsRow,
  PERSONAL_TABLES,
  requirePersonalAccess,
} from "@/lib/profile/personalServer";

function buildSavingsPayload(body = {}, userId) {
  return {
    user_id: userId,
    target_amount: Number(body.targetAmount || 0),
    current_amount: Number(body.currentAmount || 0),
    monthly_contribution: Number(body.monthlyContribution || 0),
    updated_at: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  try {
    const { userId, db } = await requirePersonalAccess(req, res);

    if (req.method === "GET") {
      const { data, error } = await db
        .from(PERSONAL_TABLES.savings)
        .select("id, user_id, target_amount, current_amount, monthly_contribution, created_at, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true, data: data ? mapSavingsRow(data) : null });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const { data, error } = await db
        .from(PERSONAL_TABLES.savings)
        .upsert(
          {
            ...buildSavingsPayload(req.body, userId),
            created_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .select("id, user_id, target_amount, current_amount, monthly_contribution, created_at, updated_at")
        .maybeSingle();

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true, data: mapSavingsRow(data) });
    }

    if (req.method === "DELETE") {
      const { error } = await db
        .from(PERSONAL_TABLES.savings)
        .delete()
        .eq("user_id", userId);

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true, data: null });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    return buildPersonalApiError(res, error, "Failed to handle personal savings request.");
  }
}
