import crypto from "crypto";
import { withRoleGuard } from "@/lib/auth/roleGuard";
import {
  buildPersonalApiError,
  getPersonalState,
  mapGoalRow,
  requirePersonalAccess,
  savePersonalState,
} from "@/lib/profile/personalServer";

function buildGoalPayload(body = {}, userId) {
  const type = String(body.type || "custom").toLowerCase();
  if (!["house", "holiday", "custom"].includes(type)) {
    const error = new Error("Goal type must be house, holiday, or custom.");
    error.statusCode = 400;
    throw error;
  }

  return {
    id: body.id || crypto.randomUUID(),
    userId,
    type,
    target: Number(body.target || 0),
    current: Number(body.current || 0),
    deadline: body.deadline || null,
  };
}

async function handler(req, res, session) {
  try {
    const { userId, db } = await requirePersonalAccess(req, res);
    const state = await getPersonalState(userId, db);
    const goals = Array.isArray(state.collections?.goals) ? state.collections.goals : [];

    if (req.method === "GET") {
      return res.status(200).json({
        success: true,
        data: [...goals]
          .map(mapGoalRow)
          .sort((a, b) => String(a.deadline || "9999-12-31").localeCompare(String(b.deadline || "9999-12-31"))),
      });
    }

    if (req.method === "POST") {
      const nextItem = buildGoalPayload(req.body, userId);
      const nextGoals = [...goals, nextItem];
      await savePersonalState(userId, { ...state, collections: { ...state.collections, goals: nextGoals } }, db);
      return res.status(200).json({ success: true, data: nextItem });
    }

    if (req.method === "PUT") {
      const id = String(req.body?.id || "");
      if (!id) return res.status(400).json({ success: false, message: "Goal id is required." });
      const nextItem = buildGoalPayload({ ...req.body, id }, userId);
      const nextGoals = goals.map((entry) => (String(entry.id) === id ? { ...entry, ...nextItem } : entry));
      await savePersonalState(userId, { ...state, collections: { ...state.collections, goals: nextGoals } }, db);
      return res.status(200).json({ success: true, data: nextItem });
    }

    if (req.method === "DELETE") {
      const id = String(req.body?.id || req.query.id || "");
      if (!id) return res.status(400).json({ success: false, message: "Goal id is required." });
      const nextGoals = goals.filter((entry) => String(entry.id) !== id);
      await savePersonalState(userId, { ...state, collections: { ...state.collections, goals: nextGoals } }, db);
      return res.status(200).json({ success: true, data: { id } });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    return buildPersonalApiError(res, error, "Failed to handle personal goals request.");
  }
}

export default withRoleGuard(handler);
