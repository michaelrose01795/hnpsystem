// ✅ Connected to Supabase (server-side)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/lib/database/messages.js
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { getDisplayName } from "@/lib/users/displayName";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbClient = serviceKey ? createClient(supabaseUrl, serviceKey) : supabase;
const isServiceClient = Boolean(serviceKey);

const assertMessagingWriteAccess = () => {
  if (!isServiceClient) {
    throw new Error(
      "Server missing SUPABASE_SERVICE_ROLE_KEY; messaging writes are blocked by RLS."
    );
  }
};

const buildFullName = (user) => getDisplayName(user);

const formatUserProfile = (user) => {
  if (!user) return null;
  return {
    id: user.user_id,
    firstName: user.first_name || "",
    lastName: user.last_name || "",
    email: user.email || "",
    role: user.role || "",
    name: buildFullName(user),
  };
};

const formatMemberRow = (row) => ({
  userId: row.user_id,
  role: row.role,
  joinedAt: row.joined_at,
  lastReadAt: row.last_read_at,
  profile: formatUserProfile(row.user),
});

const CONVERSATION_LOG_KEY = "_conversation";

const stripConversationMetadata = (metadata) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return metadata || null;
  }
  const next = { ...metadata };
  delete next[CONVERSATION_LOG_KEY];
  return Object.keys(next).length ? next : null;
};

const getConversationLog = (metadata) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const entries = metadata[CONVERSATION_LOG_KEY];
  return Array.isArray(entries) ? entries : [];
};

const buildConversationMessageId = (threadId) =>
  `t${threadId}-m${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

const normalizeStoredSenderProfile = (sender) => {
  if (!sender || typeof sender !== "object") return null;
  const id = normalizeUserId(sender.user_id ?? sender.id);
  if (!id) return null;
  return {
    id,
    firstName: sender.first_name || sender.firstName || "",
    lastName: sender.last_name || sender.lastName || "",
    email: sender.email || "",
    role: sender.role || "",
    name:
      sender.name ||
      [sender.first_name || sender.firstName, sender.last_name || sender.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      sender.email ||
      "Team Member",
  };
};

const normalizeConversationEntry = (entry, fallback = {}) => {
  if (!entry || typeof entry !== "object") return null;
  const threadId = Number(entry.threadId ?? fallback.threadId ?? null);
  const createdAt = entry.createdAt || entry.created_at || fallback.createdAt || new Date().toISOString();
  const senderId = normalizeUserId(entry.senderId ?? entry.sender_id ?? fallback.senderId ?? null);
  const receiverId = normalizeUserId(
    entry.receiverId ?? entry.receiver_id ?? fallback.receiverId ?? null
  );
  const content = String(entry.content ?? fallback.content ?? "").trim();
  if (!content) return null;

  return {
    id: entry.id || fallback.id || buildConversationMessageId(threadId || "0"),
    threadId: Number.isFinite(threadId) ? threadId : fallback.threadId || null,
    content,
    createdAt,
    senderId: senderId || null,
    receiverId: receiverId || null,
    sender: normalizeStoredSenderProfile(entry.sender) || fallback.sender || null,
    metadata: stripConversationMetadata(entry.metadata ?? fallback.metadata ?? null),
    savedForever: Boolean(entry.savedForever ?? entry.saved_forever ?? fallback.savedForever),
  };
};

const sortConversationEntries = (entries = []) =>
  [...entries].sort(
    (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  );

const extractConversationEntriesFromRows = (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const withConversationLog = rows.find((row) => getConversationLog(row.metadata).length > 0);

  if (withConversationLog) {
    const entries = getConversationLog(withConversationLog.metadata)
      .map((entry) =>
        normalizeConversationEntry(entry, {
          threadId: withConversationLog.thread_id,
          senderId: withConversationLog.sender_id,
          receiverId: withConversationLog.receiver_id,
          createdAt: withConversationLog.created_at,
          metadata: withConversationLog.metadata,
          savedForever: withConversationLog.saved_forever,
        })
      )
      .filter(Boolean);
    return sortConversationEntries(entries);
  }

  const legacyEntries = rows
    .map((row) =>
      normalizeConversationEntry(
        {
          id: row.message_id,
          threadId: row.thread_id,
          content: row.content,
          createdAt: row.created_at,
          senderId: row.sender_id,
          receiverId: row.receiver_id,
          sender: row.sender,
          metadata: row.metadata,
          savedForever: row.saved_forever,
        },
        {
          id: row.message_id,
          threadId: row.thread_id,
        }
      )
    )
    .filter(Boolean);

  return sortConversationEntries(legacyEntries);
};

const serializeConversationEntries = (entries = []) =>
  entries.map((entry) => ({
    id: entry.id,
    threadId: entry.threadId,
    content: entry.content,
    createdAt: entry.createdAt,
    senderId: entry.senderId,
    receiverId: entry.receiverId,
    sender: entry.sender || null,
    metadata: entry.metadata || null,
    savedForever: Boolean(entry.savedForever),
  }));

const buildConversationRowPayload = (threadId, entries = []) => {
  const sorted = sortConversationEntries(entries);
  const latest = sorted[sorted.length - 1];
  if (!latest) return null;
  const metadata = {
    ...(latest.metadata || {}),
    [CONVERSATION_LOG_KEY]: serializeConversationEntries(sorted),
  };
  return {
    thread_id: threadId,
    sender_id: latest.senderId || null,
    receiver_id: latest.receiverId || null,
    content: latest.content,
    created_at: latest.createdAt || new Date().toISOString(),
    metadata,
    saved_forever: Boolean(latest.savedForever),
  };
};

const formatMessageRow = (row) => ({
  id: row.message_id,
  threadId: row.thread_id,
  content: row.content,
  createdAt: row.created_at,
  senderId: row.sender_id,
  receiverId: row.receiver_id,
  sender: formatUserProfile(row.sender),
  metadata: stripConversationMetadata(row.metadata),
  savedForever: Boolean(row.saved_forever),
});

const DIRECT_HASH_PREFIX = "direct";

const buildDirectHash = (userA, userB) => {
  const sorted = [Number(userA), Number(userB)].sort((a, b) => a - b);
  return `${DIRECT_HASH_PREFIX}:${sorted[0]}:${sorted[1]}`;
};

const normalizeUserId = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

const formatThreadRow = (row, currentUserId, membershipMap = {}) => {
  if (!row) return null;

  const members = (row.participants || []).map(formatMemberRow);
  const lastMessage = row.recent_messages?.[0]
    ? formatMessageRow(row.recent_messages[0])
    : null;

  const memberMeta = membershipMap[row.thread_id];
  const lastReadAt = memberMeta?.last_read_at || null;
  const hasUnread =
    Boolean(lastMessage) &&
    (!lastReadAt || new Date(lastMessage.createdAt) > new Date(lastReadAt));

  let title = row.title;
  if (!title) {
    if (row.thread_type === "direct") {
      const otherParticipant = members.find((m) => m.userId !== currentUserId);
      title = otherParticipant?.profile?.name || "Direct message";
    } else {
      const nameList = members
        .filter((m) => m.userId !== currentUserId)
        .map((m) => m.profile?.name)
        .filter(Boolean)
        .slice(0, 3);
      title = nameList.length ? nameList.join(", ") : "Group chat";
    }
  }

  return {
    id: row.thread_id,
    type: row.thread_type,
    title: title || "Group chat",
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    members,
    lastMessage,
    hasUnread,
    lastReadAt,
  };
};

const getMembershipMap = (rows = []) =>
  rows.reduce((acc, row) => {
    acc[row.thread_id] = {
      threadId: row.thread_id,
      last_read_at: row.last_read_at,
    };
    return acc;
  }, {});

export const getThreadsForUser = async (userId) => {
  const userIdNum = normalizeUserId(userId);
  if (!userIdNum) return [];

  const { data: membershipRows, error: membershipError } = await dbClient
    .from("message_thread_members")
    .select("thread_id, last_read_at")
    .eq("user_id", userIdNum);

  if (membershipError) {
    console.error("❌ getThreadsForUser membership error:", membershipError);
    return [];
  }

  if (!membershipRows?.length) return [];

  const threadIds = membershipRows.map((row) => row.thread_id);
  const membershipMap = getMembershipMap(membershipRows);

  const { data: threadRows, error } = await dbClient
    .from("message_threads")
    .select(
      `
      thread_id,
      thread_type,
      title,
      unique_hash,
      created_by,
      created_at,
      updated_at,
      participants:message_thread_members(
        user_id,
        role,
        joined_at,
        last_read_at,
        user:users!message_thread_members_user_id_fkey(user_id, first_name, last_name, email, role)
      ),
      recent_messages:messages!messages_thread_id_fkey(
        message_id,
        thread_id,
        content,
        created_at,
        sender_id,
        receiver_id,
        sender:users!messages_sender_id_fkey(user_id, first_name, last_name, email, role),
        metadata,
        saved_forever
      )
    `
    )
    .in("thread_id", threadIds)
    .order("created_at", {
      ascending: false,
      foreignTable: "recent_messages",
    })
    .limit(1, { foreignTable: "recent_messages" })
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("❌ getThreadsForUser thread fetch error:", error);
    return [];
  }

  return (threadRows || []).map((row) =>
    formatThreadRow(row, userIdNum, membershipMap)
  );
};

const fetchThreadRecord = async (threadId) => {
  const { data, error } = await dbClient
    .from("message_threads")
    .select(
      `
      thread_id,
      thread_type,
      title,
      unique_hash,
      created_by,
      created_at,
      updated_at,
      participants:message_thread_members(
        user_id,
        role,
        joined_at,
        last_read_at,
        user:users!message_thread_members_user_id_fkey(user_id, first_name, last_name, email, role)
      ),
      recent_messages:messages!messages_thread_id_fkey(
        message_id,
        thread_id,
        content,
        created_at,
        sender_id,
        receiver_id,
        sender:users!messages_sender_id_fkey(user_id, first_name, last_name, email, role),
        metadata,
        saved_forever
      )
    `
    )
    .eq("thread_id", threadId)
    .order("created_at", {
      ascending: false,
      foreignTable: "recent_messages",
    })
    .limit(1, { foreignTable: "recent_messages" })
    .maybeSingle();

  if (error) throw error;
  return data;
};

const getThreadSnapshotForUser = async (threadId, userId) => {
  const threadIdNum = Number(threadId);
  const userIdNum = normalizeUserId(userId);
  if (!threadIdNum || !userIdNum) return null;
  const threads = await getThreadsForUser(userIdNum);
  const match = threads.find((thread) => thread.id === threadIdNum);
  if (match) return match;

  const [threadRow, membershipResult] = await Promise.all([
    fetchThreadRecord(threadIdNum),
    dbClient
      .from("message_thread_members")
      .select("thread_id, last_read_at")
      .eq("thread_id", threadIdNum)
      .eq("user_id", userIdNum)
      .maybeSingle(),
  ]);

  if (membershipResult?.error && membershipResult?.error?.code !== "PGRST116") {
    throw membershipResult.error;
  }

  const membershipData = membershipResult?.data || null;

  if (!threadRow || !membershipData) {
    return null;
  }

  const memberMeta = membershipData;

  return formatThreadRow(threadRow, userIdNum, {
    [threadIdNum]: {
      threadId: memberMeta.thread_id,
      last_read_at: memberMeta.last_read_at,
    },
  });
};

const normalizeMemberConfigs = (entries = []) => {
  const map = new Map();
  entries.forEach((entry) => {
    if (!entry) return;
    const id = Number(entry.userId ?? entry);
    if (!Number.isFinite(id)) return;
    const role = entry.role || "member";
    if (!map.has(id)) {
      map.set(id, { userId: id, role });
    }
  });
  return Array.from(map.values());
};

const addMembersToThread = async (threadId, memberConfigs = []) => {
  assertMessagingWriteAccess();
  const normalized = normalizeMemberConfigs(memberConfigs);
  if (!normalized.length) return [];

  const userIds = normalized.map((entry) => entry.userId);

  const { data: existingRows, error: existingError } = await dbClient
    .from("message_thread_members")
    .select("user_id")
    .eq("thread_id", threadId)
    .in("user_id", userIds);

  if (existingError) throw existingError;

  const existingIds = new Set((existingRows || []).map((row) => row.user_id));
  const pending = normalized
    .filter((entry) => !existingIds.has(entry.userId))
    .map((entry) => ({
      thread_id: threadId,
      user_id: entry.userId,
      role: entry.role || "member",
      joined_at: new Date().toISOString(),
    }));

  if (!pending.length) return existingRows;

  const { data, error } = await dbClient
    .from("message_thread_members")
    .insert(pending)
    .select("member_id, thread_id, user_id, joined_at, last_read_at, role");

  if (error) throw error;

  return data;
};

// Provision (or reuse) a users-table row for a customers-table record so that
// messaging FKs (messages.sender_id, message_thread_members.user_id, …) can
// reference an integer user_id. Linking is by email (users.email is UNIQUE).
//
// - If a users row already exists with the same email → return its user_id
//   (covers the case where the customer is also an employee — no duplicate).
// - Otherwise insert a new users row with role "Customer" and the
//   external-auth placeholder password_hash, mirroring the HR employees flow
//   in src/pages/api/hr/employees.js.
// - Race-safe: a unique-email collision (PG 23505) is caught and the row is
//   re-fetched so concurrent invites resolve to the same user_id.
export const ensureUserForCustomer = async (customerRow = {}) => {
  assertMessagingWriteAccess();

  const rawEmail = String(customerRow?.email || "").trim();
  if (!rawEmail) {
    throw new Error(
      "Customer is missing an email address. Add an email before inviting them to chat."
    );
  }
  const email = rawEmail.toLowerCase();

  // 1) Reuse an existing users row when email matches.
  const { data: existingUser, error: lookupError } = await dbClient
    .from("users")
    .select("user_id, role")
    .ilike("email", email)
    .maybeSingle();

  if (lookupError && lookupError.code !== "PGRST116") {
    throw lookupError;
  }
  if (existingUser?.user_id) {
    return existingUser.user_id;
  }

  // 2) Derive first/last name with safe fallbacks.
  const trimmedFirst = String(customerRow.firstname || "").trim();
  const trimmedLast = String(customerRow.lastname || "").trim();
  let firstName = trimmedFirst;
  let lastName = trimmedLast;
  if (!firstName && !lastName) {
    const combined = String(customerRow.name || "").trim();
    if (combined) {
      const parts = combined.split(/\s+/);
      firstName = parts.shift() || "";
      lastName = parts.join(" ");
    }
  }
  if (!firstName) firstName = rawEmail.split("@")[0] || "Customer";
  if (!lastName) lastName = "(Customer)";

  const phone =
    String(customerRow.mobile || "").trim() ||
    String(customerRow.telephone || "").trim() ||
    null;

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  const insertPayload = {
    first_name: firstName,
    last_name: lastName,
    name: fullName || firstName || "Customer",
    email: rawEmail,
    password_hash: "external_auth",
    role: "Customer",
    phone,
  };

  const { data: inserted, error: insertError } = await dbClient
    .from("users")
    .insert(insertPayload)
    .select("user_id")
    .single();

  if (insertError) {
    // Unique-email race: another request just provisioned the same user.
    // Re-fetch by email and reuse its user_id.
    if (insertError.code === "23505") {
      const { data: raceRow, error: raceError } = await dbClient
        .from("users")
        .select("user_id")
        .ilike("email", email)
        .maybeSingle();
      if (raceError && raceError.code !== "PGRST116") throw raceError;
      if (raceRow?.user_id) return raceRow.user_id;
    }
    throw insertError;
  }

  return inserted.user_id;
};

export const searchDirectoryUsers = async (searchTerm = "", limit = 25) => {
  const query = dbClient
    .from("users")
    .select("user_id, first_name, last_name, email, role")
    .order("first_name", { ascending: true })
    .limit(limit);

  if (searchTerm.trim()) {
    const term = searchTerm.trim();
    query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(formatUserProfile);
};

export const ensureDirectThread = async (currentUserId, targetUserId) => {
  assertMessagingWriteAccess();
  const currentId = normalizeUserId(currentUserId);
  const targetId = normalizeUserId(targetUserId);
  if (!currentId || !targetId || currentId === targetId) {
    throw new Error("Direct messages need two distinct users.");
  }

  const hash = buildDirectHash(currentId, targetId);

  const { data: existing, error: existingError } = await dbClient
    .from("message_threads")
    .select("thread_id")
    .eq("unique_hash", hash)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  const threadId = existing?.thread_id;

  if (threadId) {
    await addMembersToThread(threadId, [
      { userId: currentId },
      { userId: targetId },
    ]);
    const snapshot = await getThreadSnapshotForUser(threadId, currentId);
    if (!snapshot) {
      throw new Error("Unable to load the direct conversation.");
    }
    return snapshot;
  }

  const { data: inserted, error } = await dbClient
    .from("message_threads")
    .insert({
      thread_type: "direct",
      created_by: currentId,
      unique_hash: hash,
    })
    .select("thread_id")
    .single();

  if (error) throw error;

  await addMembersToThread(inserted.thread_id, [
    { userId: currentId },
    { userId: targetId },
  ]);

  const snapshot = await getThreadSnapshotForUser(inserted.thread_id, currentId);
  if (!snapshot) {
    throw new Error("Unable to load the direct conversation.");
  }
  return snapshot;
};

export const createGroupThread = async ({ title, memberIds = [], createdBy }) => {
  assertMessagingWriteAccess();
  const creatorId = normalizeUserId(createdBy);
  if (!creatorId) {
    throw new Error("Creator is required to make a group thread.");
  }

  const uniqueMembers = Array.from(
    new Set([creatorId, ...memberIds].map((id) => Number(id)).filter(Boolean))
  );

  if (uniqueMembers.length < 2) {
    throw new Error("Group chats need at least two members.");
  }

  const payload = {
    thread_type: "group",
    title: title?.trim() || null,
    created_by: creatorId,
  };

  const { data: inserted, error } = await dbClient
    .from("message_threads")
    .insert(payload)
    .select("thread_id")
    .single();

  if (error) throw error;

  const memberConfigs = uniqueMembers.map((userId) => ({
    userId,
    role: userId === creatorId ? "leader" : "member",
  }));

  await addMembersToThread(inserted.thread_id, memberConfigs);
  const snapshot = await getThreadSnapshotForUser(inserted.thread_id, creatorId);
  if (!snapshot) {
    throw new Error("Unable to load the new group conversation.");
  }
  return snapshot;
};

const sanitizeIds = (ids = []) =>
  Array.from(
    new Set(
      ids
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    )
  );

export const updateGroupMembers = async ({
  threadId,
  actorId,
  addUserIds = [],
  removeUserIds = [],
}) => {
  assertMessagingWriteAccess();
  const actorUserId = normalizeUserId(actorId);
  const threadIdNum = Number(threadId);
  if (!threadIdNum || !actorUserId) {
    throw new Error("threadId and actorId are required.");
  }

  const { data: threadRow, error: threadError } = await dbClient
    .from("message_threads")
    .select("thread_type")
    .eq("thread_id", threadId)
    .maybeSingle();

  if (threadError) throw threadError;
  if (!threadRow) throw new Error("Thread not found.");
  if (threadRow.thread_type !== "group") {
    throw new Error("Member management is only available for group chats.");
  }

  const { data: actorMembership, error: actorError } = await dbClient
    .from("message_thread_members")
    .select("role")
    .eq("thread_id", threadIdNum)
    .eq("user_id", actorUserId)
    .maybeSingle();

  if (actorError) throw actorError;
  if (actorMembership?.role !== "leader") {
    throw new Error("Only group leaders can manage members.");
  }

  const adds = sanitizeIds(addUserIds).filter((id) => id !== actorUserId);
  if (adds.length) {
    await addMembersToThread(
      threadIdNum,
      adds.map((userId) => ({ userId }))
    );
  }

  const removals = sanitizeIds(removeUserIds);
  if (removals.length) {
    const { data: leaderRows, error: leaderError } = await dbClient
      .from("message_thread_members")
      .select("user_id")
      .eq("thread_id", threadIdNum)
      .eq("role", "leader");

    if (leaderError) throw leaderError;

    const leaderIds = (leaderRows || []).map((row) => row.user_id);
    const remainingLeaderIds = leaderIds.filter((id) => !removals.includes(id));
    if (!remainingLeaderIds.length) {
      throw new Error("At least one group leader must remain in the chat.");
    }

    await dbClient
      .from("message_thread_members")
      .delete()
      .eq("thread_id", threadIdNum)
      .in("user_id", removals);
  }

  const snapshot = await getThreadSnapshotForUser(threadIdNum, actorUserId);
  if (!snapshot) {
    throw new Error("Unable to refresh the group conversation.");
  }
  return snapshot;
};

export const renameGroupThread = async ({ threadId, actorId, title }) => {
  assertMessagingWriteAccess();
  const threadIdNum = Number(threadId);
  const actorUserId = normalizeUserId(actorId);
  if (!threadIdNum || !actorUserId) {
    throw new Error("threadId and actorId are required.");
  }

  const { data: threadRow, error: threadError } = await dbClient
    .from("message_threads")
    .select("thread_type")
    .eq("thread_id", threadIdNum)
    .maybeSingle();

  if (threadError) throw threadError;
  if (!threadRow) throw new Error("Thread not found.");
  if (threadRow.thread_type !== "group") {
    throw new Error("Only group chats can be renamed.");
  }

  const { data: actorMembership, error: actorError } = await dbClient
    .from("message_thread_members")
    .select("role")
    .eq("thread_id", threadIdNum)
    .eq("user_id", actorUserId)
    .maybeSingle();

  if (actorError) throw actorError;
  if (actorMembership?.role !== "leader") {
    throw new Error("Only group leaders can update the chat name.");
  }

  const nextTitle = title?.trim() || null;
  const { error: updateError } = await dbClient
    .from("message_threads")
    .update({ title: nextTitle })
    .eq("thread_id", threadIdNum);

  if (updateError) throw updateError;

  const snapshot = await getThreadSnapshotForUser(threadIdNum, actorUserId);
  if (!snapshot) {
    throw new Error("Unable to refresh the group conversation.");
  }
  return snapshot;
};

export const deleteThreadCascade = async ({ threadId, actorId }) => {
  assertMessagingWriteAccess();
  const threadIdNum = Number(threadId);
  const actorUserId = normalizeUserId(actorId);
  if (!threadIdNum || !actorUserId) {
    throw new Error("threadId and actorId are required.");
  }

  const { data: membership, error: membershipError } = await dbClient
    .from("message_thread_members")
    .select("member_id")
    .eq("thread_id", threadIdNum)
    .eq("user_id", actorUserId)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) {
    throw new Error("You are not part of this conversation.");
  }

  await dbClient.from("messages").delete().eq("thread_id", threadIdNum);
  await dbClient.from("message_thread_members").delete().eq("thread_id", threadIdNum);
  const { error: threadError } = await dbClient
    .from("message_threads")
    .delete()
    .eq("thread_id", threadIdNum);

  if (threadError) throw threadError;
  return true;
};

const MESSAGE_ROW_SELECT = `
  message_id,
  thread_id,
  content,
  created_at,
  sender_id,
  receiver_id,
  metadata,
  saved_forever,
  sender:users!messages_sender_id_fkey(user_id, first_name, last_name, email, role)
`;

const hydrateConversationSenders = async (messages = []) => {
  const senderIds = Array.from(
    new Set(
      messages
        .map((message) => normalizeUserId(message.senderId))
        .filter(Boolean)
    )
  );

  if (!senderIds.length) {
    return messages.map((message) => ({ ...message, sender: message.sender || null }));
  }

  const { data: userRows, error } = await dbClient
    .from("users")
    .select("user_id, first_name, last_name, email, role")
    .in("user_id", senderIds);

  if (error) {
    console.error("❌ hydrateConversationSenders error:", error);
    return messages.map((message) => ({ ...message, sender: message.sender || null }));
  }

  const userMap = new Map((userRows || []).map((row) => [row.user_id, formatUserProfile(row)]));
  return messages.map((message) => ({
    ...message,
    sender: message.sender || userMap.get(message.senderId) || null,
  }));
};

const fetchThreadMessageRows = async (threadId) => {
  const { data, error } = await dbClient
    .from("messages")
    .select(MESSAGE_ROW_SELECT)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
};

const persistThreadConversationRows = async ({ threadId, entries, existingRows }) => {
  const payload = buildConversationRowPayload(threadId, entries);
  if (!payload) {
    throw new Error("Conversation payload is empty.");
  }

  const canonicalRow = existingRows?.[0] || null;
  let data = null;
  if (canonicalRow?.message_id) {
    const result = await dbClient
      .from("messages")
      .update(payload)
      .eq("message_id", canonicalRow.message_id)
      .select(MESSAGE_ROW_SELECT)
      .single();
    if (result.error) throw result.error;
    data = result.data;
  } else {
    const result = await dbClient
      .from("messages")
      .insert(payload)
      .select(MESSAGE_ROW_SELECT)
      .single();
    if (result.error) throw result.error;
    data = result.data;
  }

  const staleIds = (existingRows || [])
    .map((row) => row.message_id)
    .filter((id) => id && id !== data.message_id);
  if (staleIds.length) {
    await dbClient.from("messages").delete().in("message_id", staleIds);
  }

  return data;
};

export const getThreadMessages = async (threadId, userId, limit = 50, before) => {
  const threadIdNum = Number(threadId);
  const userIdNum = normalizeUserId(userId);
  if (!threadIdNum || !userIdNum) {
    throw new Error("threadId and userId are required to fetch messages.");
  }

  const { data: membership, error: membershipError } = await dbClient
    .from("message_thread_members")
    .select("member_id")
    .eq("thread_id", threadIdNum)
    .eq("user_id", userIdNum)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) {
    throw new Error("You are not a participant in this conversation.");
  }

  try {
    let rows = await fetchThreadMessageRows(threadIdNum);
    const hasConversationRow = rows.some(
      (row) => getConversationLog(row.metadata).length > 0
    );
    if (!hasConversationRow && rows.length > 1) {
      const legacyEntries = extractConversationEntriesFromRows(rows);
      await persistThreadConversationRows({
        threadId: threadIdNum,
        entries: legacyEntries,
        existingRows: rows,
      });
      rows = await fetchThreadMessageRows(threadIdNum);
    }

    const entries = extractConversationEntriesFromRows(rows);
    const hydrated = await hydrateConversationSenders(entries);

    let filtered = hydrated;
    if (before) {
      filtered = filtered.filter(
        (message) => new Date(message.createdAt).getTime() < new Date(before).getTime()
      );
    }
    if (limit > 0 && filtered.length > limit) {
      filtered = filtered.slice(filtered.length - limit);
    }

    return filtered.map((message) => ({
      id: message.id,
      threadId: message.threadId || threadIdNum,
      content: message.content,
      createdAt: message.createdAt,
      senderId: message.senderId,
      receiverId: message.receiverId,
      sender: message.sender,
      metadata: stripConversationMetadata(message.metadata),
      savedForever: Boolean(message.savedForever),
    }));
  } catch (error) {
    console.error("❌ getThreadMessages error:", error);
    return [];
  }
};

export const markThreadRead = async ({ threadId, userId }) => {
  assertMessagingWriteAccess();
  const threadIdNum = Number(threadId);
  const userIdNum = normalizeUserId(userId);
  if (!threadIdNum || !userIdNum) return null;

  const { data, error } = await dbClient
    .from("message_thread_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("thread_id", threadIdNum)
    .eq("user_id", userIdNum)
    .select("thread_id, user_id, last_read_at")
    .single();

  if (error) {
    console.error("❌ markThreadRead error:", error);
    return null;
  }

  return data;
};

export const sendThreadMessage = async ({
  threadId,
  senderId,
  content,
  receiverId = null,
  metadata = null,
}) => {
  assertMessagingWriteAccess();
  const senderUserId = normalizeUserId(senderId);
  const threadIdNum = threadId ? Number(threadId) : null;
  let resolvedReceiverId = normalizeUserId(receiverId);
  if (!senderUserId || !content?.trim()) {
    throw new Error("Message content and sender are required.");
  }

  if (!threadIdNum && !resolvedReceiverId) {
    throw new Error("Messages must belong to a thread or include a receiverId.");
  }

  if (threadIdNum) {
    const { data: membership, error } = await dbClient
      .from("message_thread_members")
      .select("member_id")
      .eq("thread_id", threadIdNum)
      .eq("user_id", senderUserId)
      .maybeSingle();

    if (error) throw error;
    if (!membership) {
      throw new Error("You are not part of this conversation.");
    }

    const { data: threadRow, error: threadError } = await dbClient
      .from("message_threads")
      .select("thread_type")
      .eq("thread_id", threadIdNum)
      .maybeSingle();

    if (threadError) throw threadError;
    if (!threadRow) {
      throw new Error("Conversation not found.");
    }

    if (threadRow.thread_type === "direct") {
      if (resolvedReceiverId && resolvedReceiverId === senderUserId) {
        throw new Error("Direct messages must target the other participant.");
      }

      if (!resolvedReceiverId) {
        const { data: otherMemberRows, error: otherMemberError } = await dbClient
          .from("message_thread_members")
          .select("user_id")
          .eq("thread_id", threadIdNum)
          .neq("user_id", senderUserId)
          .limit(1);

        if (otherMemberError) throw otherMemberError;
        const otherParticipantId = otherMemberRows?.[0]?.user_id || null;
        if (!otherParticipantId) {
          throw new Error("Direct conversation is missing the other participant.");
        }
        resolvedReceiverId = otherParticipantId;
      } else {
        const { data: receiverMembership, error: receiverMembershipError } = await dbClient
          .from("message_thread_members")
          .select("member_id")
          .eq("thread_id", threadIdNum)
          .eq("user_id", resolvedReceiverId)
          .maybeSingle();

        if (receiverMembershipError) throw receiverMembershipError;
        if (!receiverMembership) {
          throw new Error("Receiver is not part of this conversation.");
        }
      }
    } else if (resolvedReceiverId) {
      const { data: receiverMembership, error: receiverMembershipError } = await dbClient
        .from("message_thread_members")
        .select("member_id")
        .eq("thread_id", threadIdNum)
        .eq("user_id", resolvedReceiverId)
        .maybeSingle();

      if (receiverMembershipError) throw receiverMembershipError;
      if (!receiverMembership) {
        throw new Error("Receiver is not part of this conversation.");
      }
    }
    const existingRows = await fetchThreadMessageRows(threadIdNum);
    const existingEntries = extractConversationEntriesFromRows(existingRows);
    const senderProfile =
      (await hydrateConversationSenders([{ senderId: senderUserId }]))?.[0]?.sender || null;
    const newEntry = {
      id: buildConversationMessageId(threadIdNum),
      threadId: threadIdNum,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      senderId: senderUserId,
      receiverId: resolvedReceiverId,
      sender: senderProfile,
      metadata: stripConversationMetadata(metadata),
      savedForever: false,
    };

    const nextEntries = [...existingEntries, newEntry];
    const persistedRow = await persistThreadConversationRows({
      threadId: threadIdNum,
      entries: nextEntries,
      existingRows,
    });

    await dbClient
      .from("message_threads")
      .update({ updated_at: newEntry.createdAt })
      .eq("thread_id", threadIdNum);

    await markThreadRead({ threadId: threadIdNum, userId: senderUserId });

    return {
      id: newEntry.id,
      threadId: threadIdNum,
      content: newEntry.content,
      createdAt: newEntry.createdAt,
      senderId: newEntry.senderId,
      receiverId: newEntry.receiverId,
      sender: newEntry.sender || formatUserProfile(persistedRow?.sender),
      metadata: newEntry.metadata,
      savedForever: false,
    };
  }

  const payload = {
    content: content.trim(),
    sender_id: senderUserId,
    receiver_id: resolvedReceiverId,
    thread_id: null,
    metadata: stripConversationMetadata(metadata),
  };
  const { data, error } = await dbClient
    .from("messages")
    .insert(payload)
    .select(MESSAGE_ROW_SELECT)
    .single();
  if (error) throw error;
  return formatMessageRow(data);
};

export const updateThreadMessageMetadata = async ({
  threadId,
  messageId,
  metadataPatch = {},
}) => {
  assertMessagingWriteAccess();
  const threadIdNum = Number(threadId);
  const messageKey = String(messageId || "").trim();
  if (!threadIdNum || !messageKey) {
    throw new Error("threadId and messageId are required to update message metadata.");
  }

  const existingRows = await fetchThreadMessageRows(threadIdNum);
  const existingEntries = extractConversationEntriesFromRows(existingRows);
  const nextEntries = existingEntries.map((entry) => {
    if (String(entry.id) !== messageKey) {
      return entry;
    }

    return {
      ...entry,
      metadata: {
        ...(entry.metadata || {}),
        ...(metadataPatch || {}),
        leaveRequest: {
          ...(entry.metadata?.leaveRequest || {}),
          ...(metadataPatch?.leaveRequest || {}),
        },
      },
    };
  });

  await persistThreadConversationRows({
    threadId: threadIdNum,
    entries: nextEntries,
    existingRows,
  });

  return nextEntries.find((entry) => String(entry.id) === messageKey) || null;
};

export const markMessageSaved = async ({ messageId, threadId = null, saved = true }) => {
  assertMessagingWriteAccess();
  const messageKey = String(messageId || "").trim();
  if (!messageKey) {
    throw new Error("messageId is required to save a message.");
  }

  const numericMessageId = Number(messageKey);
  if (Number.isFinite(numericMessageId) && numericMessageId > 0) {
    const { data, error } = await dbClient
      .from("messages")
      .update({ saved_forever: saved })
      .eq("message_id", numericMessageId)
      .select(MESSAGE_ROW_SELECT)
      .maybeSingle();
    if (error) throw error;
    if (data) return formatMessageRow(data);
  }

  const parsedThreadId =
    normalizeUserId(threadId) ||
    normalizeUserId((messageKey.match(/^t(\d+)-m/i) || [])[1]);
  if (!parsedThreadId) {
    throw new Error("threadId is required to save this message.");
  }

  const existingRows = await fetchThreadMessageRows(parsedThreadId);
  const existingEntries = extractConversationEntriesFromRows(existingRows);
  const targetIndex = existingEntries.findIndex(
    (entry) => String(entry.id) === messageKey
  );
  if (targetIndex < 0) {
    throw new Error("Message not found in this conversation.");
  }

  const nextEntries = [...existingEntries];
  nextEntries[targetIndex] = {
    ...nextEntries[targetIndex],
    savedForever: saved !== false,
  };

  await persistThreadConversationRows({
    threadId: parsedThreadId,
    entries: nextEntries,
    existingRows,
  });

  const hydrated = await hydrateConversationSenders([nextEntries[targetIndex]]);
  return {
    id: hydrated[0].id,
    threadId: parsedThreadId,
    content: hydrated[0].content,
    createdAt: hydrated[0].createdAt,
    senderId: hydrated[0].senderId,
    receiverId: hydrated[0].receiverId,
    sender: hydrated[0].sender,
    metadata: stripConversationMetadata(hydrated[0].metadata),
    savedForever: Boolean(hydrated[0].savedForever),
  };
};
