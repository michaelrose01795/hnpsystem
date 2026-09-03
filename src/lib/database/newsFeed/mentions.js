// file location: src/lib/database/newsFeed/mentions.js
//
// @mentions on posts and comments.
//
// The mention itself lives inline in the body text as @[Name](u:123) — see
// src/lib/news/format.js. This module keeps the news_mentions index in step
// with that text so "mentions me" is a query rather than a full-text scan of
// every post, and so a mention can be marked as seen.

import { assertWriteAccess, db, requireUuid, throwIf, toPositiveInt, uniqueIds, USER_COLUMNS, formatUser } from "./client";

const TABLE = "news_mentions";

/**
 * Make the stored mentions for a post match the mentions in its body.
 * Called on create and on every edit, so removing a name from the text also
 * removes the person from the mention list.
 */
export async function syncMentionsForPost({ postId, mentionedUserIds = [], createdBy = null }) {
  assertWriteAccess("saving mentions");
  const id = requireUuid(postId, "postId");
  const wanted = Array.from(
    new Set((mentionedUserIds || []).map(toPositiveInt).filter(Boolean))
  );

  const { data: existing, error } = await db
    .from(TABLE)
    .select("id, mentioned_user_id")
    .eq("post_id", id)
    .is("comment_id", null);

  throwIf(error, "Failed to read existing mentions");

  const have = new Set((existing || []).map((row) => row.mentioned_user_id));
  const toInsert = wanted.filter((userId) => !have.has(userId));
  const toDelete = (existing || []).filter(
    (row) => !wanted.includes(row.mentioned_user_id)
  );

  if (toDelete.length) {
    const { error: deleteError } = await db
      .from(TABLE)
      .delete()
      .in("id", toDelete.map((row) => row.id));
    throwIf(deleteError, "Failed to remove stale mentions");
  }

  if (toInsert.length) {
    const { error: insertError } = await db.from(TABLE).insert(
      toInsert.map((userId) => ({
        post_id: id,
        comment_id: null,
        mentioned_user_id: userId,
        created_by: toPositiveInt(createdBy),
      }))
    );
    throwIf(insertError, "Failed to save mentions");
  }

  return wanted;
}

/** Mentions raised by one comment. Comments are not edited in place often, but
 *  the same replace-the-set rule keeps the index honest when they are. */
export async function syncMentionsForComment({
  postId,
  commentId,
  mentionedUserIds = [],
  createdBy = null,
}) {
  assertWriteAccess("saving comment mentions");
  const post = requireUuid(postId, "postId");
  const comment = requireUuid(commentId, "commentId");
  const wanted = Array.from(
    new Set((mentionedUserIds || []).map(toPositiveInt).filter(Boolean))
  );

  const { error: deleteError } = await db.from(TABLE).delete().eq("comment_id", comment);
  throwIf(deleteError, "Failed to clear previous comment mentions");

  if (!wanted.length) return [];

  const { error } = await db.from(TABLE).insert(
    wanted.map((userId) => ({
      post_id: post,
      comment_id: comment,
      mentioned_user_id: userId,
      created_by: toPositiveInt(createdBy),
    }))
  );
  throwIf(error, "Failed to save comment mentions");
  return wanted;
}

/** Post ids where this user is mentioned — used by the "Mentions" feed filter. */
export async function getMentionedPostIds(userId) {
  const viewerId = toPositiveInt(userId);
  if (!viewerId) return [];

  const { data, error } = await db
    .from(TABLE)
    .select("post_id")
    .eq("mentioned_user_id", viewerId);

  throwIf(error, "Failed to load mentions");
  return uniqueIds((data || []).map((row) => row.post_id));
}

/** Unseen mentions, newest first — feeds the topbar mention counter. */
export async function getUnseenMentions(userId, { limit = 25 } = {}) {
  const viewerId = toPositiveInt(userId);
  if (!viewerId) return [];

  const { data, error } = await db
    .from(TABLE)
    .select(
      `id, post_id, comment_id, created_at,
       post:news_updates!news_mentions_post_fkey(id, title, author),
       author:users!news_mentions_user_fkey(${USER_COLUMNS})`
    )
    .eq("mentioned_user_id", viewerId)
    .is("seen_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  throwIf(error, "Failed to load unseen mentions");

  return (data || []).map((row) => ({
    id: row.id,
    postId: row.post_id,
    commentId: row.comment_id,
    createdAt: row.created_at,
    postTitle: row.post?.title || "Update",
    mentionedBy: formatUser(row.author),
  }));
}

/** Mark this user's mentions on one post (or all of them) as seen. */
export async function markMentionsSeen({ userId, postId = null }) {
  assertWriteAccess("marking mentions as seen");
  const viewerId = toPositiveInt(userId);
  if (!viewerId) return 0;

  let query = db
    .from(TABLE)
    .update({ seen_at: new Date().toISOString() })
    .eq("mentioned_user_id", viewerId)
    .is("seen_at", null);

  if (postId) query = query.eq("post_id", requireUuid(postId, "postId"));

  const { data, error } = await query.select("id");
  throwIf(error, "Failed to mark mentions as seen");
  return (data || []).length;
}

/**
 * The people a composer can @mention: active staff, optionally narrowed by a
 * search term. Returns the same user shape the rest of the hub renders.
 */
export async function searchMentionableUsers(term = "", { limit = 8 } = {}) {
  const query = String(term || "").trim();

  let request = db
    .from("users")
    .select(USER_COLUMNS)
    .eq("is_active", true)
    .order("first_name", { ascending: true })
    .limit(limit);

  if (query) {
    const safe = query.replace(/[,%()]/g, " ").trim();
    if (safe) {
      request = request.or(
        `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`
      );
    }
  }

  const { data, error } = await request;
  throwIf(error, "Failed to load mentionable users");
  return (data || []).map(formatUser);
}
