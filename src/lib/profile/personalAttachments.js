import fs from "fs";
import path from "path";

const ATTACHMENTS_ROOT = path.join(process.cwd(), "private_uploads", "personal-attachments");

export function ensurePersonalAttachmentsRoot() {
  fs.mkdirSync(ATTACHMENTS_ROOT, { recursive: true });
  return ATTACHMENTS_ROOT;
}

export function sanitiseAttachmentFileName(fileName = "") {
  return String(fileName || "attachment")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^_+/, "")
    .slice(0, 180) || "attachment";
}

export function buildPersonalAttachmentRelativePath(userId, fileName) {
  const safeName = sanitiseAttachmentFileName(fileName);
  return path.posix.join(String(userId), `${Date.now()}-${safeName}`);
}

export function resolvePersonalAttachmentPath(relativePath) {
  const root = ensurePersonalAttachmentsRoot();
  const resolvedPath = path.resolve(root, relativePath);
  const resolvedRoot = path.resolve(root);

  if (!resolvedPath.startsWith(resolvedRoot)) {
    throw new Error("Invalid personal attachment path.");
  }

  return resolvedPath;
}
