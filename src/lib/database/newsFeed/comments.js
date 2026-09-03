// file location: src/lib/database/newsFeed/comments.js
//
// Comments on a news post. One level of replies: a reply carries parent_id
// pointing at a top-level comment, and a reply to a reply is flattened onto
// the same parent — deep threads are not what a dealership noticeboard needs.
//
// Deletion is soft: the row survives with deleted_at set so reply ordering and
// the mention index stay intact, and the UI renders a tombstone.

import { extractMentionIds } from "@/lib/news/format";
import {
  USER_COLUMNS,
  assertWriteAccess,
  db,
  formatUser,
  requireUserId,
  requireUuid,
  throwIf,
  uniqueIds,
} from "./client";
import { syncMentionsForComment } from "./mentions";

const TABLE = "news_comments";

const COMMENT_COLUMNS = `
  id, post_id, parent_id, user_id, body, created_at, updated_at, deleted_at,
  author:users!news_comments_user_fkey(${USER_COLUMNS})
`;

const formatCommentRow = (row) => ({
  id: row.id,
  postId: row.post_id,
  parentId: row.parent_id,
  userId: row.user_id,
  body: row.deleted_at ? "" : row.body,
  isDeleted: Boolean(row.deleted_at),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  isEdited: Boolean(row.updated_at && row.updated_at !== row.created_at),
  author: formatUser(row.author),
  replies: [],
});

/** { [postId]: count } — live comments only, so a tombstone does not inflate it. */
export async function getCommentCounts(postIds = []) {
  const ids = uniqueIds(postIds);
  if (!ids.length) return {};

  const { data, error } = await db
    .from(TABLE)
    .select("post_id")
    .in("post_id", ids)
    .is("deleted_at", null);

  throwIf(error, "Failed to count comments");

  const counts = {};
  for (const row of data || []) {
    counts[row.post_id] = (counts[row.post_id] || 0) + 1;
  }
  return counts;
}

/** Every comment on a post, nested one level deep, oldest first. */
export async function getComments(postId) {
  const id = requireUuid(postId, "postId");

  const { data, error } = await db
    .from(TABLE)
    .select(COMMENT_COLUMNS)
    .eq("post_id", id)
    .order("created_at", { ascending: true });

  throwIf(error, "Failed to load comments");

  const rows = (data || []).map(formatCommentRow);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const roots = [];

  for (const comment of rows) {
    const parent = comment.parentId ? byId.get(comment.parentId) : null;
    if (parent) parent.replies.push(comment);
    else roots.push(comment);
  }

  // A comment deleted with live replies still needs to render as a tombstone;
  // one with no replies left is dropped so the thread does not fill with holes.
  return roots.filter((comment) => !comment.isDeleted || comment.replies.length > 0);
}

export async function createComment({ postId, userId, body, parentId = null }) {
  assertWriteAccess("posting a comment");
  const post = requireUuid(postId, "postId");
  const author = requireUserId(userId);
  const text = String(body || "").trim();
  if (!text) throw new Error("A comment cannot be empty.");
  if (text.length > 4000) throw new Error("That comment is too long (4000 characters max).");

  // Flatten replies-to-replies onto the top-level parent.
  let resolvedParent = null;
  if (parentId) {
    const { data: parent, error: parentError } = await db
      .from(TABLE)
      .select("id, parent_id, post_id")
      .eq("id", requireUuid(parentId, "parentId"))
      .maybeSingle();
    throwIf(parentError, "Failed to read the parent comment");
    if (!parent || parent.post_id !== post) {
      throw new Error("That comment is no longer available to reply to.");
    }
    resolvedParent = parent.parent_id || parent.id;
  }

  const { data, error } = await db
    .from(TABLE)
    .insert([{ post_id: post, parent_id: resolvedParent, user_id: author, body: text }])
    .select(COMMENT_COLUMNS)
    .single();

  throwIf(error, "Failed to post the comment");

  const comment = formatCommentRow(data);

  await syncMentionsForComment({
    postId: post,
    commentId: comment.id,
    mentionedUserIds: extractMentionIds(text),
    createdBy: author,
  });

  return comment;
}

export async function updateComment({ commentId, userId, body }) {
  assertWriteAccess("editing a comment");
  const id = requireUuid(commentId, "commentId");
  const editor = requireUserId(userId);
  const text = String(body || "").trim();
  if (!text) throw new Error("A comment cannot be empty.");

  const { data: existing, error: readError } = await db
    .from(TABLE)
    .select("id, post_id, user_id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  throwIf(readError, "Failed to read the comment");
  if (!existing || existing.deleted_at) throw new Error("That comment no longer exists.");
  if (String(existing.user_id) !== String(editor)) {
    throw new Error("You can only edit your own comments.");
  }

  const { data, error } = await db
    .from(TABLE)
    .update({ body: text, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(COMMENT_COLUMNS)
    .single();

  throwIf(error, "Failed to save the comment");

  await syncMentionsForComment({
    postId: existing.post_id,
    commentId: id,
    mentionedUserIds: extractMentionIds(text),
    createdBy: editor,
  });

  return formatCommentRow(data);
}

/**
 * Soft delete. The author can always remove their own comment; a moderator
 * (decided by the API route, which owns the role check) can remove any.
 */
export async function deleteComment({ commentId, userId, canModerate = false }) {
  assertWriteAccess("deleting a comment");
  const id = requireUuid(commentId, "commentId");
  const actor = requireUserId(userId);

  const { data: existing, error: readError } = await db
    .from(TABLE)
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  throwIf(readError, "Failed to read the comment");
  if (!existing) throw new Error("That comment no longer exists.");
  if (!canModerate && String(existing.user_id) !== String(actor)) {
    throw new Error("You can only delete your own comments.");
  }

  const { error } = await db
    .from(TABLE)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  throwIf(error, "Failed to delete the comment");
  return { id };
}

/** Browser-only realtime hook so an open thread updates as others type. */
export function subscribeToComments(postId, onChange) {
  if (typeof window === "undefined") return () => {};
  const id = String(postId || "");
  if (!id) return () => {};

  const channel = db
    .channel(`news-comments-${id}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `post_id=eq.${id}` },
      onChange
    )
    .subscribe();

  return () => {
    void db.removeChannel(channel);
  };
}
