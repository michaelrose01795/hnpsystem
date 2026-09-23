// file location: src/pages/api/news/attachments/index.js
//
//   POST /api/news/attachments   multipart/form-data
//        fields: file, and either postId or draftKey
//     -> the stored attachment's metadata
//
//   GET  /api/news/attachments?draftKey=...
//     -> what the composer has already uploaded against this draft
//
// Multipart is parsed with the platform's own FormData rather than a parser
// dependency, matching src/pages/api/personal/upload.js.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { ATTACHMENT_MAX_BYTES } from "@/lib/news/constants";
import {
  getDraftAttachments,
  saveAttachment,
} from "@/lib/database/newsFeed/attachments";
import { assertCapability, assertIdentified, resolveViewer, toApiError } from "@/lib/news/serverViewer";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function parseMultipart(req) {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.startsWith("multipart/form-data")) {
    const error = new Error("Expected a multipart/form-data upload.");
    error.statusCode = 400;
    throw error;
  }

  const chunks = [];
  let received = 0;
  for await (const chunk of req) {
    received += chunk.length;
    // Bail before buffering something enormous; the per-file limit is checked
    // again in saveAttachment, this guard is about memory.
    if (received > ATTACHMENT_MAX_BYTES + 1024 * 512) {
      const error = new Error("That file is too large to attach.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  const response = new Response(Buffer.concat(chunks), {
    headers: { "Content-Type": contentType },
  });
  const formData = await response.formData();

  let file = null;
  const fields = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      fields[key] = value;
      continue;
    }
    const arrayBuffer = await value.arrayBuffer();
    file = {
      fileName: value.name || "attachment",
      mimeType: value.type || "application/octet-stream",
      buffer: Buffer.from(arrayBuffer),
    };
  }

  return { file, fields };
}

async function handler(req, res, session) {
  const viewer = resolveViewer(session, req);

  if (req.method === "GET") {
    try {
      const attachments = await getDraftAttachments(req.query.draftKey);
      return res.status(200).json({ success: true, data: attachments });
    } catch (error) {
      console.error("GET /api/news/attachments error:", error);
      const { status, message } = toApiError(error, "Failed to load the draft attachments.");
      return res.status(status).json({ success: false, message });
    }
  }

  if (req.method === "POST") {
    try {
      assertIdentified(viewer);
      assertCapability(viewer, "canPublish", "You do not have permission to attach files.");

      const { file, fields } = await parseMultipart(req);
      const attachment = await saveAttachment({
        postId: fields.postId || null,
        draftKey: fields.draftKey || null,
        file,
        uploadedBy: viewer.userId,
      });

      return res.status(201).json({ success: true, data: attachment });
    } catch (error) {
      console.error("POST /api/news/attachments error:", error);
      const { status, message } = toApiError(error, "Failed to upload the attachment.");
      return res.status(status).json({ success: false, message });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ success: false, message: "Method not allowed" });
}

export default withRoleGuard(handler);
