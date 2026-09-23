// file location: src/lib/website/helpChatApi.js
//
// Request plumbing shared by the public help chat routes
// (src/pages/api/website/help-chat/*): who the visitor is, a per-IP rate limit,
// input clean-up and the one response shape the widget reads.
//
// A visitor is identified by an anonymous random key in an httpOnly cookie
// scoped to the help chat API, plus the signed customer session when they are
// signed in (src/lib/auth/customerSession.js). Either one owns a chat.

import crypto from "crypto";
import { getCustomerSessionFromReq } from "@/lib/auth/customerSession";
import { getClientIp } from "@/lib/auth/rateLimit";
import { checkRateLimit, createRateStore, pruneRateStore } from "@/lib/support/rateLimit";
import {
  getAssignedStaffName,
  getHelpChatTimeline,
  getQueuePosition,
  isValidVisitorKey,
} from "@/lib/database/websiteHelpChat";

export const HELP_CHAT_VISITOR_COOKIE = "hnp_help_chat_visitor";
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

// Process-local, like the support report limiter: a warm instance throttles a
// visitor hammering the assistant; it is not a security boundary on its own.
const HELP_CHAT_RATE = Object.freeze({ windowMs: 60 * 1000, max: 40, abuseThreshold: 120 });
const rateStore = createRateStore();

export function getHelpChatContext(req, res) {
  let visitorKey = req.cookies?.[HELP_CHAT_VISITOR_COOKIE];
  if (!isValidVisitorKey(visitorKey)) {
    visitorKey = crypto.randomUUID();
    const parts = [
      `${HELP_CHAT_VISITOR_COOKIE}=${visitorKey}`,
      "Path=/api/website/help-chat",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${VISITOR_COOKIE_MAX_AGE}`,
    ];
    if (process.env.NODE_ENV === "production") parts.push("Secure");
    res.setHeader("Set-Cookie", parts.join("; "));
  }
  const session = getCustomerSessionFromReq(req);
  return { visitorKey, customerId: session?.customerId || null };
}

export function allowHelpChatRequest(req) {
  const now = Date.now();
  pruneRateStore(rateStore, now, HELP_CHAT_RATE);
  const ip = getClientIp(req) || "anon";
  return checkRateLimit({ key: `ip:${ip}`, store: rateStore, now, limit: HELP_CHAT_RATE }).allowed;
}

export function cleanPagePath(value) {
  const path = String(value || "").split(/[?#]/)[0].trim().slice(0, 200);
  return path === "/website" || path.startsWith("/website/") ? path : "/website";
}

export function cleanText(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function summariseChat(chat) {
  return {
    id: chat.chat_id,
    status: chat.status,
    title: chat.title,
    pagePath: chat.page_path,
    createdAt: chat.created_at,
    updatedAt: chat.updated_at,
  };
}

export async function buildHelpChatPayload(chat, context) {
  const [messages, queuePosition, staffName] = await Promise.all([
    getHelpChatTimeline(chat),
    getQueuePosition(chat),
    getAssignedStaffName(chat),
  ]);
  return {
    success: true,
    signedIn: Boolean(context?.customerId),
    chat: { ...summariseChat(chat), contactName: chat.contact_name, queuePosition, staffName },
    messages,
  };
}

export function sendHelpChatError(res, error, fallback) {
  const status = Number(error?.status) || 500;
  if (status >= 500) console.error(`[help-chat] ${fallback}:`, error?.message || error);
  return res.status(status).json({
    success: false,
    message: status >= 500 ? fallback : error.message,
  });
}
