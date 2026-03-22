export const runtime = "nodejs";

import fs from "fs";
import path from "path";
import {
  buildPersonalApiError,
  mapAttachmentRow,
  PERSONAL_TABLES,
  requirePersonalAccess,
} from "@/lib/profile/personalServer";
import { resolvePersonalAttachmentPath } from "@/lib/profile/personalAttachments";

function withDownloadUrl(req, attachment) {
  return {
    ...attachment,
    downloadUrl: `/api/personal/attachments?downloadId=${encodeURIComponent(attachment.id)}`,
  };
}

export default async function handler(req, res) {
  try {
    const { userId, db } = await requirePersonalAccess(req, res);

    if (req.method === "GET") {
      const downloadId = String(req.query.downloadId || "");

      if (downloadId) {
        const { data, error } = await db
          .from(PERSONAL_TABLES.attachments)
          .select("id, user_id, file_url, file_name, mime_type, file_size, created_at")
          .eq("user_id", userId)
          .eq("id", downloadId)
          .maybeSingle();

        if (error) {
          throw error;
        }
        if (!data?.id) {
          return res.status(404).json({ success: false, message: "Attachment not found." });
        }

        const filePath = resolvePersonalAttachmentPath(data.file_url);
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ success: false, message: "Attachment file is missing." });
        }

        res.setHeader("Content-Type", data.mime_type || "application/octet-stream");
        res.setHeader(
          "Content-Disposition",
          `inline; filename=\"${path.basename(String(data.file_name || "attachment"))}\"`
        );
        res.setHeader("Content-Length", String(data.file_size || fs.statSync(filePath).size));
        return fs.createReadStream(filePath).pipe(res);
      }

      const { data, error } = await db
        .from(PERSONAL_TABLES.attachments)
        .select("id, user_id, file_url, file_name, mime_type, file_size, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return res.status(200).json({
        success: true,
        data: (data || []).map((row) => withDownloadUrl(req, mapAttachmentRow(row))),
      });
    }

    if (req.method === "DELETE") {
      const id = String(req.body?.id || req.query.id || "");
      if (!id) {
        return res.status(400).json({ success: false, message: "Attachment id is required." });
      }

      const { data: existing, error: existingError } = await db
        .from(PERSONAL_TABLES.attachments)
        .select("id, user_id, file_url")
        .eq("user_id", userId)
        .eq("id", id)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }
      if (!existing?.id) {
        return res.status(404).json({ success: false, message: "Attachment not found." });
      }

      const { error } = await db
        .from(PERSONAL_TABLES.attachments)
        .delete()
        .eq("user_id", userId)
        .eq("id", id);

      if (error) {
        throw error;
      }

      try {
        const filePath = resolvePersonalAttachmentPath(existing.file_url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
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
