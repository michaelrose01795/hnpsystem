// file location: src/lib/database/newsFeed/engagement.js
//
// Per-viewer engagement with a post: read state, required acknowledgements and
// saved (bookmarked) posts.
//
// Read and acknowledged are deliberately separate. Opening a post marks it
// read; an acknowledgement is a deliberate "I have read and understood this"
// that a manager can chase, and is only ever written from an explicit action.

import {
  assertWriteAccess,
  db,
  formatUser,
  requireUserId,
  requireUuid,
  throwIf,
  toPositiveInt,
  uniqueIds,
  USER_COLUMNS,
} from "./client";

const READS_TABLE = "news_post_reads";
const ACKS_TABLE = "news_post_acknowledgements";
const BOOKMARKS_TABLE = "news_bookmarks";

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Mark one or more posts as read by this user. Idempotent. */
export async function markPostsRead({ userId, postIds = [] }) {
  assertWriteAccess("marking a post as read");
  const viewerId = requireUserId(userId);
  const ids = uniqueIds(postIds);
  if (!ids.length) return 0;

  const { error } = await db.from(READS_TABLE).upsert(
    ids.map((postId) => ({ post_id: postId, user_id: viewerId })),
    { onConflict: "post_id,user_id", ignoreDuplicates: true }
  );

  throwIf(error, "Failed to mark the update as read");
  return ids.length;
}

/** Un-read a post, so it comes back in the Unread filter. */
export async function markPostUnread({ userId, postId }) {
  assertWriteAccess("marking a post as unread");
  const viewerId = requireUserId(userId);
  const id = requireUuid(postId, "postId");

  const { error } = await db
    .from(READS_TABLE)
    .delete()
    .eq("post_id", id)
    .eq("user_id", viewerId);

  throwIf(error, "Failed to mark the update as unread");
  return { id };
}

/** How many of the supplied posts this user has not opened. */
export async function getUnreadCount({ userId, postIds = [] }) {
  const viewerId = toPositiveInt(userId);
  const ids = uniqueIds(postIds);
  if (!viewerId || !ids.length) return 0;

  const { data, error } = await db
    .from(READS_TABLE)
    .select("post_id")
    .eq("user_id", viewerId)
    .in("post_id", ids);

  throwIf(error, "Failed to count unread updates");
  return ids.length - (data || []).length;
}

// ---------------------------------------------------------------------------
// Acknowledgements
// ---------------------------------------------------------------------------

export async function acknowledgePost({ userId, postId }) {
  assertWriteAccess("acknowledging a post");
  const viewerId = requireUserId(userId);
  const id = requireUuid(postId, "postId");

  const { data: post, error: postError } = await db
    .from("news_updates")
    .select("id, requires_ack, status, deleted_at")
    .eq("id", id)
    .maybeSingle();

  throwIf(postError, "Failed to read the update");
  if (!post || post.deleted_at) throw new Error("That update no longer exists.");
  if (!post.requires_ack) throw new Error("That update does not require an acknowledgement.");

  const { error } = await db
    .from(ACKS_TABLE)
    .upsert([{ post_id: id, user_id: viewerId }], {
      onConflict: "post_id,user_id",
      ignoreDuplicates: true,
    });

  throwIf(error, "Failed to record the acknowledgement");

  // Acknowledging is a stronger signal than reading, so it implies a read.
  await markPostsRead({ userId: viewerId, postIds: [id] });

  return { postId: id, userId: viewerId, acknowledgedAt: new Date().toISOString() };
}

/**
 * The management view of one post's acknowledgements: who was in the audience,
 * who has signed off, who has only read it, and who has done neither.
 *
 * The audience is resolved from the users table by department, matching the
 * targeting rules the feed applies, so the denominator is a real headcount and
 * not "everyone who happens to have opened the page".
 */
export async function getAcknowledgementTracking(postId) {
  const id = requireUuid(postId, "postId");

  const { data: post, error: postError } = await db
    .from("news_updates")
    .select("id, title, departments, requires_ack, ack_due_at, published_at")
    .eq("id", id)
    .maybeSingle();

  throwIf(postError, "Failed to read the update");
  if (!post) return null;

  const [audience, acks, reads] = await Promise.all([
    getAudienceForDepartments(post.departments || []),
    db.from(ACKS_TABLE).select("user_id, acknowledged_at").eq("post_id", id),
    db.from(READS_TABLE).select("user_id, read_at").eq("post_id", id),
  ]);

  throwIf(acks.error, "Failed to load acknowledgements");
  throwIf(reads.error, "Failed to load read receipts");

  const ackByUser = new Map((acks.data || []).map((row) => [row.user_id, row.acknowledged_at]));
  const readByUser = new Map((reads.data || []).map((row) => [row.user_id, row.read_at]));

  const rows = audience.map((user) => ({
    user,
    acknowledgedAt: ackByUser.get(user.userId) || null,
    readAt: readByUser.get(user.userId) || null,
    state: ackByUser.has(user.userId)
      ? "acknowledged"
      : readByUser.has(user.userId)
        ? "read"
        : "outstanding",
  }));

  return {
    postId: post.id,
    title: post.title,
    requiresAck: Boolean(post.requires_ack),
    ackDueAt: post.ack_due_at,
    publishedAt: post.published_at,
    audienceSize: rows.length,
    acknowledgedCount: rows.filter((row) => row.state === "acknowledged").length,
    readCount: rows.filter((row) => row.state !== "outstanding").length,
    outstandingCount: rows.filter((row) => row.state === "outstanding").length,
    rows: rows.sort((a, b) => {
      const order = { outstanding: 0, read: 1, acknowledged: 2 };
      const diff = order[a.state] - order[b.state];
      if (diff !== 0) return diff;
      return a.user.name.localeCompare(b.user.name);
    }),
  };
}

/**
 * Active staff who fall inside a post's target departments.
 *
 * users.department carries the canonical department name; a General post (or
 * an untargeted one) reaches everyone. Matching is case-insensitive and also
 * accepts a role that names the department, because not every user row has the
 * department column filled in.
 */
export async function getAudienceForDepartments(departments = []) {
  const targets = (Array.isArray(departments) ? departments : [])
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

  const { data, error } = await db
    .from("users")
    .select(USER_COLUMNS)
    .eq("is_active", true);

  throwIf(error, "Failed to load the audience");

  const everyone = targets.length === 0 || targets.includes("general");

  return (data || [])
    .filter((row) => {
      if (everyone) return true;
      const department = String(row.department || "").toLowerCase();
      const role = String(row.role || "").toLowerCase();
      return targets.some(
        (target) => department === target || role === target || role.includes(target)
      );
    })
    .map(formatUser);
}

/** Everything this user still owes an acknowledgement on. */
export async function getOutstandingAcknowledgements(userId) {
  const viewerId = toPositiveInt(userId);
  if (!viewerId) return [];

  const { data: posts, error } = await db
    .from("news_updates")
    .select("id, title, ack_due_at, published_at, priority, departments")
    .eq("requires_ack", true)
    .eq("status", "published")
    .is("deleted_at", null);

  throwIf(error, "Failed to load outstanding acknowledgements");

  const ids = uniqueIds((posts || []).map((row) => row.id));
  if (!ids.length) return [];

  const { data: mine, error: ackError } = await db
    .from(ACKS_TABLE)
    .select("post_id")
    .eq("user_id", viewerId)
    .in("post_id", ids);

  throwIf(ackError, "Failed to load your acknowledgements");

  const done = new Set((mine || []).map((row) => row.post_id));
  return (posts || [])
    .filter((row) => !done.has(row.id))
    .map((row) => ({
      postId: row.id,
      title: row.title,
      ackDueAt: row.ack_due_at,
      publishedAt: row.published_at,
      priority: row.priority,
      departments: row.departments || [],
    }));
}

// ---------------------------------------------------------------------------
// Saved / bookmarked
// ---------------------------------------------------------------------------

export async function setBookmark({ userId, postId, saved }) {
  assertWriteAccess("saving a post");
  const viewerId = requireUserId(userId);
  const id = requireUuid(postId, "postId");

  if (saved) {
    const { error } = await db
      .from(BOOKMARKS_TABLE)
      .upsert([{ post_id: id, user_id: viewerId }], {
        onConflict: "post_id,user_id",
        ignoreDuplicates: true,
      });
    throwIf(error, "Failed to save the update");
    return { postId: id, saved: true };
  }

  const { error } = await db
    .from(BOOKMARKS_TABLE)
    .delete()
    .eq("post_id", id)
    .eq("user_id", viewerId);

  throwIf(error, "Failed to remove the saved update");
  return { postId: id, saved: false };
}

export async function getBookmarkedPostIds(userId) {
  const viewerId = toPositiveInt(userId);
  if (!viewerId) return [];

  const { data, error } = await db
    .from(BOOKMARKS_TABLE)
    .select("post_id")
    .eq("user_id", viewerId)
    .order("created_at", { ascending: false });

  throwIf(error, "Failed to load saved updates");
  return uniqueIds((data || []).map((row) => row.post_id));
}
