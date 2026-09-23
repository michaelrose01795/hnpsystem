// file location: src/lib/database/newsFeed/search.js
//
// News-specific search. Separate from the global search in
// src/lib/database/globalSearch.js on purpose: that one answers "find me this
// job / customer / part", this one answers "what did we say about the courtesy
// car policy?" and has to respect the same audience rules the feed does.
//
// Ranking is deliberately simple and explainable: a title hit beats a body
// hit, a whole-phrase hit beats scattered tokens, and recency breaks ties.

import {
  CATEGORY_VALUES,
  PRIORITY_VALUES,
  STATUS_ARCHIVED,
  STATUS_PUBLISHED,
  isPostVisibleToDepartments,
  normalizeDepartments,
} from "@/lib/news/constants";
import { buildSnippet, stripMentionTokens } from "@/lib/news/format";
import { db, throwIf, toPositiveInt } from "./client";
import { decoratePosts, formatPostRow, sortFeed } from "./posts";

const TABLE = "news_updates";

const SEARCH_COLUMNS = `
  id, title, content, departments, author, created_by, created_at, updated_at,
  priority, category, status, source, system_key,
  is_pinned, pinned_at, pinned_by,
  requires_ack, ack_due_at,
  publish_at, expires_at, published_at,
  edited_at, edit_count, view_count, deleted_at,
  authorUser:users!news_updates_created_by_fkey(user_id, first_name, last_name, photo_url, job_title, department, role)
`;

// PostgREST's or() filter treats commas and parentheses as syntax, so a raw
// user term has to be neutralised before it goes anywhere near it.
const sanitiseTerm = (term) =>
  String(term || "")
    .replace(/[,()%*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenise = (term) =>
  sanitiseTerm(term)
    .toLowerCase()
    .split(" ")
    .filter((token) => token.length > 1);

const scoreMatch = (post, phrase, tokens) => {
  const title = String(post.title || "").toLowerCase();
  const body = stripMentionTokens(post.content).toLowerCase();
  const author = String(post.author || "").toLowerCase();

  let score = 0;
  if (phrase) {
    if (title === phrase) score += 120;
    else if (title.startsWith(phrase)) score += 90;
    else if (title.includes(phrase)) score += 70;
    if (body.includes(phrase)) score += 35;
    if (author.includes(phrase)) score += 20;
  }

  for (const token of tokens) {
    if (title.includes(token)) score += 12;
    if (body.includes(token)) score += 5;
    if (author.includes(token)) score += 4;
    if (post.category?.includes(token)) score += 6;
    if (post.departments.some((department) => department.toLowerCase().includes(token))) {
      score += 6;
    }
  }

  // Every token has to appear somewhere, otherwise a two-word search returns
  // everything that merely shares one common word.
  const haystack = `${title} ${body} ${author} ${post.category} ${post.departments.join(" ")}`.toLowerCase();
  if (tokens.length && !tokens.every((token) => haystack.includes(token))) return 0;

  return score;
};

/**
 * Search the feed the viewer is allowed to see.
 *
 * @param {object}   options
 * @param {string}   options.term
 * @param {number}   options.userId
 * @param {string[]} options.viewerDepartments
 * @param {boolean}  options.canSeeEverything
 * @param {object}   options.filters  { categories, priorities, departments, authorId,
 *                                      requiresAck, from, to, includeArchived }
 */
export async function searchNews({
  term = "",
  userId = null,
  viewerDepartments = [],
  canSeeEverything = false,
  filters = {},
  limit = 60,
} = {}) {
  const viewerId = toPositiveInt(userId);
  const phrase = sanitiseTerm(term).toLowerCase();
  const tokens = tokenise(term);

  const statuses = [STATUS_PUBLISHED];
  if (filters.includeArchived) statuses.push(STATUS_ARCHIVED);

  let query = db
    .from(TABLE)
    .select(SEARCH_COLUMNS)
    .is("deleted_at", null)
    .in("status", statuses)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(500);

  // Narrow in the database where we can, so the in-memory ranking pass only
  // ever sees a bounded set.
  if (phrase) {
    const safe = sanitiseTerm(term);
    query = query.or(
      `title.ilike.%${safe}%,content.ilike.%${safe}%,author.ilike.%${safe}%`
    );
  }

  const categories = (filters.categories || []).filter((value) =>
    CATEGORY_VALUES.includes(value)
  );
  if (categories.length) query = query.in("category", categories);

  const priorities = (filters.priorities || []).filter((value) =>
    PRIORITY_VALUES.includes(value)
  );
  if (priorities.length) query = query.in("priority", priorities);

  const departments = normalizeDepartments(filters.departments);
  if (departments.length) query = query.overlaps("departments", departments);

  const authorId = toPositiveInt(filters.authorId);
  if (authorId) query = query.eq("created_by", authorId);

  if (filters.requiresAck) query = query.eq("requires_ack", true);
  if (filters.from) query = query.gte("published_at", new Date(filters.from).toISOString());
  if (filters.to) query = query.lte("published_at", new Date(filters.to).toISOString());

  const { data, error } = await query;
  throwIf(error, "Failed to search the news feed");

  const visible = (data || [])
    .map(formatPostRow)
    .filter((post) =>
      canSeeEverything ? true : isPostVisibleToDepartments(post.departments, viewerDepartments)
    );

  const ranked = phrase || tokens.length
    ? visible
        .map((post) => ({ post, score: scoreMatch(post, phrase, tokens) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          const aTime = new Date(a.post.publishedAt || a.post.createdAt).getTime();
          const bTime = new Date(b.post.publishedAt || b.post.createdAt).getTime();
          return bTime - aTime;
        })
        .map((entry) => entry.post)
    : sortFeed(visible);

  const decorated = await decoratePosts(ranked.slice(0, limit), viewerId);

  return decorated.map((post) => ({
    ...post,
    snippet: buildSnippet(post.content, 200),
  }));
}
