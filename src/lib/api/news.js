// file location: src/lib/api/news.js
//
// Browser-side calls into the news / communication hub API. Every network call
// the feed makes goes through here, so the page and its components never build
// a URL or a fetch of their own.
//
// Each helper unwraps the { success, data } envelope and returns `data`.

import { apiRequest } from "@/lib/api/client";

const unwrap = (payload) => payload?.data;

// ---------------------------------------------------------------------------
// Feed + posts
// ---------------------------------------------------------------------------
export const fetchFeed = async ({ limit, includeArchived } = {}) =>
  unwrap(
    await apiRequest("/api/news", {
      searchParams: { limit, includeArchived: includeArchived ? "true" : undefined },
    })
  );

export const fetchPost = async (postId) =>
  unwrap(await apiRequest(`/api/news/${encodeURIComponent(postId)}`));

export const createNewsPost = async (payload) =>
  unwrap(await apiRequest("/api/news", { method: "POST", body: payload }));

export const updateNewsPost = async (postId, payload) =>
  unwrap(
    await apiRequest(`/api/news/${encodeURIComponent(postId)}`, {
      method: "PATCH",
      body: payload,
    })
  );

export const deleteNewsPost = async (postId) =>
  unwrap(await apiRequest(`/api/news/${encodeURIComponent(postId)}`, { method: "DELETE" }));

// ---------------------------------------------------------------------------
// Engagement
// ---------------------------------------------------------------------------
const engage = async (postId, action) =>
  unwrap(
    await apiRequest(`/api/news/${encodeURIComponent(postId)}/engagement`, {
      method: "POST",
      body: { action },
    })
  );

export const markPostRead = (postId) => engage(postId, "read");
export const markPostUnread = (postId) => engage(postId, "unread");
export const acknowledgePost = (postId) => engage(postId, "acknowledge");
export const savePost = (postId) => engage(postId, "save");
export const unsavePost = (postId) => engage(postId, "unsave");

// ---------------------------------------------------------------------------
// Management
// ---------------------------------------------------------------------------
const manage = async (postId, body) =>
  unwrap(
    await apiRequest(`/api/news/${encodeURIComponent(postId)}/manage`, {
      method: "POST",
      body,
    })
  );

export const pinPost = (postId) => manage(postId, { action: "pin" });
export const unpinPost = (postId) => manage(postId, { action: "unpin" });
export const setPostStatus = (postId, status) => manage(postId, { action: "status", status });

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------
export const fetchComments = async (postId) =>
  unwrap(await apiRequest(`/api/news/${encodeURIComponent(postId)}/comments`));

export const createComment = async (postId, { body, parentId = null }) =>
  unwrap(
    await apiRequest(`/api/news/${encodeURIComponent(postId)}/comments`, {
      method: "POST",
      body: { body, parentId },
    })
  );

export const updateComment = async (commentId, body) =>
  unwrap(
    await apiRequest(`/api/news/comment/${encodeURIComponent(commentId)}`, {
      method: "PATCH",
      body: { body },
    })
  );

export const deleteComment = async (commentId) =>
  unwrap(
    await apiRequest(`/api/news/comment/${encodeURIComponent(commentId)}`, {
      method: "DELETE",
    })
  );

// ---------------------------------------------------------------------------
// Insights (edit history, per-post analytics, acknowledgement tracker)
// ---------------------------------------------------------------------------
export const fetchPostInsights = async (postId) =>
  unwrap(await apiRequest(`/api/news/${encodeURIComponent(postId)}/insights`));

export const fetchHubAnalytics = async ({ days = 30 } = {}) =>
  unwrap(await apiRequest("/api/news/analytics", { searchParams: { days } }));

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export const searchNews = async ({
  term = "",
  categories = [],
  priorities = [],
  departments = [],
  authorId = null,
  requiresAck = false,
  from = null,
  to = null,
  includeArchived = false,
} = {}) =>
  unwrap(
    await apiRequest("/api/news/search", {
      searchParams: {
        q: term,
        categories: categories.join(","),
        priorities: priorities.join(","),
        departments: departments.join(","),
        authorId: authorId || undefined,
        requiresAck: requiresAck ? "true" : undefined,
        from: from || undefined,
        to: to || undefined,
        includeArchived: includeArchived ? "true" : undefined,
      },
    })
  );

// ---------------------------------------------------------------------------
// Preferences, mentions, people
// ---------------------------------------------------------------------------
export const fetchPreferences = async () => unwrap(await apiRequest("/api/news/preferences"));

export const savePreferences = async (payload) =>
  unwrap(await apiRequest("/api/news/preferences", { method: "PUT", body: payload }));

export const fetchUnseenMentions = async () => unwrap(await apiRequest("/api/news/mentions"));

export const clearMentions = async (postId = null) =>
  unwrap(await apiRequest("/api/news/mentions", { method: "POST", body: { postId } }));

export const searchPeople = async (term) =>
  unwrap(await apiRequest("/api/news/people", { searchParams: { q: term } }));

export const fetchLinkedPosts = async ({ recordType, recordId }) =>
  unwrap(await apiRequest("/api/news/linked", { searchParams: { recordType, recordId } }));

// ---------------------------------------------------------------------------
// Attachments
//
// The upload is multipart, so it bypasses apiRequest (which JSON-encodes its
// body) and calls fetch directly. The response envelope is the same.
// ---------------------------------------------------------------------------
export const fetchDraftAttachments = async (draftKey) =>
  unwrap(await apiRequest("/api/news/attachments", { searchParams: { draftKey } }));

export const uploadAttachment = async ({ file, draftKey = null, postId = null }) => {
  const formData = new FormData();
  formData.append("file", file);
  if (draftKey) formData.append("draftKey", draftKey);
  if (postId) formData.append("postId", postId);

  const response = await fetch("/api/news/attachments", {
    method: "POST",
    body: formData,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Failed to upload the attachment.");
  }
  return payload.data;
};

export const deleteAttachment = async (attachmentId) =>
  unwrap(
    await apiRequest(`/api/news/attachments/${encodeURIComponent(attachmentId)}`, {
      method: "DELETE",
    })
  );
