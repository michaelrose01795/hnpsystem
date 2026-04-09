import crypto from "crypto";
import { withRoleGuard } from "@/lib/auth/roleGuard";
import {
  buildPersonalApiError,
  getPersonalState,
  mapBillRow,
  requirePersonalAccess,
  savePersonalState,
} from "@/lib/profile/personalServer";

function buildBillPayload(body = {}, userId) {
  const dueDay = Number.parseInt(String(body.dueDay ?? body.due_day ?? 1), 10);
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    const error = new Error("Bill due day must be between 1 and 31.");
    error.statusCode = 400;
    throw error;
  }

  return {
    id: body.id || crypto.randomUUID(),
    userId,
    name: String(body.name || "Bill").trim() || "Bill",
    amount: Number(body.amount || 0),
    dueDay,
    isRecurring: body.isRecurring !== false,
  };
}

async function handler(req, res, session) {
  try {
    const { userId, db } = await requirePersonalAccess(req, res);
    const state = await getPersonalState(userId, db);
    const bills = Array.isArray(state.collections?.bills) ? state.collections.bills : [];

    if (req.method === "GET") {
      const ordered = [...bills]
        .map(mapBillRow)
        .sort((a, b) => Number(a.dueDay || 0) - Number(b.dueDay || 0) || String(a.name || "").localeCompare(String(b.name || "")));
      return res.status(200).json({ success: true, data: ordered });
    }

    if (req.method === "POST") {
      const nextItem = buildBillPayload(req.body, userId);
      const nextBills = [...bills, nextItem];
      await savePersonalState(userId, { ...state, collections: { ...state.collections, bills: nextBills } }, db);
      return res.status(200).json({ success: true, data: nextItem });
    }

    if (req.method === "PUT") {
      const id = String(req.body?.id || "");
      if (!id) return res.status(400).json({ success: false, message: "Bill id is required." });
      const nextItem = buildBillPayload({ ...req.body, id }, userId);
      const nextBills = bills.map((entry) => (String(entry.id) === id ? { ...entry, ...nextItem } : entry));
      await savePersonalState(userId, { ...state, collections: { ...state.collections, bills: nextBills } }, db);
      return res.status(200).json({ success: true, data: nextItem });
    }

    if (req.method === "DELETE") {
      const id = String(req.body?.id || req.query.id || "");
      if (!id) return res.status(400).json({ success: false, message: "Bill id is required." });
      const nextBills = bills.filter((entry) => String(entry.id) !== id);
      await savePersonalState(userId, { ...state, collections: { ...state.collections, bills: nextBills } }, db);
      return res.status(200).json({ success: true, data: { id } });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    return buildPersonalApiError(res, error, "Failed to handle personal bills request.");
  }
}

export default withRoleGuard(handler);
