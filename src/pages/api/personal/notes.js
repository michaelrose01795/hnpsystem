import crypto from "crypto";
import {
  buildPersonalApiError,
  getPersonalState,
  mapNoteRow,
  requirePersonalAccess,
  savePersonalState,
} from "@/lib/profile/personalServer";

function buildNotePayload(body = {}, userId) {
  const now = new Date().toISOString();
  return {
    id: body.id || crypto.randomUUID(),
    userId,
    content: String(body.content || ""),
    createdAt: body.createdAt || now,
    updatedAt: now,
  };
}

export default async function handler(req, res) {
  try {
    const { userId, db } = await requirePersonalAccess(req, res);
    const state = await getPersonalState(userId, db);
    const notes = Array.isArray(state.collections?.notes) ? state.collections.notes : [];

    if (req.method === "GET") {
      return res.status(200).json({
        success: true,
        data: [...notes].map(mapNoteRow).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))),
      });
    }

    if (req.method === "POST") {
      const nextItem = buildNotePayload(req.body, userId);
      const nextNotes = [nextItem, ...notes];
      await savePersonalState(userId, { ...state, collections: { ...state.collections, notes: nextNotes } }, db);
      return res.status(200).json({ success: true, data: nextItem });
    }

    if (req.method === "PUT") {
      const id = String(req.body?.id || "");
      if (!id) return res.status(400).json({ success: false, message: "Note id is required." });
      const previous = notes.find((entry) => String(entry.id) === id) || {};
      const existing = notes.find((entry) => String(entry.id) === id);
      if (!existing) return res.status(404).json({ success: false, message: "Note not found." });

      const nextItem = buildNotePayload({ ...previous, ...req.body, id }, userId);
      const nextNotes = notes.map((entry) => (String(entry.id) === id ? { ...entry, ...nextItem } : entry));
      await savePersonalState(userId, { ...state, collections: { ...state.collections, notes: nextNotes } }, db);
      return res.status(200).json({ success: true, data: nextItem });
    }

    if (req.method === "DELETE") {
      const id = String(req.body?.id || req.query.id || "");
      if (!id) return res.status(400).json({ success: false, message: "Note id is required." });
      const nextNotes = notes.filter((entry) => String(entry.id) !== id);
      await savePersonalState(userId, { ...state, collections: { ...state.collections, notes: nextNotes } }, db);
      return res.status(200).json({ success: true, data: { id } });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    return buildPersonalApiError(res, error, "Failed to handle personal notes request.");
  }
}
