// file location: src/lib/database/messages.js
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbClient = serviceKey ? createClient(supabaseUrl, serviceKey) : supabase;

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
});

const DIRECT_HASH_PREFIX = "direct";

const buildDirectHash = (userA, userB) => {
  const sorted = [Number(userA), Number(userB)].sort((a, b) => a - b);
  return `${DIRECT_HASH_PREFIX}:${sorted[0]}:${sorted[1]}`;
};

const fetchThreadById = async (threadId) => {
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
      recent_messages:messages!messages_thread_id_fkey(limit=1, order=created_at.desc)(
        message_id,
        thread_id,
        content,
        created_at,
        sender_id,
        receiver_id,
        sender:sender_id(user_id, first_name, last_name, email, role)
      )
    `
    )
    .eq("thread_id", threadId)
    .maybeSingle();

  if (error) throw error;
  return data;
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

const addMembersToThread = async (threadId, memberIds = []) => {
  const numericIds = memberIds
    .map((id) => Number(id))
    .filter((value) => Number.isFinite(value));

  const uniqueIds = Array.from(new Set(numericIds));
  if (!uniqueIds.length) return [];

  const { data: existingRows, error: existingError } = await dbClient
    .from("message_thread_members")
    .select("user_id")
    .eq("thread_id", threadId)
    .in("user_id", uniqueIds);

  if (existingError) throw existingError;

  const existingIds = new Set((existingRows || []).map((row) => row.user_id));
  const pending = uniqueIds
    .filter((id) => !existingIds.has(id))
    .map((userId) => ({
      thread_id: threadId,
      user_id: userId,
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
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
    throw new Error("Direct messages need two distinct users.");
  }

  const hash = buildDirectHash(currentUserId, targetUserId);

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
    await addMembersToThread(threadId, [currentUserId, targetUserId]);
    const refreshed = await fetchThreadById(threadId);
    return formatThreadRow(refreshed, currentUserId, {
      [threadId]: { last_read_at: null },
    });
  }

  const { data: inserted, error } = await dbClient
    .from("message_threads")
    .insert({
      thread_type: "direct",
      created_by: currentUserId,
      unique_hash: hash,
    })
    .select("thread_id")
    .single();

  if (error) throw error;

  await addMembersToThread(inserted.thread_id, [currentUserId, targetUserId]);

  const refreshed = await fetchThreadById(inserted.thread_id);
  return formatThreadRow(refreshed, currentUserId, {
    [inserted.thread_id]: { last_read_at: null },
  });
};

export const createGroupThread = async ({ title, memberIds = [], createdBy }) => {
  if (!createdBy) {
    throw new Error("Creator is required to make a group thread.");
  }

  const uniqueMembers = Array.from(
    new Set([createdBy, ...memberIds].map((id) => Number(id)).filter(Boolean))
  );

  if (uniqueMembers.length < 2) {
    throw new Error("Group chats need at least two members.");
  }

  const payload = {
    thread_type: "group",
    title: title?.trim() || null,
    created_by: createdBy,
  };

  const { data: inserted, error } = await dbClient
    .from("message_threads")
    .insert(payload)
    .select("thread_id")
    .single();

  if (error) throw error;

  await addMembersToThread(inserted.thread_id, uniqueMembers);
  const refreshed = await fetchThreadById(inserted.thread_id);
  return formatThreadRow(refreshed, createdBy, {
    [inserted.thread_id]: { last_read_at: null },
  });
};

export const getThreadsForUser = async (userId) => {
  if (!userId) return [];

  const { data: membershipRows, error: membershipError } = await dbClient
    .from("message_thread_members")
    .select("thread_id, last_read_at")
    .eq("user_id", userId);

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
      recent_messages:messages!messages_thread_id_fkey(limit=1, order=created_at.desc)(
        message_id,
        thread_id,
        content,
        created_at,
        sender_id,
        receiver_id,
        sender:sender_id(user_id, first_name, last_name, email, role)
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
    formatThreadRow(row, userId, membershipMap)
  );
};

export const getThreadMessages = async (threadId, limit = 50, before) => {
  if (!threadId) return [];

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
    .eq("thread_id", threadId)
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
  if (!threadId || !userId) return null;

  const { data, error } = await dbClient
    .from("message_thread_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("user_id", userId)
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
}) => {
  if (!senderId || !content?.trim()) {
    throw new Error("Message content and sender are required.");
  }

  const payload = {
    content: content.trim(),
    sender_id: senderId,
    receiver_id: receiverId,
    thread_id: threadId || null,
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
      sender:sender_id(user_id, first_name, last_name, email, role)
    `
    )
    .single();

  if (error) throw error;

  if (threadId) {
    await dbClient
      .from("message_threads")
      .update({ updated_at: data.created_at })
      .eq("thread_id", threadId);
  }

  await markThreadRead({ threadId, userId: senderId });

  return formatMessageRow(data);
};
