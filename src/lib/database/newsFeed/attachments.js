// file location: src/lib/database/newsFeed/attachments.js
//
// Attachments on a news post. Bytes live in the PRIVATE Supabase storage
// bucket named by ATTACHMENT_BUCKET; public.news_attachments holds the
// metadata and the storage path.
//
// The bucket is private on purpose: a policy announcement can carry an HR
// document, and a public URL would leak it to anyone with the link. Downloads
// go through /api/news/attachments/[attachmentId], which is role-guarded and
// streams a short-lived signed URL.
//
// Uploads happen BEFORE the post exists (the composer lets you attach while
// still drafting), so a fresh upload is filed against a `draft_key` and
// claimed by the post when it is published.

import {
  ATTACHMENT_BUCKET,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_PER_POST,
  isAllowedAttachmentMime,
} from "@/lib/news/constants";
import {
  assertWriteAccess,
  db,
  requireUserId,
  requireUuid,
  throwIf,
  toPositiveInt,
  uniqueIds,
} from "./client";

const TABLE = "news_attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 5;

const formatAttachmentRow = (row) => ({
  id: row.id,
  postId: row.post_id,
  draftKey: row.draft_key,
  fileName: row.file_name,
  mimeType: row.mime_type,
  sizeBytes: Number(row.size_bytes) || 0,
  uploadedBy: row.uploaded_by,
  createdAt: row.created_at,
  // Never the storage path — the browser only ever gets the guarded route.
  downloadUrl: `/api/news/attachments/${row.id}`,
  isImage: String(row.mime_type || "").startsWith("image/"),
});

// Storage keys are generated, never derived from the uploaded name, so a
// hostile file name cannot escape its folder. The original name is kept in the
// database column for display.
const buildStoragePath = (scope, fileName) => {
  const extension = String(fileName || "").split(".").pop();
  const safeExtension = /^[a-zA-Z0-9]{1,8}$/.test(extension || "") ? `.${extension}` : "";
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${scope}/${unique}${safeExtension}`;
};

/** { [postId]: [attachment, ...] } for a batch of posts. */
export async function getAttachmentsForPosts(postIds = []) {
  const ids = uniqueIds(postIds);
  if (!ids.length) return {};

  const { data, error } = await db
    .from(TABLE)
    .select("id, post_id, draft_key, file_name, mime_type, size_bytes, uploaded_by, created_at")
    .in("post_id", ids)
    .order("created_at", { ascending: true });

  throwIf(error, "Failed to load attachments");

  const grouped = {};
  for (const row of data || []) {
    (grouped[row.post_id] ||= []).push(formatAttachmentRow(row));
  }
  return grouped;
}

/** Attachments still parked against a composer draft. */
export async function getDraftAttachments(draftKey) {
  const key = String(draftKey || "").trim();
  if (!key) return [];

  const { data, error } = await db
    .from(TABLE)
    .select("id, post_id, draft_key, file_name, mime_type, size_bytes, uploaded_by, created_at")
    .eq("draft_key", key)
    .is("post_id", null)
    .order("created_at", { ascending: true });

  throwIf(error, "Failed to load draft attachments");
  return (data || []).map(formatAttachmentRow);
}

/**
 * Store one uploaded file. `scopeId` is either a post id or a draft key; the
 * caller says which via `isDraft`.
 */
export async function saveAttachment({
  postId = null,
  draftKey = null,
  file,
  uploadedBy,
}) {
  assertWriteAccess("uploading an attachment");

  if (!file?.buffer?.length) throw new Error("No file was received.");
  if (file.buffer.length > ATTACHMENT_MAX_BYTES) {
    throw new Error(
      `That file is too large. The limit is ${Math.round(ATTACHMENT_MAX_BYTES / (1024 * 1024))} MB.`
    );
  }
  if (!isAllowedAttachmentMime(file.mimeType)) {
    throw new Error("That file type cannot be attached to an announcement.");
  }
  if (!postId && !draftKey) {
    throw new Error("An attachment needs either a postId or a draftKey.");
  }

  const scope = postId ? `posts/${postId}` : `drafts/${String(draftKey).slice(0, 64)}`;
  const existingCount = postId
    ? (await getAttachmentsForPosts([postId]))[postId]?.length || 0
    : (await getDraftAttachments(draftKey)).length;

  if (existingCount >= ATTACHMENT_MAX_PER_POST) {
    throw new Error(`An announcement can carry at most ${ATTACHMENT_MAX_PER_POST} attachments.`);
  }

  const storagePath = buildStoragePath(scope, file.fileName);

  const { error: uploadError } = await db.storage
    .from(ATTACHMENT_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimeType,
      upsert: false,
    });

  throwIf(uploadError, "Failed to upload the attachment");

  const { data, error } = await db
    .from(TABLE)
    .insert([
      {
        post_id: postId || null,
        draft_key: postId ? null : String(draftKey),
        file_name: String(file.fileName || "attachment").slice(0, 255),
        mime_type: file.mimeType,
        size_bytes: file.buffer.length,
        storage_path: storagePath,
        uploaded_by: toPositiveInt(uploadedBy),
      },
    ])
    .select()
    .single();

  if (error) {
    // Do not leave an orphan object behind if the metadata insert failed.
    await db.storage.from(ATTACHMENT_BUCKET).remove([storagePath]).catch(() => {});
    throw new Error(`Failed to record the attachment: ${error.message}`);
  }

  return formatAttachmentRow(data);
}

/** Move every attachment parked on a draft onto the post that was just saved. */
export async function claimDraftAttachments({ draftKey, postId }) {
  const key = String(draftKey || "").trim();
  if (!key || !postId) return [];
  assertWriteAccess("attaching files to a post");

  const { data, error } = await db
    .from(TABLE)
    .update({ post_id: requireUuid(postId, "postId"), draft_key: null })
    .eq("draft_key", key)
    .is("post_id", null)
    .select();

  throwIf(error, "Failed to attach the uploaded files");
  return (data || []).map(formatAttachmentRow);
}

/** A short-lived signed URL, for the guarded download route to redirect to. */
export async function getAttachmentDownload(attachmentId) {
  const id = requireUuid(attachmentId, "attachmentId");

  const { data: row, error } = await db
    .from(TABLE)
    .select("id, post_id, file_name, mime_type, storage_path")
    .eq("id", id)
    .maybeSingle();

  throwIf(error, "Failed to read the attachment");
  if (!row) return null;

  const { data: signed, error: signError } = await db.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: row.file_name,
    });

  throwIf(signError, "Failed to prepare the attachment download");

  return {
    id: row.id,
    postId: row.post_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    signedUrl: signed?.signedUrl || null,
  };
}

export async function deleteAttachment({ attachmentId, userId, canModerate = false }) {
  assertWriteAccess("deleting an attachment");
  const id = requireUuid(attachmentId, "attachmentId");
  const actor = requireUserId(userId);

  const { data: row, error } = await db
    .from(TABLE)
    .select("id, uploaded_by, storage_path")
    .eq("id", id)
    .maybeSingle();

  throwIf(error, "Failed to read the attachment");
  if (!row) return { id };
  if (!canModerate && String(row.uploaded_by) !== String(actor)) {
    throw new Error("You can only remove attachments you uploaded.");
  }

  await db.storage.from(ATTACHMENT_BUCKET).remove([row.storage_path]).catch(() => {});

  const { error: deleteError } = await db.from(TABLE).delete().eq("id", id);
  throwIf(deleteError, "Failed to delete the attachment");
  return { id };
}
