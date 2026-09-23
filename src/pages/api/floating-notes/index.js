import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";
import { isCustomerRole } from "@/lib/auth/roles";
import {
  createFloatingNote,
  deleteFloatingNote,
  getFloatingNoteShareOptions,
  getFloatingNotesForUser,
  setNoteSharedUsers,
  updateFloatingNote,
} from "@/lib/database/floatingNotes";

const parsePositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const resultStatus = (result) =>
  result?.error?.code === "NOTE_NOT_ACCESSIBLE" ? 404 : 400;

const sendResult = (res, result, successStatus = 200) => {
  if (result?.success) return res.status(successStatus).json(result);
  return res.status(resultStatus(result)).json(result);
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ success: false, error: { message: "Authentication required" } });
  }
  const sessionRoles = [
    ...(Array.isArray(session.user.roles) ? session.user.roles : [session.user.roles]),
    session.user.role,
  ].filter(Boolean);
  if (sessionRoles.some(isCustomerRole)) {
    return res.status(403).json({
      success: false,
      error: { message: "Floating notes are available to staff users only" },
    });
  }

  let userId;
  try {
    userId = await resolveSessionUserId(session);
  } catch (error) {
    const status = error?.code === "USER_PROFILE_NOT_FOUND" ? 403 : 500;
    return res.status(status).json({
      success: false,
      error: { message: status === 403 ? error.message : "Unable to resolve your user account" },
    });
  }

  try {
    if (req.method === "GET") {
      if (req.query.view === "share-options") {
        const noteId = parsePositiveInteger(req.query.noteId);
        if (!noteId) {
          return res.status(400).json({ success: false, error: { message: "A valid note id is required" } });
        }
        return sendResult(res, await getFloatingNoteShareOptions(noteId, userId));
      }

      const notes = await getFloatingNotesForUser(userId);
      return res.status(200).json({ success: true, data: notes });
    }

    if (req.method === "POST") {
      const result = await createFloatingNote({
        userId,
        title: req.body?.title,
        description: req.body?.description,
      });
      return sendResult(res, result, 201);
    }

    const noteId = parsePositiveInteger(req.body?.noteId ?? req.query.noteId);
    if (!noteId) {
      return res.status(400).json({ success: false, error: { message: "A valid note id is required" } });
    }

    if (req.method === "PATCH") {
      if (req.body?.action === "set-shares") {
        if (!Array.isArray(req.body?.userIds) || req.body.userIds.length > 500) {
          return res.status(400).json({
            success: false,
            error: { message: "Shared users must be an array of no more than 500 user ids" },
          });
        }
        return sendResult(res, await setNoteSharedUsers({
          noteId,
          ownerUserId: userId,
          userIds: req.body.userIds,
        }));
      }

      const allowedUpdates = {};
      for (const key of ["title", "description", "isGlobal"]) {
        if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
          allowedUpdates[key] = req.body[key];
        }
      }
      return sendResult(res, await updateFloatingNote(noteId, userId, allowedUpdates));
    }

    if (req.method === "DELETE") {
      return sendResult(res, await deleteFloatingNote(noteId, userId));
    }

    res.setHeader("Allow", ["GET", "POST", "PATCH", "DELETE"]);
    return res.status(405).json({ success: false, error: { message: "Method not allowed" } });
  } catch (error) {
    console.error("/api/floating-notes error", error);
    return res.status(500).json({ success: false, error: { message: "Floating notes request failed" } });
  }
}
