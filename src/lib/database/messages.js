// ✅ Connected to Supabase (server-side)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/lib/database/messages.js
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

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

const buildFullName = (user) => {
  const parts = [user?.first_name, user?.last_name].filter(Boolean);
  return parts.join(" ").trim() || user?.email || `User ${user?.user_id || ""}`;
};

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

const formatMessageRow = (row) => ({
  id: row.message_id,
  threadId: row.thread_id,
  content: row.content,
  createdAt: row.created_at,
  senderId: row.sender_id,
  receiverId: row.receiver_id,
  sender: formatUserProfile(row.sender),
  metadata: row.metadata || null,
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
        user:user_id(user_id, first_name, last_name, email, role)
      ),
      recent_messages:messages!messages_thread_id_fkey(order=created_at.desc,limit=1)(
        message_id,
        thread_id,
        content,
        created_at,
        sender_id,
        receiver_id,
        sender:sender_id(user_id, first_name, last_name, email, role),
        metadata,
        saved_forever
      )
    `
    )
    .in("thread_id", threadIds)
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
        user:user_id(user_id, first_name, last_name, email, role)
      ),
      recent_messages:messages!messages_thread_id_fkey(order=created_at.desc,limit=1)(
        message_id,
        thread_id,
        content,
        created_at,
        sender_id,
        receiver_id,
        sender:sender_id(user_id, first_name, last_name, email, role),
        metadata,
        saved_forever
      )
    `
    )
    .eq("thread_id", threadId)
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

  const query = dbClient
    .from("messages")
    .select(
      `
      message_id,
      thread_id,
      content,
      created_at,
      sender_id,
      receiver_id,
      sender:sender_id(user_id, first_name, last_name, email, role)
    `
    )
    .eq("thread_id", threadIdNum)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (before) {
    query.lt("created_at", before);
  }

  const { data, error } = await query;
  if (error) {
    console.error("❌ getThreadMessages error:", error);
    return [];
  }

  return (data || []).map(formatMessageRow);
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
  if (!senderUserId || !content?.trim()) {
    throw new Error("Message content and sender are required.");
  }

  if (!threadIdNum && !receiverId) {
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
  }

    const payload = {
      content: content.trim(),
      sender_id: senderUserId,
      receiver_id: receiverId,
      thread_id: threadIdNum || null,
      metadata: metadata || null,
    };

  const { data, error } = await dbClient
    .from("messages")
    .insert(payload)
    .select(
      `
      message_id,
      thread_id,
      content,
      created_at,
      sender_id,
      receiver_id,
      sender:sender_id(user_id, first_name, last_name, email, role),
      metadata,
      saved_forever
    `
    )
    .single();

  if (error) throw error;

  if (threadIdNum) {
    await dbClient
      .from("message_threads")
      .update({ updated_at: data.created_at })
      .eq("thread_id", threadIdNum);
  }

  await markThreadRead({ threadId: threadIdNum, userId: senderUserId });

  return formatMessageRow(data);
};

export const markMessageSaved = async ({ messageId, saved = true }) => {
  assertMessagingWriteAccess();
  const msgId = Number(messageId);
  if (!msgId) {
    throw new Error("messageId is required to save a message.");
  }

  const { data, error } = await dbClient
    .from("messages")
    .update({ saved_forever: saved })
    .eq("message_id", msgId)
    .select(
      `
      message_id,
      thread_id,
      content,
      created_at,
      sender_id,
      receiver_id,
      metadata,
      saved_forever,
      sender:sender_id(user_id, first_name, last_name, email, role)
    `
    )
    .maybeSingle();

  if (error) throw error;
  return formatMessageRow(data);
};
