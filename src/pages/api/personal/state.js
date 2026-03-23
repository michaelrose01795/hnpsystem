import {
  buildPersonalApiError,
  getPersonalState,
  requirePersonalAccess,
  savePersonalState,
} from "@/lib/profile/personalServer";

export default async function handler(req, res) {
  try {
    const { userId, db } = await requirePersonalAccess(req, res);

    if (req.method === "GET") {
      const state = await getPersonalState(userId, db);
      return res.status(200).json({ success: true, data: state });
    }

    if (req.method === "PUT") {
      const state = req.body?.state;
      if (!state || typeof state !== "object") {
        return res.status(400).json({ success: false, message: "state object is required." });
      }
      const saved = await savePersonalState(userId, state, db);
      return res.status(200).json({ success: true, data: saved?.state_json || state });
    }

    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    return buildPersonalApiError(res, error, "Failed to handle personal state request.");
  }
}
