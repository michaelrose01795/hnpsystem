export const runtime = "nodejs";

import fs from "fs";
import path from "path";
import {
  buildPersonalApiError,
  mapAttachmentRow,
  PERSONAL_TABLES,
  requirePersonalAccess,
} from "@/lib/profile/personalServer";
import {
  buildPersonalAttachmentRelativePath,
  ensurePersonalAttachmentsRoot,
  resolvePersonalAttachmentPath,
  sanitiseAttachmentFileName,
} from "@/lib/profile/personalAttachments";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function parseMultipartForm(req) {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.startsWith("multipart/form-data")) {
    throw new Error("Invalid content type. Expected multipart/form-data");
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);
  const response = new Response(buffer, {
    headers: { "Content-Type": contentType },
  });

  const formData = await response.formData();
  const fields = {};
  let file = null;

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      const arrayBuffer = await value.arrayBuffer();
      file = {
        fieldName: key,
        fileName: value.name,
        mimeType: value.type || "application/octet-stream",
        buffer: Buffer.from(arrayBuffer),
      };
    } else {
      fields[key] = value;
    }
  }

  return { fields, file };
}

function withDownloadUrl(attachment) {
  return {
    ...attachment,
    downloadUrl: `/api/personal/attachments?downloadId=${encodeURIComponent(attachment.id)}`,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const { userId, db } = await requirePersonalAccess(req, res);
    const { file } = await parseMultipartForm(req);

    if (!file) {
      return res.status(400).json({ success: false, message: "No attachment file provided." });
    }

    if (file.buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: "Attachments must be 10MB or smaller." });
    }

    ensurePersonalAttachmentsRoot();
    const safeFileName = sanitiseAttachmentFileName(file.fileName);
    const relativePath = buildPersonalAttachmentRelativePath(userId, safeFileName);
    const absolutePath = resolvePersonalAttachmentPath(relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, file.buffer);

    const { data, error } = await db
      .from(PERSONAL_TABLES.attachments)
      .insert({
        user_id: userId,
        file_url: relativePath,
        file_name: safeFileName,
        mime_type: file.mimeType,
        file_size: file.buffer.length,
        created_at: new Date().toISOString(),
      })
      .select("id, user_id, file_url, file_name, mime_type, file_size, created_at")
      .maybeSingle();

    if (error) {
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
      throw error;
    }

    return res.status(200).json({
      success: true,
      data: withDownloadUrl(mapAttachmentRow(data)),
    });
  } catch (error) {
    return buildPersonalApiError(res, error, "Failed to upload personal attachment.");
  }
}
