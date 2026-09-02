// file location: src/lib/database/newsFeed/analytics.js
//
// Reach and engagement reporting for the communication hub.
//
// Two shapes:
//   getPostAnalytics(postId)  — one post: audience, reads, acks, comments,
//                               reactions, and the breakdown by department.
//   getHubAnalytics({ days }) — the whole hub over a window: volume by
//                               category/priority/department, read rates, the
//                               posts nobody opened, and the top publishers.
//
// Counting reuses the same helpers the feed uses, so a number shown on a card
// and the same number in the report can never disagree.

import { CATEGORIES, PRIORITIES } from "@/lib/news/constants";
import { db, throwIf, uniqueIds } from "./client";
import { getAudienceForDepartments } from "./engagement";
import { getCommentCounts } from "./comments";

const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** Reaction counts for a batch of posts, read from the shared reactions table. */
async function getReactionCounts(postIds = []) {
  const ids = uniqueIds(postIds);
  if (!ids.length) return {};

  const { data, error } = await db
    .from("content_reactions")
    .select("target_id, emoji")
    .eq("target_type", "news_update")
    .in("target_id", ids);

  throwIf(error, "Failed to count reactions");

  const counts = {};
  for (const row of data || []) {
    const entry = (counts[row.target_id] ||= { total: 0, byEmoji: {} });
    entry.total += 1;
    entry.byEmoji[row.emoji] = (entry.byEmoji[row.emoji] || 0) + 1;
  }
  return counts;
}

/** Full engagement picture for one post. */
export async function getPostAnalytics(postId) {
  const id = String(postId || "").trim();
  if (!id) return null;

  const { data: post, error } = await db
    .from("news_updates")
    .select(
      "id, title, departments, category, priority, requires_ack, published_at, view_count, author"
    )
    .eq("id", id)
    .maybeSingle();

  throwIf(error, "Failed to read the update");
  if (!post) return null;

  const [audience, reads, acks, comments, reactions] = await Promise.all([
    getAudienceForDepartments(post.departments || []),
    db.from("news_post_reads").select("user_id, read_at").eq("post_id", id),
    db.from("news_post_acknowledgements").select("user_id").eq("post_id", id),
    getCommentCounts([id]),
    getReactionCounts([id]),
  ]);

  throwIf(reads.error, "Failed to load read receipts");
  throwIf(acks.error, "Failed to load acknowledgements");

  const readUserIds = new Set((reads.data || []).map((row) => row.user_id));
  const ackUserIds = new Set((acks.data || []).map((row) => row.user_id));

  // Which departments have actually read it — the useful cut for a manager
  // deciding who still needs a nudge in the morning meeting.
  const byDepartment = {};
  for (const user of audience) {
    const key = user.department || "Unassigned";
    const entry = (byDepartment[key] ||= { department: key, audience: 0, read: 0, acknowledged: 0 });
    entry.audience += 1;
    if (readUserIds.has(user.userId)) entry.read += 1;
    if (ackUserIds.has(user.userId)) entry.acknowledged += 1;
  }

  const audienceSize = audience.length;

  return {
    postId: post.id,
    title: post.title,
    author: post.author,
    category: post.category,
    priority: post.priority,
    requiresAck: Boolean(post.requires_ack),
    publishedAt: post.published_at,
    audienceSize,
    readCount: readUserIds.size,
    readRate: percent(readUserIds.size, audienceSize),
    acknowledgedCount: ackUserIds.size,
    acknowledgedRate: percent(ackUserIds.size, audienceSize),
    outstandingCount: Math.max(audienceSize - ackUserIds.size, 0),
    commentCount: comments[id] || 0,
    reactionCount: reactions[id]?.total || 0,
    reactionsByEmoji: reactions[id]?.byEmoji || {},
    viewCount: Number(post.view_count) || 0,
    byDepartment: Object.values(byDepartment).sort((a, b) => b.audience - a.audience),
  };
}

/**
 * Hub-wide reporting over the last `days` days.
 * One pass over the posts in the window, then batched counts.
 */
export async function getHubAnalytics({ days = 30 } = {}) {
  const window = Math.min(Math.max(Number(days) || 30, 1), 365);
  const since = new Date(Date.now() - window * 86400000).toISOString();

  const { data: posts, error } = await db
    .from("news_updates")
    .select(
      "id, title, author, created_by, departments, category, priority, source, requires_ack, published_at, view_count"
    )
    .eq("status", "published")
    .is("deleted_at", null)
    .gte("published_at", since)
    .order("published_at", { ascending: false });

  throwIf(error, "Failed to load hub analytics");

  const rows = posts || [];
  const ids = uniqueIds(rows.map((row) => row.id));

  if (!ids.length) {
    return {
      windowDays: window,
      totalPosts: 0,
      totalReads: 0,
      totalComments: 0,
      totalReactions: 0,
      averageReadRate: 0,
      byCategory: [],
      byPriority: [],
      byDepartment: [],
      topPosts: [],
      unreadPosts: [],
      topAuthors: [],
      acknowledgementSummary: { required: 0, complete: 0, outstanding: 0 },
    };
  }

  const [readsResult, acksResult, commentCounts, reactionCounts, everyone] = await Promise.all([
    db.from("news_post_reads").select("post_id, user_id").in("post_id", ids),
    db.from("news_post_acknowledgements").select("post_id, user_id").in("post_id", ids),
    getCommentCounts(ids),
    getReactionCounts(ids),
    getAudienceForDepartments([]),
  ]);

  throwIf(readsResult.error, "Failed to load read receipts");
  throwIf(acksResult.error, "Failed to load acknowledgements");

  const readCounts = {};
  for (const row of readsResult.data || []) {
    readCounts[row.post_id] = (readCounts[row.post_id] || 0) + 1;
  }
  const ackCounts = {};
  for (const row of acksResult.data || []) {
    ackCounts[row.post_id] = (ackCounts[row.post_id] || 0) + 1;
  }

  // Audience size per post is resolved from the department list rather than
  // re-querying users once per post: the full staff list is fetched once and
  // the department filter is applied in memory.
  const audienceFor = (departments = []) => {
    const targets = (departments || [])
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);
    if (!targets.length || targets.includes("general")) return everyone.length;
    return everyone.filter((user) => {
      const department = String(user.department || "").toLowerCase();
      const role = String(user.role || "").toLowerCase();
      return targets.some(
        (target) => department === target || role === target || role.includes(target)
      );
    }).length;
  };

  const enriched = rows.map((row) => {
    const audienceSize = audienceFor(row.departments);
    const reads = readCounts[row.id] || 0;
    return {
      postId: row.id,
      title: row.title,
      author: row.author,
      createdBy: row.created_by,
      category: row.category,
      priority: row.priority,
      source: row.source,
      departments: row.departments || [],
      requiresAck: Boolean(row.requires_ack),
      publishedAt: row.published_at,
      audienceSize,
      readCount: reads,
      readRate: percent(reads, audienceSize),
      ackCount: ackCounts[row.id] || 0,
      commentCount: commentCounts[row.id] || 0,
      reactionCount: reactionCounts[row.id]?.total || 0,
      viewCount: Number(row.view_count) || 0,
    };
  });

  const groupCount = (list, key, definitions) => {
    const counts = {};
    for (const item of list) {
      const value = item[key];
      const entry = (counts[value] ||= { value, posts: 0, reads: 0 });
      entry.posts += 1;
      entry.reads += item.readCount;
    }
    return definitions
      .map((definition) => ({
        value: definition.value,
        label: definition.label,
        posts: counts[definition.value]?.posts || 0,
        reads: counts[definition.value]?.reads || 0,
      }))
      .filter((entry) => entry.posts > 0);
  };

  const departmentCounts = {};
  for (const item of enriched) {
    const list = item.departments.length ? item.departments : ["General"];
    for (const department of list) {
      const entry = (departmentCounts[department] ||= { department, posts: 0, reads: 0 });
      entry.posts += 1;
      entry.reads += item.readCount;
    }
  }

  const authorCounts = {};
  for (const item of enriched) {
    const key = item.author || "System";
    const entry = (authorCounts[key] ||= { author: key, posts: 0, reads: 0 });
    entry.posts += 1;
    entry.reads += item.readCount;
  }

  const ackPosts = enriched.filter((item) => item.requiresAck);

  return {
    windowDays: window,
    totalPosts: enriched.length,
    totalReads: enriched.reduce((sum, item) => sum + item.readCount, 0),
    totalComments: enriched.reduce((sum, item) => sum + item.commentCount, 0),
    totalReactions: enriched.reduce((sum, item) => sum + item.reactionCount, 0),
    averageReadRate: Math.round(
      enriched.reduce((sum, item) => sum + item.readRate, 0) / enriched.length
    ),
    byCategory: groupCount(enriched, "category", CATEGORIES),
    byPriority: groupCount(enriched, "priority", PRIORITIES),
    byDepartment: Object.values(departmentCounts).sort((a, b) => b.posts - a.posts),
    topPosts: [...enriched].sort((a, b) => b.readRate - a.readRate).slice(0, 10),
    unreadPosts: [...enriched]
      .filter((item) => item.readRate < 50)
      .sort((a, b) => a.readRate - b.readRate)
      .slice(0, 10),
    topAuthors: Object.values(authorCounts).sort((a, b) => b.posts - a.posts).slice(0, 10),
    acknowledgementSummary: {
      required: ackPosts.length,
      complete: ackPosts.filter((item) => item.ackCount >= item.audienceSize && item.audienceSize > 0)
        .length,
      outstanding: ackPosts.reduce(
        (sum, item) => sum + Math.max(item.audienceSize - item.ackCount, 0),
        0
      ),
    },
  };
}
