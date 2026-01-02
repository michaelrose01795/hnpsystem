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
