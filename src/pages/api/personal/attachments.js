export const runtime = "nodejs";

import fs from "fs";
import path from "path";
import {
  buildPersonalApiError,
  getPersonalState,
  mapAttachmentRow,
  requirePersonalAccess,
  resolvePersonalAttachmentPath,
  savePersonalState,
} from "@/lib/profile/personalServer";

function withDownloadUrl(attachment) {
  return {
    ...attachment,
    downloadUrl: `/api/personal/attachments?downloadId=${encodeURIComponent(attachment.id)}`,
  };
}

export default async function handler(req, res) {
  try {
    const { userId, db } = await requirePersonalAccess(req, res);
    const state = await getPersonalState(userId, db);
    const attachments = Array.isArray(state.collections?.attachments) ? state.collections.attachments : [];

    if (req.method === "GET") {
      const downloadId = String(req.query.downloadId || "");

      if (downloadId) {
        const data = attachments.find((entry) => String(entry.id) === downloadId) || null;
        if (!data?.id) return res.status(404).json({ success: false, message: "Attachment not found." });

        const filePath = resolvePersonalAttachmentPath(data.fileUrl || data.file_url);
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ success: false, message: "Attachment file is missing." });
        }

        res.setHeader("Content-Type", data.mimeType || "application/octet-stream");
        res.setHeader("Content-Disposition", `inline; filename=\"${path.basename(String(data.fileName || "attachment"))}\"`);
        res.setHeader("Content-Length", String(data.fileSize || fs.statSync(filePath).size));
        return fs.createReadStream(filePath).pipe(res);
      }

      return res.status(200).json({
        success: true,
        data: [...attachments]
          .map(mapAttachmentRow)
          .map(withDownloadUrl)
          .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))),
      });
    }

    if (req.method === "DELETE") {
      const id = String(req.body?.id || req.query.id || "");
      if (!id) return res.status(400).json({ success: false, message: "Attachment id is required." });

      const existing = attachments.find((entry) => String(entry.id) === id) || null;
      if (!existing?.id) return res.status(404).json({ success: false, message: "Attachment not found." });

      const nextAttachments = attachments.filter((entry) => String(entry.id) !== id);
      await savePersonalState(userId, { ...state, collections: { ...state.collections, attachments: nextAttachments } }, db);

      try {
        const filePath = resolvePersonalAttachmentPath(existing.fileUrl);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (fileError) {
        console.warn("Failed to delete personal attachment file:", fileError?.message || fileError);
      }

      return res.status(200).json({ success: true, data: { id } });
    }

    res.setHeader("Allow", ["GET", "DELETE"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    return buildPersonalApiError(res, error, "Failed to handle personal attachments request.");
  }
}
