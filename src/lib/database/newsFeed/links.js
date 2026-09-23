// file location: src/lib/database/newsFeed/links.js
//
// Links from a news post to a real DMS record (job card, customer, vehicle,
// appointment, delivery, VHC, stock item, invoice).
//
// The href is resolved once, on write, from the shared LINK_TYPES table, so a
// link rendered on a card, in the detail popup and in a search result always
// points at the same route. record_type/record_id are kept as columns (not a
// jsonb blob) so "which announcements mention this job card?" is an index hit.

import { LINK_TYPE_VALUES, getLinkType } from "@/lib/news/constants";
import { assertWriteAccess, db, requireUuid, throwIf, uniqueIds } from "./client";

const TABLE = "news_post_links";

const formatLinkRow = (row) => ({
  id: row.id,
  postId: row.post_id,
  recordType: row.record_type,
  recordId: row.record_id,
  label: row.label || "",
  href: row.href || "",
  createdAt: row.created_at,
});

// Accepts the composer's shape ({ recordType, recordId, label }) and fills in
// the label and href from the type table when the caller left them blank.
const normalizeLink = (input) => {
  const recordType = String(input?.recordType || input?.record_type || "").trim();
  const recordId = String(input?.recordId ?? input?.record_id ?? "").trim();
  if (!recordType || !recordId) return null;
  if (!LINK_TYPE_VALUES.includes(recordType)) {
    throw new Error(`Unknown link type "${recordType}".`);
  }
  const type = getLinkType(recordType);
  return {
    record_type: recordType,
    record_id: recordId,
    label: String(input?.label || "").trim() || `${type.label} ${recordId}`,
    href: String(input?.href || "").trim() || type.buildHref(recordId),
  };
};

/** { [postId]: [link, ...] } for a batch of posts. */
export async function getLinksForPosts(postIds = []) {
  const ids = uniqueIds(postIds);
  if (!ids.length) return {};

  const { data, error } = await db
    .from(TABLE)
    .select("id, post_id, record_type, record_id, label, href, created_at")
    .in("post_id", ids)
    .order("created_at", { ascending: true });

  throwIf(error, "Failed to load post links");

  const grouped = {};
  for (const row of data || []) {
    (grouped[row.post_id] ||= []).push(formatLinkRow(row));
  }
  return grouped;
}

/** Replace a post's whole link set — the composer always sends the full list. */
export async function replacePostLinks(postId, links = []) {
  assertWriteAccess("saving post links");
  const id = requireUuid(postId, "postId");

  const rows = (Array.isArray(links) ? links : [])
    .map(normalizeLink)
    .filter(Boolean)
    .map((row) => ({ ...row, post_id: id }));

  const { error: deleteError } = await db.from(TABLE).delete().eq("post_id", id);
  throwIf(deleteError, "Failed to clear the previous post links");

  if (!rows.length) return [];

  const { data, error } = await db.from(TABLE).insert(rows).select();
  throwIf(error, "Failed to save the post links");
  return (data || []).map(formatLinkRow);
}

/**
 * Every post that links to one DMS record — this is what lets a job card, a
 * customer or a VHC show "mentioned in 2 announcements".
 */
export async function getPostsLinkedToRecord({ recordType, recordId }) {
  const type = String(recordType || "").trim();
  const id = String(recordId ?? "").trim();
  if (!type || !id) return [];
  if (!LINK_TYPE_VALUES.includes(type)) {
    throw new Error(`Unknown link type "${type}".`);
  }

  const { data, error } = await db
    .from(TABLE)
    .select("post_id, label, href, created_at")
    .eq("record_type", type)
    .eq("record_id", id)
    .order("created_at", { ascending: false });

  throwIf(error, "Failed to load linked posts");
  return (data || []).map((row) => ({
    postId: row.post_id,
    label: row.label,
    href: row.href,
    createdAt: row.created_at,
  }));
}
