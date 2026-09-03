// file location: src/lib/database/newsFeed/posts.js
//
// Post reads and writes for the dealership communication hub.
//
// This is the only module that touches public.news_updates. It owns:
//   * the feed query (audience filtering, pinning, priority, scheduling,
//     expiry, drafts) and the per-viewer state that hangs off it,
//   * create / update / delete, including the edit-history snapshot,
//   * pin, publish and archive transitions.
//
// Audience filtering happens HERE, on the server, not in the page. The old
// feed fetched everything and filtered client-side; a targeted post is now
// never sent to a browser that should not see it.

import {
  GENERAL_DEPARTMENT,
  PRIORITY_RANK,
  PRIORITY_VALUES,
  CATEGORY_VALUES,
  STATUS_ARCHIVED,
  STATUS_DRAFT,
  STATUS_PUBLISHED,
  STATUS_SCHEDULED,
  SOURCE_STAFF,
  SOURCE_SYSTEM,
  isPostVisibleToDepartments,
  normalizeDepartments,
} from "@/lib/news/constants";
import { extractMentionIds } from "@/lib/news/format";
import {
  USER_COLUMNS,
  assertWriteAccess,
  db,
  formatUser,
  requireUserId,
  requireUuid,
  throwIf,
  toPositiveInt,
  uniqueIds,
} from "./client";
import { getLinksForPosts, replacePostLinks } from "./links";
import { getAttachmentsForPosts, claimDraftAttachments } from "./attachments";
import { getCommentCounts } from "./comments";
import { syncMentionsForPost } from "./mentions";

const TABLE = "news_updates";

const POST_COLUMNS = `
  id, title, content, departments, author, created_by, created_at, updated_at,
  priority, category, status, source, system_key,
  is_pinned, pinned_at, pinned_by,
  requires_ack, ack_due_at,
  publish_at, expires_at, published_at,
  edited_at, edit_count, view_count, deleted_at,
  authorUser:users!news_updates_created_by_fkey(${USER_COLUMNS})
`;

// ---------------------------------------------------------------------------
// Row <-> API shape
// ---------------------------------------------------------------------------
export const formatPostRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    departments: normalizeDepartments(row.departments),
    author: row.author,
    authorUser: formatUser(row.authorUser),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    priority: row.priority || "normal",
    category: row.category || "announcement",
    status: row.status || STATUS_PUBLISHED,
    source: row.source || SOURCE_STAFF,
    systemKey: row.system_key || null,
    isPinned: Boolean(row.is_pinned),
    pinnedAt: row.pinned_at || null,
    pinnedBy: row.pinned_by || null,
    requiresAck: Boolean(row.requires_ack),
    ackDueAt: row.ack_due_at || null,
    publishAt: row.publish_at || null,
    expiresAt: row.expires_at || null,
    publishedAt: row.published_at || row.created_at,
    editedAt: row.edited_at || null,
    editCount: Number(row.edit_count) || 0,
    viewCount: Number(row.view_count) || 0,
    links: [],
    attachments: [],
    commentCount: 0,
    readCount: 0,
    ackCount: 0,
    isRead: false,
    isAcknowledged: false,
    isSaved: false,
    isMentioned: false,
  };
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const validateEnum = (value, allowed, label, fallback) => {
  if (value == null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (!allowed.includes(normalized)) {
    throw new Error(`Unknown ${label} "${value}".`);
  }
  return normalized;
};

const toTimestamp = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date supplied.");
  }
  return date.toISOString();
};

// Draft, scheduled or published is decided from what the composer sent rather
// than trusted blindly: a post with a future publish_at is scheduled, one
// saved as a draft stays a draft whatever else is set.
const resolveStatus = ({ requestedStatus, publishAt }) => {
  const status = validateEnum(
    requestedStatus,
    [STATUS_DRAFT, STATUS_SCHEDULED, STATUS_PUBLISHED, STATUS_ARCHIVED],
    "status",
    STATUS_PUBLISHED
  );
  if (status === STATUS_DRAFT || status === STATUS_ARCHIVED) return status;
  if (publishAt && new Date(publishAt).getTime() > Date.now()) return STATUS_SCHEDULED;
  return STATUS_PUBLISHED;
};

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

/**
 * Load the feed for one viewer.
 *
 * @param {object}   options
 * @param {number}   options.userId              viewer's users.user_id
 * @param {string[]} options.viewerDepartments   departments the viewer may see
 * @param {boolean}  options.canSeeEverything    all-access / moderator
 * @param {boolean}  options.includeDrafts       include the viewer's own drafts
 * @param {number}   options.limit
 */
export async function getFeed({
  userId = null,
  viewerDepartments = [],
  canSeeEverything = false,
  includeDrafts = true,
  includeArchived = false,
  limit = 200,
} = {}) {
  const viewerId = toPositiveInt(userId);
  const nowIso = new Date().toISOString();

  let query = db
    .from(TABLE)
    .select(POST_COLUMNS)
    .is("deleted_at", null)
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  // Status window. Everyone sees published posts; authors additionally see
  // their own drafts and anything they have scheduled.
  const statuses = [STATUS_PUBLISHED];
  if (includeArchived) statuses.push(STATUS_ARCHIVED);

  if (includeDrafts && viewerId) {
    query = query.or(
      [
        `status.in.(${statuses.join(",")})`,
        `and(created_by.eq.${viewerId},status.in.(${STATUS_DRAFT},${STATUS_SCHEDULED}))`,
      ].join(",")
    );
  } else {
    query = query.in("status", statuses);
  }

  const { data, error } = await query;
  throwIf(error, "Failed to load news feed");

  const rows = Array.isArray(data) ? data : [];

  const visible = rows
    .map(formatPostRow)
    .filter((post) => {
      // A scheduled post that has come due but whose cron sweep has not run
      // yet still belongs in the feed — the schedule, not the sweep, is the
      // source of truth for what is live.
      if (post.status === STATUS_SCHEDULED) {
        const due = post.publishAt && post.publishAt <= nowIso;
        const isAuthor = viewerId && String(post.createdBy) === String(viewerId);
        if (!due && !isAuthor) return false;
      }
      if (post.status === STATUS_DRAFT) {
        return Boolean(viewerId) && String(post.createdBy) === String(viewerId);
      }
      // Expired posts drop out of the feed but are kept in the table so the
      // analytics and the audit trail stay intact.
      if (post.expiresAt && post.expiresAt <= nowIso) return false;
      if (canSeeEverything) return true;
      return isPostVisibleToDepartments(post.departments, viewerDepartments);
    });

  return sortFeed(await decoratePosts(visible, viewerId));
}

/**
 * Pinned first, then priority, then recency. Applied after decoration so the
 * order the API returns is the order the feed paints — the client never
 * re-sorts and so can never disagree with a second page of results.
 */
export const sortFeed = (posts = []) =>
  [...posts].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const rankDiff = (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
    if (rankDiff !== 0) return rankDiff;
    const aTime = new Date(a.publishedAt || a.createdAt).getTime();
    const bTime = new Date(b.publishedAt || b.createdAt).getTime();
    return bTime - aTime;
  });

/**
 * Attach everything that hangs off a post — links, attachments, counts and the
 * viewer's own read / ack / saved / mentioned state — in a fixed number of
 * queries regardless of how many posts came back.
 */
export async function decoratePosts(posts = [], viewerId = null) {
  const ids = uniqueIds(posts.map((post) => post.id));
  if (!ids.length) return posts;

  const [links, attachments, commentCounts, engagement] = await Promise.all([
    getLinksForPosts(ids),
    getAttachmentsForPosts(ids),
    getCommentCounts(ids),
    getEngagementForPosts(ids, viewerId),
  ]);

  return posts.map((post) => ({
    ...post,
    links: links[post.id] || [],
    attachments: attachments[post.id] || [],
    commentCount: commentCounts[post.id] || 0,
    readCount: engagement.readCounts[post.id] || 0,
    ackCount: engagement.ackCounts[post.id] || 0,
    isRead: engagement.read.has(post.id),
    isAcknowledged: engagement.acknowledged.has(post.id),
    isSaved: engagement.saved.has(post.id),
    isMentioned: engagement.mentioned.has(post.id),
  }));
}

/**
 * Counts across all viewers plus this viewer's own flags, in four queries.
 * Split out so the analytics module can reuse the counting half.
 */
export async function getEngagementForPosts(postIds = [], viewerId = null) {
  const ids = uniqueIds(postIds);
  const empty = {
    readCounts: {},
    ackCounts: {},
    read: new Set(),
    acknowledged: new Set(),
    saved: new Set(),
    mentioned: new Set(),
  };
  if (!ids.length) return empty;

  const [readsResult, acksResult, savedResult, mentionsResult] = await Promise.all([
    db.from("news_post_reads").select("post_id, user_id").in("post_id", ids),
    db.from("news_post_acknowledgements").select("post_id, user_id").in("post_id", ids),
    viewerId
      ? db.from("news_bookmarks").select("post_id").in("post_id", ids).eq("user_id", viewerId)
      : Promise.resolve({ data: [], error: null }),
    viewerId
      ? db
          .from("news_mentions")
          .select("post_id")
          .in("post_id", ids)
          .eq("mentioned_user_id", viewerId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  throwIf(readsResult.error, "Failed to load read state");
  throwIf(acksResult.error, "Failed to load acknowledgement state");
  throwIf(savedResult.error, "Failed to load saved posts");
  throwIf(mentionsResult.error, "Failed to load mentions");

  const result = {
    readCounts: {},
    ackCounts: {},
    read: new Set(),
    acknowledged: new Set(),
    saved: new Set(),
    mentioned: new Set(),
  };

  for (const row of readsResult.data || []) {
    result.readCounts[row.post_id] = (result.readCounts[row.post_id] || 0) + 1;
    if (viewerId && String(row.user_id) === String(viewerId)) result.read.add(row.post_id);
  }
  for (const row of acksResult.data || []) {
    result.ackCounts[row.post_id] = (result.ackCounts[row.post_id] || 0) + 1;
    if (viewerId && String(row.user_id) === String(viewerId)) {
      result.acknowledged.add(row.post_id);
    }
  }
  for (const row of savedResult.data || []) result.saved.add(row.post_id);
  for (const row of mentionsResult.data || []) result.mentioned.add(row.post_id);

  return result;
}

/**
 * One post by id, decorated the same way a feed row is.
 */
export async function getPostById(postId, { viewerId = null } = {}) {
  const id = requireUuid(postId, "postId");
  const { data, error } = await db
    .from(TABLE)
    .select(POST_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  throwIf(error, "Failed to load news post");
  if (!data) return null;

  const [decorated] = await decoratePosts([formatPostRow(data)], toPositiveInt(viewerId));
  return decorated;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

const buildWritePayload = (input = {}) => {
  const title = String(input.title || "").trim();
  const content = String(input.content || "").trim();
  if (!title) throw new Error("A title is required.");
  if (!content) throw new Error("A description is required.");

  const departments = normalizeDepartments(input.departments);
  const publishAt = toTimestamp(input.publishAt);
  const expiresAt = toTimestamp(input.expiresAt);
  const ackDueAt = toTimestamp(input.ackDueAt);

  if (publishAt && expiresAt && new Date(expiresAt) <= new Date(publishAt)) {
    throw new Error("The expiry date must be after the publish date.");
  }

  const status = resolveStatus({ requestedStatus: input.status, publishAt });

  return {
    title,
    content,
    // An untargeted post is a General one — the pre-hub feed treated an empty
    // array that way, so keep that meaning rather than hiding the post.
    departments: departments.length ? departments : [GENERAL_DEPARTMENT],
    priority: validateEnum(input.priority, PRIORITY_VALUES, "priority", "normal"),
    category: validateEnum(input.category, CATEGORY_VALUES, "category", "announcement"),
    status,
    requires_ack: Boolean(input.requiresAck),
    ack_due_at: Boolean(input.requiresAck) ? ackDueAt : null,
    publish_at: publishAt,
    expires_at: expiresAt,
    published_at: status === STATUS_PUBLISHED ? publishAt || new Date().toISOString() : null,
  };
};

/**
 * Create a post. Returns the decorated post so the caller can paint it without
 * a second round trip.
 */
export async function createPost(input = {}, { actorId, actorName } = {}) {
  assertWriteAccess("creating a news post");
  const payload = buildWritePayload(input);
  const createdBy = toPositiveInt(actorId);

  const { data, error } = await db
    .from(TABLE)
    .insert([
      {
        ...payload,
        author: actorName || "System",
        created_by: createdBy,
        source: SOURCE_STAFF,
      },
    ])
    .select(POST_COLUMNS)
    .single();

  throwIf(error, "Failed to create news post");

  const post = formatPostRow(data);

  await Promise.all([
    replacePostLinks(post.id, input.links || []),
    claimDraftAttachments({ draftKey: input.draftKey, postId: post.id }),
    syncMentionsForPost({
      postId: post.id,
      mentionedUserIds: extractMentionIds(payload.content),
      createdBy,
    }),
  ]);

  const [decorated] = await decoratePosts([post], createdBy);
  return decorated;
}

/**
 * Update a post, snapshotting the previous version into news_post_revisions
 * first so the edit history is complete. Only the fields present in `input`
 * are touched.
 */
export async function updatePost(postId, input = {}, { actorId, actorName } = {}) {
  assertWriteAccess("updating a news post");
  const id = requireUuid(postId, "postId");

  const { data: existing, error: readError } = await db
    .from(TABLE)
    .select(POST_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  throwIf(readError, "Failed to read the news post");
  if (!existing) throw new Error("That update no longer exists.");

  const payload = buildWritePayload({
    title: input.title ?? existing.title,
    content: input.content ?? existing.content,
    departments: input.departments ?? existing.departments,
    priority: input.priority ?? existing.priority,
    category: input.category ?? existing.category,
    status: input.status ?? existing.status,
    requiresAck: input.requiresAck ?? existing.requires_ack,
    ackDueAt: input.ackDueAt ?? existing.ack_due_at,
    publishAt: input.publishAt ?? existing.publish_at,
    expiresAt: input.expiresAt ?? existing.expires_at,
  });

  // Publishing a draft for the first time stamps published_at; re-editing a
  // live post must not move its position in the feed.
  if (existing.published_at && payload.status === STATUS_PUBLISHED) {
    payload.published_at = existing.published_at;
  }

  const bodyChanged =
    payload.title !== existing.title || payload.content !== existing.content;

  await snapshotRevision(existing);

  const { data, error } = await db
    .from(TABLE)
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
      ...(bodyChanged
        ? {
            edited_at: new Date().toISOString(),
            edit_count: (Number(existing.edit_count) || 0) + 1,
          }
        : {}),
    })
    .eq("id", id)
    .select(POST_COLUMNS)
    .single();

  throwIf(error, "Failed to update the news post");

  const post = formatPostRow(data);
  const actor = toPositiveInt(actorId);

  await Promise.all([
    input.links === undefined
      ? Promise.resolve()
      : replacePostLinks(post.id, input.links || []),
    claimDraftAttachments({ draftKey: input.draftKey, postId: post.id }),
    syncMentionsForPost({
      postId: post.id,
      mentionedUserIds: extractMentionIds(payload.content),
      createdBy: actor ?? toPositiveInt(existing.created_by),
    }),
  ]);

  // A materially changed post that required sign-off has to be re-acknowledged
  // — an acknowledgement is against wording, not against a row id.
  if (bodyChanged && post.requiresAck) {
    const { error: clearError } = await db
      .from("news_post_acknowledgements")
      .delete()
      .eq("post_id", post.id);
    throwIf(clearError, "Failed to reset acknowledgements after the edit");
  }

  void actorName; // Author attribution stays with the original author.

  const [decorated] = await decoratePosts([post], actor);
  return decorated;
}

// Copy the current wording into the history table before it is overwritten.
async function snapshotRevision(existingRow) {
  const { data, error } = await db
    .from("news_post_revisions")
    .select("revision")
    .eq("post_id", existingRow.id)
    .order("revision", { ascending: false })
    .limit(1);

  throwIf(error, "Failed to read the edit history");

  const nextRevision = (data?.[0]?.revision || 0) + 1;

  const { error: insertError } = await db.from("news_post_revisions").insert([
    {
      post_id: existingRow.id,
      revision: nextRevision,
      title: existingRow.title,
      content: existingRow.content,
      departments: existingRow.departments || [],
      priority: existingRow.priority,
      category: existingRow.category,
      edited_by: existingRow.created_by,
      edited_by_name: existingRow.author,
    },
  ]);

  throwIf(insertError, "Failed to record the edit history");
}

export async function getPostRevisions(postId) {
  const id = requireUuid(postId, "postId");
  const { data, error } = await db
    .from("news_post_revisions")
    .select("id, revision, title, content, departments, priority, category, edited_by_name, edited_at")
    .eq("post_id", id)
    .order("revision", { ascending: false });

  throwIf(error, "Failed to load the edit history");

  return (data || []).map((row) => ({
    id: row.id,
    revision: row.revision,
    title: row.title,
    content: row.content,
    departments: normalizeDepartments(row.departments),
    priority: row.priority,
    category: row.category,
    editedByName: row.edited_by_name,
    editedAt: row.edited_at,
  }));
}

/**
 * Soft delete — the row stays for analytics and the audit trail, and every
 * read path already filters on deleted_at.
 */
export async function deletePost(postId) {
  assertWriteAccess("deleting a news post");
  const id = requireUuid(postId, "postId");
  const { error } = await db
    .from(TABLE)
    .update({ deleted_at: new Date().toISOString(), is_pinned: false })
    .eq("id", id);
  throwIf(error, "Failed to delete the news post");
  return { id };
}

export async function setPinned(postId, { pinned, actorId } = {}) {
  assertWriteAccess("pinning a news post");
  const id = requireUuid(postId, "postId");
  const isPinned = Boolean(pinned);

  const { data, error } = await db
    .from(TABLE)
    .update({
      is_pinned: isPinned,
      pinned_at: isPinned ? new Date().toISOString() : null,
      pinned_by: isPinned ? toPositiveInt(actorId) : null,
    })
    .eq("id", id)
    .select(POST_COLUMNS)
    .single();

  throwIf(error, "Failed to pin the news post");
  const [decorated] = await decoratePosts([formatPostRow(data)], toPositiveInt(actorId));
  return decorated;
}

export async function setStatus(postId, status, { actorId } = {}) {
  assertWriteAccess("changing a news post status");
  const id = requireUuid(postId, "postId");
  const next = validateEnum(
    status,
    [STATUS_DRAFT, STATUS_SCHEDULED, STATUS_PUBLISHED, STATUS_ARCHIVED],
    "status",
    STATUS_PUBLISHED
  );

  const patch = { status: next, updated_at: new Date().toISOString() };
  if (next === STATUS_PUBLISHED) {
    patch.published_at = new Date().toISOString();
    patch.publish_at = null;
  }
  if (next === STATUS_ARCHIVED) patch.is_pinned = false;

  const { data, error } = await db
    .from(TABLE)
    .update(patch)
    .eq("id", id)
    .select(POST_COLUMNS)
    .single();

  throwIf(error, "Failed to change the news post status");
  const [decorated] = await decoratePosts([formatPostRow(data)], toPositiveInt(actorId));
  return decorated;
}

/**
 * Promote every scheduled post whose time has come. Idempotent — run by the
 * cron sweep, and safe to run as often as you like.
 */
export async function publishDueScheduledPosts() {
  assertWriteAccess("publishing scheduled posts");
  const nowIso = new Date().toISOString();

  const { data, error } = await db
    .from(TABLE)
    .update({ status: STATUS_PUBLISHED, published_at: nowIso, updated_at: nowIso })
    .eq("status", STATUS_SCHEDULED)
    .lte("publish_at", nowIso)
    .is("deleted_at", null)
    .select("id, title");

  throwIf(error, "Failed to publish scheduled posts");
  return data || [];
}

/**
 * Archive everything past its expiry date so the feed query has less to skip
 * and the archive view is meaningful.
 */
export async function archiveExpiredPosts() {
  assertWriteAccess("archiving expired posts");
  const nowIso = new Date().toISOString();

  const { data, error } = await db
    .from(TABLE)
    .update({ status: STATUS_ARCHIVED, is_pinned: false, updated_at: nowIso })
    .eq("status", STATUS_PUBLISHED)
    .not("expires_at", "is", null)
    .lte("expires_at", nowIso)
    .is("deleted_at", null)
    .select("id, title");

  throwIf(error, "Failed to archive expired posts");
  return data || [];
}

/**
 * Insert-or-update an automated post, keyed on its system_key so a re-run
 * refreshes the existing post instead of stacking duplicates.
 */
export async function upsertSystemPost({
  systemKey,
  title,
  content,
  departments = [GENERAL_DEPARTMENT],
  priority = "normal",
  category = "system",
  expiresAt = null,
  links = [],
  author,
}) {
  assertWriteAccess("writing an automated news post");
  const key = String(systemKey || "").trim();
  if (!key) throw new Error("systemKey is required for an automated post.");

  const nowIso = new Date().toISOString();
  const payload = {
    system_key: key,
    title: String(title || "").trim(),
    content: String(content || "").trim(),
    departments: normalizeDepartments(departments),
    priority: validateEnum(priority, PRIORITY_VALUES, "priority", "normal"),
    category: validateEnum(category, CATEGORY_VALUES, "category", "system"),
    status: STATUS_PUBLISHED,
    source: SOURCE_SYSTEM,
    author: author || "HNPSystem — Automated",
    published_at: nowIso,
    updated_at: nowIso,
    expires_at: expiresAt ? toTimestamp(expiresAt) : null,
    deleted_at: null,
  };

  const { data, error } = await db
    .from(TABLE)
    .upsert(payload, { onConflict: "system_key" })
    .select(POST_COLUMNS)
    .single();

  throwIf(error, "Failed to write the automated news post");

  const post = formatPostRow(data);
  if (links.length) await replacePostLinks(post.id, links);
  return post;
}

export async function incrementViewCount(postId) {
  const id = requireUuid(postId, "postId");
  if (!id) return;
  // Read-modify-write rather than an RPC: the count is a soft engagement
  // signal, and adding a Postgres function for it would be a schema change
  // callers cannot apply from here.
  const { data, error } = await db
    .from(TABLE)
    .select("view_count")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return;
  await db
    .from(TABLE)
    .update({ view_count: (Number(data.view_count) || 0) + 1 })
    .eq("id", id);
}

export { requireUserId };
