// file location: src/pages/api/messages/threads/[threadId]/attachments.js
//
//   POST /api/messages/threads/:id/attachments   multipart/form-data { file }
//     -> the attachment descriptor to send on the message's metadata
//
//   GET  /api/messages/threads/:id/attachments?path=<storage path>[&download=1]
//     -> 302 to a short-lived signed URL
//
// The bucket is private; this membership-checked route is the only way to the
// bytes. Multipart is parsed with the platform FormData, matching
// src/pages/api/news/attachments/index.js.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { getMessageAttachmentUrl, saveMessageAttachment } from "@/lib/database/messageHub";
import { ATTACHMENT_MAX_BYTES } from "@/lib/messages/conversationModel";
import { resolveActorId, sendError } from "@/lib/messages/serverActor";

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
    if (received > ATTACHMENT_MAX_BYTES + 1024 * 512) {
      const error = new Error("That file is too large to share.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  const formData = await new Response(Buffer.concat(chunks), {
    headers: { "Content-Type": contentType },
  }).formData();

  const fields = {};
  let file = null;
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      fields[key] = value;
      continue;
    }
    file = {
      fileName: value.name || "attachment",
      mimeType: value.type || "application/octet-stream",
      buffer: Buffer.from(await value.arrayBuffer()),
    };
  }
  return { file, fields };
}

async function handler(req, res, session) {
  const threadId = Number(req.query.threadId);
  if (!Number.isFinite(threadId) || threadId <= 0) {
    return res.status(400).json({ success: false, message: "A valid threadId is required." });
  }

  try {
    if (req.method === "GET") {
      const actorId = resolveActorId(session, req);
      if (!actorId) return res.status(401).json({ success: false, message: "Sign in to open files." });
      const url = await getMessageAttachmentUrl({
        threadId,
        userId: actorId,
        path: req.query.path,
        download: req.query.download === "1",
      });
      res.setHeader("Cache-Control", "private, max-age=0, no-store");
      return res.redirect(302, url);
    }

    if (req.method === "POST") {
      const { file, fields } = await parseMultipart(req);
      // Multipart bodies are not parsed into req.body, so the dev-bypass id
      // arrives as a form field.
      const actorId = resolveActorId(session, { body: { actorId: fields.actorId }, query: req.query });
      if (!actorId) return res.status(401).json({ success: false, message: "Sign in to share files." });
      const attachment = await saveMessageAttachment({ threadId, userId: actorId, file });
      return res.status(201).json({ success: true, data: attachment });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error(`❌ ${req.method} /api/messages/threads/[id]/attachments error:`, error);
    return sendError(res, error);
  }
}

export default withRoleGuard(handler);
