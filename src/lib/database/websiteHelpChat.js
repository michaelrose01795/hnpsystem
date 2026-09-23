// file location: src/lib/database/websiteHelpChat.js
//
// Website help chat (the chat bubble on every /website page). Server-only: the
// tables are locked to the service role
// (supabase/migrations/20260914120000_website_help_chat.sql).
//
// Lifecycle of a chat (website_help_chats.status):
//   bot     visitor is talking to the keyword assistant; messages live in
//           website_help_chat_messages
//   queued  visitor asked for a person; a group thread was opened in
//           message_threads with the visitor's messaging user as its only
//           member, and the assistant transcript was posted into it
//   active  a staff member pressed Join on /messages and was added to the
//           thread; both sides now talk through public.messages
//   closed  the visitor ended the chat
//
// Who the visitor is inside public.messages:
//   - signed-in customer → their own "Customer" users row (ensureUserForCustomer)
//   - anyone else        → one shared "Website Visitor" users row. An email typed
//                          into the chat is never used to pick a users row, so a
//                          visitor cannot post as an existing staff account.

import { supabaseService } from "@/lib/database/supabaseClient";
import { ensureUserForCustomer, getThreadMessages, sendThreadMessage } from "@/lib/database/messages";

export const HELP_CHAT_STATUS = Object.freeze({
  BOT: "bot",
  QUEUED: "queued",
  ACTIVE: "active",
  CLOSED: "closed",
});

const VISITOR_USER_EMAIL = "website-visitor@humphriesandparks.invalid";
const CHAT_COLUMNS =
  "chat_id, visitor_key, customer_id, status, title, page_path, contact_name, contact_email, thread_id, customer_user_id, assigned_user_id, queued_at, joined_at, closed_at, created_at, updated_at";
const MESSAGE_COLUMNS = "message_id, chat_id, author, content, links, suggestions, offer_handoff, page_path, created_at";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const db = () => {
  if (!supabaseService) {
    throw new Error("Server missing SUPABASE_SERVICE_ROLE_KEY; the website help chat is server-only.");
  }
  return supabaseService;
};

const nowIso = () => new Date().toISOString();

const httpError = (status, message) => Object.assign(new Error(message), { status });

export const isValidVisitorKey = (value) => UUID_RE.test(String(value || ""));

/* ------------------------------------------------------------------ */
/* Chats                                                               */
/* ------------------------------------------------------------------ */

export const listHelpChatsForVisitor = async ({ visitorKey, customerId = null, limit = 20 }) => {
  if (!isValidVisitorKey(visitorKey)) return [];
  // Both values are validated UUIDs (cookie key above, signed customer id), so
  // they are safe to place inside the PostgREST or() filter.
  const filters = [`visitor_key.eq.${visitorKey}`];
  if (isValidVisitorKey(customerId)) filters.push(`customer_id.eq.${customerId}`);
  const { data, error } = await db()
    .from("website_help_chats")
    .select(CHAT_COLUMNS)
    .or(filters.join(","))
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
};

export const getHelpChatForVisitor = async ({ chatId, visitorKey, customerId = null }) => {
  const id = Number(chatId);
  if (!Number.isFinite(id) || id <= 0) throw httpError(400, "Invalid chat.");
  const { data, error } = await db().from("website_help_chats").select(CHAT_COLUMNS).eq("chat_id", id).maybeSingle();
  if (error) throw error;
  const owns =
    data &&
    ((isValidVisitorKey(visitorKey) && data.visitor_key === visitorKey) ||
      (customerId && data.customer_id && data.customer_id === customerId));
  if (!owns) throw httpError(404, "Chat not found.");
  return data;
};

export const createHelpChat = async ({ visitorKey, customerId = null, pagePath = null }) => {
  if (!isValidVisitorKey(visitorKey)) throw httpError(400, "Missing visitor.");
  const { data, error } = await db()
    .from("website_help_chats")
    .insert({ visitor_key: visitorKey, customer_id: customerId || null, page_path: pagePath })
    .select(CHAT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
};

const updateHelpChat = async (chatId, patch) => {
  const { data, error } = await db()
    .from("website_help_chats")
    .update({ ...patch, updated_at: nowIso() })
    .eq("chat_id", chatId)
    .select(CHAT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
};

// A visitor who signs in part-way keeps the chat they started.
export const claimHelpChatForCustomer = async (chat, customerId) => {
  if (!customerId || chat.customer_id) return chat;
  return updateHelpChat(chat.chat_id, { customer_id: customerId });
};

export const renameHelpChatFromQuestion = async (chat, question) => {
  if (chat.title && chat.title !== "New chat") return chat;
  const title = String(question || "").trim().replace(/\s+/g, " ").slice(0, 60);
  return title ? updateHelpChat(chat.chat_id, { title }) : chat;
};

export const touchHelpChat = (chatId, patch = {}) => updateHelpChat(chatId, patch);

/* ------------------------------------------------------------------ */
/* Assistant-phase messages                                            */
/* ------------------------------------------------------------------ */

export const addHelpChatMessage = async ({ chatId, author, content, links = [], suggestions = [], offerHandoff = false, pagePath = null }) => {
  const { data, error } = await db()
    .from("website_help_chat_messages")
    .insert({
      chat_id: chatId,
      author,
      content: String(content || "").slice(0, 4000),
      links,
      suggestions,
      offer_handoff: Boolean(offerHandoff),
      page_path: pagePath,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) throw error;
  return data;
};

export const listHelpChatMessages = async (chatId) => {
  const { data, error } = await db()
    .from("website_help_chat_messages")
    .select(MESSAGE_COLUMNS)
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return data || [];
};

/* ------------------------------------------------------------------ */
/* Messaging identity                                                  */
/* ------------------------------------------------------------------ */

const findUserByEmail = async (email) => {
  const { data, error } = await db()
    .from("users")
    .select("user_id, role")
    .ilike("email", String(email || "").trim())
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return data || null;
};

const resolveVisitorUserId = async () => {
  const existing = await findUserByEmail(VISITOR_USER_EMAIL);
  if (existing?.user_id) return existing.user_id;
  const { data, error } = await db()
    .from("users")
    .insert({
      first_name: "Website",
      last_name: "Visitor",
      name: "Website Visitor",
      email: VISITOR_USER_EMAIL,
      password_hash: "",
      password_algo: "unset",
      role: "Customer",
    })
    .select("user_id")
    .single();
  if (error) {
    if (error.code === "23505") {
      const raced = await findUserByEmail(VISITOR_USER_EMAIL);
      if (raced?.user_id) return raced.user_id;
    }
    throw error;
  }
  return data.user_id;
};

const resolveMessagingUserId = async (customer) => {
  const email = String(customer?.email || "").trim();
  if (!email) return resolveVisitorUserId();
  const existing = await findUserByEmail(email);
  if (existing?.user_id) {
    // Only ever reuse a customer account. A customer record that shares an email
    // with a staff login must not speak as that staff member.
    return String(existing.role || "").toLowerCase() === "customer" ? existing.user_id : resolveVisitorUserId();
  }
  return ensureUserForCustomer(customer);
};

/* ------------------------------------------------------------------ */
/* Queue, join, close                                                  */
/* ------------------------------------------------------------------ */

const TRANSCRIPT_LIMIT = 3500;

const buildTranscript = ({ contactName, contactEmail, pagePath, signedIn, messages }) => {
  const lines = [
    "Website help chat: a customer is waiting for a member of the team.",
    `Name: ${contactName}`,
    contactEmail ? `Email: ${contactEmail}` : null,
    signedIn ? "Signed in to their website account." : "Not signed in.",
    pagePath ? `Page: ${pagePath}` : null,
  ].filter(Boolean);
  const conversation = messages
    .filter((m) => m.author === "customer" || m.author === "assistant")
    .map((m) => `${m.author === "customer" ? "Customer" : "Assistant"}: ${String(m.content).replace(/\s+/g, " ").trim()}`);
  let body = conversation.join("\n");
  if (body.length > TRANSCRIPT_LIMIT) body = `…${body.slice(body.length - TRANSCRIPT_LIMIT)}`;
  return body ? `${lines.join("\n")}\n\nConversation so far:\n${body}` : lines.join("\n");
};

export const queueHelpChat = async ({ chat, customer = null, contactName, contactEmail, pagePath = null }) => {
  if (chat.status === HELP_CHAT_STATUS.QUEUED || chat.status === HELP_CHAT_STATUS.ACTIVE) return chat;
  if (chat.status === HELP_CHAT_STATUS.CLOSED) throw httpError(409, "This chat has ended. Start a new chat to talk to the team.");

  const customerUserId = await resolveMessagingUserId(customer);
  const client = db();

  const { data: thread, error: threadError } = await client
    .from("message_threads")
    .insert({ thread_type: "group", title: `Website chat · ${contactName}`.slice(0, 120), created_by: customerUserId })
    .select("thread_id")
    .single();
  if (threadError) throw threadError;

  const { error: memberError } = await client
    .from("message_thread_members")
    .insert({ thread_id: thread.thread_id, user_id: customerUserId, role: "member" });
  if (memberError) throw memberError;

  const history = await listHelpChatMessages(chat.chat_id);
  await sendThreadMessage({
    threadId: thread.thread_id,
    senderId: customerUserId,
    content: buildTranscript({ contactName, contactEmail, pagePath: pagePath || chat.page_path, signedIn: Boolean(customer), messages: history }),
    metadata: { websiteHelpChat: { chatId: chat.chat_id, kind: "transcript" } },
  });

  return updateHelpChat(chat.chat_id, {
    status: HELP_CHAT_STATUS.QUEUED,
    queued_at: nowIso(),
    thread_id: thread.thread_id,
    customer_user_id: customerUserId,
    contact_name: contactName,
    contact_email: contactEmail || null,
  });
};

export const getQueuePosition = async (chat) => {
  if (chat.status !== HELP_CHAT_STATUS.QUEUED || !chat.queued_at) return null;
  const { count, error } = await db()
    .from("website_help_chats")
    .select("chat_id", { count: "exact", head: true })
    .eq("status", HELP_CHAT_STATUS.QUEUED)
    .lt("queued_at", chat.queued_at);
  if (error) throw error;
  return (count || 0) + 1;
};

export const sendCustomerHelpChatMessage = async ({ chat, content }) => {
  if (!chat.thread_id || !chat.customer_user_id) throw httpError(409, "This chat is not connected to the team yet.");
  await sendThreadMessage({
    threadId: chat.thread_id,
    senderId: chat.customer_user_id,
    content: String(content).slice(0, 4000),
    metadata: { websiteHelpChat: { chatId: chat.chat_id, kind: "customer" } },
  });
  return touchHelpChat(chat.chat_id);
};

export const closeHelpChat = async ({ chat }) => {
  if (chat.status === HELP_CHAT_STATUS.CLOSED) return chat;
  if (chat.thread_id && chat.customer_user_id && chat.status !== HELP_CHAT_STATUS.BOT) {
    await sendThreadMessage({
      threadId: chat.thread_id,
      senderId: chat.customer_user_id,
      content: "The customer has ended the website chat.",
      metadata: { websiteHelpChat: { chatId: chat.chat_id, kind: "closed" } },
    });
  }
  await addHelpChatMessage({ chatId: chat.chat_id, author: "system", content: "You ended this chat." });
  return updateHelpChat(chat.chat_id, { status: HELP_CHAT_STATUS.CLOSED, closed_at: nowIso() });
};

// Staff queue for /messages.
export const listQueuedHelpChats = async () => {
  const client = db();
  const { data, error } = await client
    .from("website_help_chats")
    .select(CHAT_COLUMNS)
    .eq("status", HELP_CHAT_STATUS.QUEUED)
    .order("queued_at", { ascending: true })
    .limit(50);
  if (error) throw error;
  const chats = data || [];
  if (!chats.length) return [];

  const { data: firstQuestions, error: questionError } = await client
    .from("website_help_chat_messages")
    .select("chat_id, content, created_at")
    .in("chat_id", chats.map((chat) => chat.chat_id))
    .eq("author", "customer")
    .order("created_at", { ascending: true });
  if (questionError) throw questionError;

  const firstByChat = new Map();
  for (const row of firstQuestions || []) {
    if (!firstByChat.has(row.chat_id)) firstByChat.set(row.chat_id, row.content);
  }

  return chats.map((chat) => ({
    id: chat.chat_id,
    name: chat.contact_name || "Website visitor",
    email: chat.contact_email || null,
    signedIn: Boolean(chat.customer_id),
    pagePath: chat.page_path,
    queuedAt: chat.queued_at,
    threadId: chat.thread_id,
    firstQuestion: firstByChat.get(chat.chat_id) || null,
  }));
};

export const joinHelpChat = async ({ chatId, staffUserId }) => {
  const client = db();
  const staffId = Number(staffUserId);
  if (!Number.isFinite(staffId) || staffId <= 0) throw httpError(400, "Staff user is required.");

  // Only one member of staff can take a chat: the status guard makes the claim atomic.
  const { data: claimed, error } = await client
    .from("website_help_chats")
    .update({ status: HELP_CHAT_STATUS.ACTIVE, assigned_user_id: staffId, joined_at: nowIso(), updated_at: nowIso() })
    .eq("chat_id", Number(chatId))
    .eq("status", HELP_CHAT_STATUS.QUEUED)
    .select(CHAT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!claimed) throw httpError(409, "Someone has already joined this chat, or the customer left the queue.");

  const { data: existingMember, error: memberLookupError } = await client
    .from("message_thread_members")
    .select("member_id")
    .eq("thread_id", claimed.thread_id)
    .eq("user_id", staffId)
    .maybeSingle();
  if (memberLookupError) throw memberLookupError;
  if (!existingMember) {
    const { error: memberError } = await client
      .from("message_thread_members")
      .insert({ thread_id: claimed.thread_id, user_id: staffId, role: "leader" });
    if (memberError) throw memberError;
  }

  const { data: staff } = await client.from("users").select("first_name").eq("user_id", staffId).maybeSingle();
  const firstName = String(staff?.first_name || "").trim() || "A member of our team";
  await addHelpChatMessage({
    chatId: claimed.chat_id,
    author: "system",
    content: `${firstName} has joined the chat.`,
  });

  return claimed;
};

/* ------------------------------------------------------------------ */
/* Timeline the visitor sees                                           */
/* ------------------------------------------------------------------ */

const HIDDEN_THREAD_KINDS = new Set(["transcript", "closed"]);

export const getHelpChatTimeline = async (chat) => {
  const own = await listHelpChatMessages(chat.chat_id);
  const timeline = own.map((row) => ({
    id: `w${row.message_id}`,
    author: row.author,
    content: row.content,
    links: Array.isArray(row.links) ? row.links : [],
    suggestions: Array.isArray(row.suggestions) ? row.suggestions : [],
    offerHandoff: Boolean(row.offer_handoff),
    senderName: null,
    createdAt: row.created_at,
  }));

  if (chat.thread_id && chat.customer_user_id) {
    const threadMessages = await getThreadMessages(chat.thread_id, chat.customer_user_id, 500);
    for (const message of threadMessages) {
      if (HIDDEN_THREAD_KINDS.has(message.metadata?.websiteHelpChat?.kind)) continue;
      const fromCustomer = Number(message.senderId) === Number(chat.customer_user_id);
      timeline.push({
        id: `t${message.id}`,
        author: fromCustomer ? "customer" : "staff",
        content: message.content,
        links: [],
        suggestions: [],
        offerHandoff: false,
        senderName: fromCustomer ? null : message.sender?.firstName || message.sender?.name || "Team",
        createdAt: message.createdAt,
      });
    }
  }

  return timeline.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

export const getAssignedStaffName = async (chat) => {
  if (!chat.assigned_user_id) return null;
  const { data } = await db().from("users").select("first_name").eq("user_id", chat.assigned_user_id).maybeSingle();
  return String(data?.first_name || "").trim() || null;
};
