// file location: src/lib/api/messages.js
import { apiRequest } from "@/lib/api/client";

export const fetchMessageThreads = (params = {}) =>
  apiRequest("/api/messages/threads", { searchParams: params });

export const fetchThreadMessages = (threadId, params = {}) =>
  apiRequest(`/api/messages/threads/${encodeURIComponent(threadId)}/messages`, {
    searchParams: params,
  });

export const fetchMessageDirectory = (params = {}) =>
  apiRequest("/api/messages/users", { searchParams: params });

export const createThread = (payload) =>
  apiRequest("/api/messages/threads", {
    method: "POST",
    body: payload,
  });

export const sendThreadMessage = (threadId, payload) =>
  apiRequest(`/api/messages/threads/${encodeURIComponent(threadId)}/messages`, {
    method: "POST",
    body: payload,
  });

export const updateThread = (threadId, payload) =>
  apiRequest(`/api/messages/threads/${encodeURIComponent(threadId)}`, {
    method: "PATCH",
    body: payload,
  });

export const deleteThread = (threadId, payload) =>
  apiRequest(`/api/messages/threads/${encodeURIComponent(threadId)}`, {
    method: "DELETE",
    body: payload,
  });

export const fetchSystemNotifications = (params = {}) =>
  apiRequest("/api/messages/system-notifications", { searchParams: params });

export const addThreadMembers = (threadId, payload) =>
  apiRequest(`/api/messages/threads/${encodeURIComponent(threadId)}/members`, {
    method: "POST",
    body: payload,
  });

export const removeThreadMembers = (threadId, payload) =>
  apiRequest(`/api/messages/threads/${encodeURIComponent(threadId)}/members`, {
    method: "DELETE",
    body: payload,
  });

export const saveMessage = (messageId, payload) =>
  apiRequest(`/api/messages/messages/${encodeURIComponent(messageId)}/save`, {
    method: "POST",
    body: payload,
  });

export const connectCustomerToThread = (payload) =>
  apiRequest("/api/messages/connect-customer", {
    method: "POST",
    body: payload,
  });

export const ensureJobCustomerThread = (payload) =>
  apiRequest("/api/messages/job-customer-thread", {
    method: "POST",
    body: payload,
  });

export const fetchMessageTemplates = (params = {}) =>
  apiRequest("/api/messages/templates", { searchParams: params });

export const saveMessageTemplate = (payload) =>
  apiRequest("/api/messages/templates", {
    method: "POST",
    body: payload,
  });

// Conversation hub ---------------------------------------------------------

export const applyMessageAction = (threadId, payload) =>
  apiRequest(`/api/messages/threads/${encodeURIComponent(threadId)}/actions`, {
    method: "POST",
    body: payload,
  });

export const resolveMessageRecords = (references = []) =>
  apiRequest("/api/messages/records/resolve", {
    method: "POST",
    body: { references },
  });

export const buildAttachmentUrl = (threadId, path, { download = false } = {}) =>
  `/api/messages/threads/${encodeURIComponent(threadId)}/attachments?path=${encodeURIComponent(
    path
  )}${download ? "&download=1" : ""}`;

// Multipart, so this goes through fetch rather than the JSON apiRequest helper.
export const uploadMessageAttachment = async (threadId, file, { actorId } = {}) => {
  const form = new FormData();
  form.append("file", file);
  if (actorId) form.append("actorId", String(actorId));
  const response = await fetch(
    `/api/messages/threads/${encodeURIComponent(threadId)}/attachments`,
    { method: "POST", body: form, credentials: "include" }
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || `Could not upload ${file?.name || "the file"}.`);
  }
  return payload.data;
};
