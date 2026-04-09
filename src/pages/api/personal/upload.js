export const runtime = "nodejs";

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { withRoleGuard } from "@/lib/auth/roleGuard";
import {
  buildPersonalApiError,
  buildPersonalAttachmentRelativePath,
  ensurePersonalAttachmentsRoot,
  getPersonalState,
  requirePersonalAccess,
  resolvePersonalAttachmentPath,
  sanitiseAttachmentFileName,
  savePersonalState,
} from "@/lib/profile/personalServer";

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
  let file = null;

  for (const [, value] of formData.entries()) {
    if (value instanceof File) {
      const arrayBuffer = await value.arrayBuffer();
      file = {
        fileName: value.name,
        mimeType: value.type || "application/octet-stream",
        buffer: Buffer.from(arrayBuffer),
      };
    }
  }

  return { file };
}

function withDownloadUrl(attachment) {
  return {
    ...attachment,
    downloadUrl: `/api/personal/attachments?downloadId=${encodeURIComponent(attachment.id)}`,
  };
}

async function handler(req, res, session) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const { userId, db } = await requirePersonalAccess(req, res);
    const state = await getPersonalState(userId, db);
    const { file } = await parseMultipartForm(req);

    if (!file) return res.status(400).json({ success: false, message: "No attachment file provided." });
    if (file.buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: "Attachments must be 10MB or smaller." });
    }

    ensurePersonalAttachmentsRoot();
    const safeFileName = sanitiseAttachmentFileName(file.fileName);
    const relativePath = buildPersonalAttachmentRelativePath(userId, safeFileName);
    const absolutePath = resolvePersonalAttachmentPath(relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, file.buffer);

    const attachment = {
      id: crypto.randomUUID(),
      userId,
      fileName: safeFileName,
      fileUrl: relativePath,
      mimeType: file.mimeType,
      fileSize: file.buffer.length,
      createdAt: new Date().toISOString(),
    };

    const existing = Array.isArray(state.collections?.attachments) ? state.collections.attachments : [];
    await savePersonalState(
      userId,
      {
        ...state,
        collections: {
          ...state.collections,
          attachments: [attachment, ...existing],
        },
      },
      db
    );

    return res.status(200).json({
      success: true,
      data: withDownloadUrl(attachment),
    });
  } catch (error) {
    return buildPersonalApiError(res, error, "Failed to upload personal attachment.");
  }
}

export default withRoleGuard(handler);
