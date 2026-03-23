import {
  buildPersonalApiError,
  getPersonalState,
  mapSavingsRow,
  requirePersonalAccess,
  savePersonalState,
} from "@/lib/profile/personalServer";

function buildSavingsPayload(body = {}, userId) {
  return {
    id: body.id || null,
    userId,
    targetAmount: Number(body.targetAmount || 0),
    currentAmount: Number(body.currentAmount || 0),
    monthlyContribution: Number(body.monthlyContribution || 0),
  };
}

export default async function handler(req, res) {
  try {
    const { userId, db } = await requirePersonalAccess(req, res);
    const state = await getPersonalState(userId, db);

    if (req.method === "GET") {
      const savings = state.collections?.savings ? mapSavingsRow(state.collections.savings) : null;
      return res.status(200).json({ success: true, data: savings });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const savings = buildSavingsPayload(req.body, userId);
      await savePersonalState(userId, { ...state, collections: { ...state.collections, savings } }, db);
      return res.status(200).json({ success: true, data: savings });
    }

    if (req.method === "DELETE") {
      await savePersonalState(userId, { ...state, collections: { ...state.collections, savings: null } }, db);
      return res.status(200).json({ success: true, data: null });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    return buildPersonalApiError(res, error, "Failed to handle personal savings request.");
  }
}
