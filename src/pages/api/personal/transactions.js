import crypto from "crypto";
import { withRoleGuard } from "@/lib/auth/roleGuard";
import {
  buildPersonalApiError,
  getPersonalState,
  mapTransactionRow,
  requirePersonalAccess,
  savePersonalState,
} from "@/lib/profile/personalServer";

function toAmount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
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
    id: body.id || crypto.randomUUID(),
    userId,
    type,
    category: String(body.category || "General").trim() || "General",
    amount: toAmount(body.amount),
    date: body.date || new Date().toISOString().split("T")[0],
    isRecurring: body.isRecurring === true,
    notes: String(body.notes || ""),
  };
}

async function handler(req, res, session) {
  try {
    const { userId, db } = await requirePersonalAccess(req, res);
    const state = await getPersonalState(userId, db);
    const transactions = Array.isArray(state.collections?.transactions) ? state.collections.transactions : [];

    if (req.method === "GET") {
      return res.status(200).json({
        success: true,
        data: [...transactions]
          .map(mapTransactionRow)
          .sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))),
      });
    }

    if (req.method === "POST") {
      const nextItem = buildTransactionPayload(req.body, userId);
      const nextTransactions = [nextItem, ...transactions];
      await savePersonalState(userId, { ...state, collections: { ...state.collections, transactions: nextTransactions } }, db);
      return res.status(200).json({ success: true, data: nextItem });
    }

    if (req.method === "PUT") {
      const id = String(req.body?.id || "");
      if (!id) return res.status(400).json({ success: false, message: "Transaction id is required." });

      const nextItem = buildTransactionPayload({ ...req.body, id }, userId);
      const nextTransactions = transactions.map((entry) => (String(entry.id) === id ? { ...entry, ...nextItem } : entry));
      await savePersonalState(userId, { ...state, collections: { ...state.collections, transactions: nextTransactions } }, db);
      return res.status(200).json({ success: true, data: nextItem });
    }

    if (req.method === "DELETE") {
      const id = String(req.body?.id || req.query.id || "");
      if (!id) return res.status(400).json({ success: false, message: "Transaction id is required." });
      const nextTransactions = transactions.filter((entry) => String(entry.id) !== id);
      await savePersonalState(userId, { ...state, collections: { ...state.collections, transactions: nextTransactions } }, db);
      return res.status(200).json({ success: true, data: { id } });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    return buildPersonalApiError(res, error, "Failed to handle personal transactions request.");
  }
}

export default withRoleGuard(handler);
