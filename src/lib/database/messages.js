// ✅ Connected to Supabase (server-side)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/lib/database/messages.js
import { supabase, supabaseService } from "@/lib/database/supabaseClient";
import { getDisplayName } from "@/lib/users/displayName";
import { ALL_ACCESS_EMAIL } from "@/lib/database/allAccessVisibility";
import { logFailure } from "@/lib/utils/logFailure";
import {
  NOTIFICATION_LEVEL_VALUES,
  PRIORITY_VALUES,
  STATUS_VALUES,
  deriveConversationType,
  departmentFromHash,
  extractMentionIds,
  jobNumberFromHash,
  sanitizeLinks,
  linkKey,
  typeSupportsWorkflow,
} from "@/lib/messages/conversationModel";

const dbClient = supabaseService || supabase;

// ---------------------------------------------------------------------------
// Conversation-hub columns (supabase/migrations/20260924120000_messages_
// conversation_hub.sql). Until that migration runs, every thread query falls
// back to the legacy column set, so messaging keeps working and only the hub
// settings (status, priority, links, owner, notification level) are missing.
// A failed probe is retried every few minutes, so running the migration takes
// effect without a server restart.
// ---------------------------------------------------------------------------
const HUB_THREAD_COLUMNS =
  "conversation_type, status, priority, department, job_number, assigned_to, linked_records,";
const HUB_RETRY_MS = 5 * 60 * 1000;
let hubColumnsReady = null; // null = not probed yet
let hubColumnsCheckedAt = 0;

const isMissingColumnError = (error) =>
  Boolean(error) &&
  (error.code === "42703" ||
    error.code === "PGRST204" ||
    /column .* does not exist|could not find the .* column/i.test(String(error.message || "")));

const shouldTryHubColumns = () =>
  hubColumnsReady !== false || Date.now() - hubColumnsCheckedAt > HUB_RETRY_MS;

// Runs `run(withHub)` against the hub column set, and once more against the
// legacy set when the hub columns do not exist yet.
const withHubFallback = async (run) => {
  if (shouldTryHubColumns()) {
    const result = await run(true);
    if (!result.error) {
      hubColumnsReady = true;
      return result;
    }
    if (!isMissingColumnError(result.error)) return result;
    hubColumnsReady = false;
    hubColumnsCheckedAt = Date.now();
  }
  return run(false);
};

export const isConversationHubReady = async () => {
  if (hubColumnsReady === null || (hubColumnsReady === false && shouldTryHubColumns())) {
    await withHubFallback((withHub) =>
      dbClient
        .from("message_threads")
        .select(withHub ? "thread_id, conversation_type" : "thread_id")
        .limit(1)
    );
  }
  return hubColumnsReady === true;
};

const HUB_MIGRATION_MESSAGE =
  "Conversation settings need the messages conversation-hub migration (20260924120000_messages_conversation_hub.sql) to be run in Supabase.";

const assertHubReady = async () => {
  if (!(await isConversationHubReady())) {
    const error = new Error(HUB_MIGRATION_MESSAGE);
    error.statusCode = 409;
    error.code = "MIGRATION_PENDING";
    throw error;
  }
};

const buildThreadSelect = (withHub) => `
      thread_id,
      thread_type,
      title,
      unique_hash,
      created_by,
      created_at,
      updated_at,
      ${withHub ? HUB_THREAD_COLUMNS : ""}
      participants:message_thread_members(
        user_id,
        role,
        joined_at,
        last_read_at,
        ${withHub ? "notification_level," : ""}
        user:users!message_thread_members_user_id_fkey(user_id, first_name, last_name, email, role, extension, job_title, department)
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
    `;
const isServiceClient = Boolean(supabaseService);

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
    extension: user.extension || "",
    jobTitle: user.job_title || "",
    department: user.department || "",
    name: buildFullName(user),
  };
};

const formatMemberRow = (row) => ({
  userId: row.user_id,
  role: row.role,
  joinedAt: row.joined_at,
  lastReadAt: row.last_read_at,
  notificationLevel: row.notification_level || "all",
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
    // An entry that carries its own `metadata` key (every _conversation log
    // entry does, even when it is null) keeps it. Only a legacy row without
    // one falls back — otherwise a plain message would inherit the conversation
    // row's metadata, which is the LATEST message's (a task, a pin, a leave
    // request), and every earlier message would render as that card.
    metadata: stripConversationMetadata(
      Object.prototype.hasOwnProperty.call(entry, "metadata")
        ? entry.metadata
        : fallback.metadata ?? null
    ),
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
  const notificationLevel = memberMeta?.notification_level || "all";
  const hasNewMessages =
    Boolean(lastMessage) &&
    (!lastReadAt || new Date(lastMessage.createdAt) > new Date(lastReadAt));

  // The whole transcript already rides along on the latest row (the
  // _conversation log), so unread and mention counts cost no extra query.
  const readCutoff = lastReadAt ? new Date(lastReadAt).getTime() : 0;
  const unreadEntries = getConversationLog(row.recent_messages?.[0]?.metadata).filter(
    (entry) =>
      normalizeUserId(entry?.senderId) !== currentUserId &&
      new Date(entry?.createdAt || 0).getTime() > readCutoff
  );
  const unreadMentionCount = unreadEntries.filter((entry) =>
    (entry?.metadata?.mentions || []).map(Number).includes(currentUserId)
  ).length;
  const unreadCount = hasNewMessages ? Math.max(unreadEntries.length, 1) : 0;

  // The member's notification level decides what counts as "unread" here —
  // a muted chat never flags, a mentions-only chat flags only for a mention.
  const hasUnread =
    notificationLevel === "none"
      ? false
      : notificationLevel === "mentions"
        ? hasNewMessages && unreadMentionCount > 0
        : hasNewMessages;

  const conversationType = deriveConversationType({
    conversationType: row.conversation_type,
    members,
    uniqueHash: row.unique_hash,
  });
  const hashDepartment = departmentFromHash(row.unique_hash);

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

  const assignee = row.assigned_to
    ? members.find((member) => member.userId === row.assigned_to) || null
    : null;

  return {
    id: row.thread_id,
    type: row.thread_type,
    conversationType,
    title: title || "Group chat",
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    members,
    lastMessage,
    hasUnread,
    hasNewMessages,
    unreadCount: hasUnread ? unreadCount : 0,
    unreadMentionCount,
    notificationLevel,
    lastReadAt,
    // Workflow fields. `hubReady` is false until the migration runs, so the UI
    // can tell "not set" apart from "cannot be stored yet".
    hubReady: row.status !== undefined,
    status: row.status || "open",
    priority: row.priority || "normal",
    department: row.department || hashDepartment || null,
    jobNumber: row.job_number || jobNumberFromHash(row.unique_hash),
    assignedTo: row.assigned_to || null,
    assigneeName: assignee?.profile?.name || null,
    linkedRecords: Array.isArray(row.linked_records) ? row.linked_records : [],
  };
};

const getMembershipMap = (rows = []) =>
  rows.reduce((acc, row) => {
    acc[row.thread_id] = {
      threadId: row.thread_id,
      last_read_at: row.last_read_at,
      notification_level: row.notification_level || "all",
    };
    return acc;
  }, {});

const fetchMembershipRows = async (userIdNum, threadIdNum = null) => {
  const result = await withHubFallback((withHub) => {
    let query = dbClient
      .from("message_thread_members")
      .select(withHub ? "thread_id, last_read_at, notification_level" : "thread_id, last_read_at")
      .eq("user_id", userIdNum);
    if (threadIdNum) query = query.eq("thread_id", threadIdNum);
    return query;
  });
  return result;
};

export const getThreadsForUser = async (userId) => {
  const userIdNum = normalizeUserId(userId);
  if (!userIdNum) return [];

  const { data: membershipRows, error: membershipError } = await fetchMembershipRows(userIdNum);

  if (membershipError) {
    logFailure("❌ getThreadsForUser membership error:", membershipError);
    return [];
  }

  if (!membershipRows?.length) return [];

  const threadIds = membershipRows.map((row) => row.thread_id);
  const membershipMap = getMembershipMap(membershipRows);

  const { data: threadRows, error } = await withHubFallback((withHub) =>
    dbClient
      .from("message_threads")
      .select(buildThreadSelect(withHub))
      .in("thread_id", threadIds)
      .order("created_at", {
        ascending: false,
        foreignTable: "recent_messages",
      })
      .limit(1, { foreignTable: "recent_messages" })
      .order("updated_at", { ascending: false })
  );

  if (error) {
    logFailure("❌ getThreadsForUser thread fetch error:", error);
    return [];
  }

  return (threadRows || []).map((row) =>
    formatThreadRow(row, userIdNum, membershipMap)
  );
};

// Unread-thread COUNT only — the cheap path behind the sidebar's message badge.
//
// getThreadsForUser (above) returns every thread with all participants, each
// participant joined to `users`, plus the latest message and its sender — and
// the badge then reduced all of that to a single integer. This helper applies
// the identical `hasUnread` rule (latest message exists AND is newer than the
// caller's last_read_at) while selecting exactly one column from one foreign
// table, so the badge no longer pulls message bodies or user records.
export const getUnreadThreadCountForUser = async (userId) => {
  const userIdNum = normalizeUserId(userId);
  if (!userIdNum) return 0;

  const { data: membershipRows, error: membershipError } = await fetchMembershipRows(userIdNum);

  if (membershipError) {
    logFailure("❌ getUnreadThreadCountForUser membership error:", membershipError);
    return 0;
  }
  if (!membershipRows?.length) return 0;

  // Muted conversations never count towards the badge. (Mentions-only chats
  // still count here: telling them apart would mean pulling every transcript,
  // which is exactly what this cheap path exists to avoid.)
  const lastReadByThread = new Map(
    membershipRows
      .filter((row) => row.notification_level !== "none")
      .map((row) => [row.thread_id, row.last_read_at || null])
  );
  if (!lastReadByThread.size) return 0;

  const { data: threadRows, error } = await dbClient
    .from("message_threads")
    .select("thread_id, recent_messages:messages!messages_thread_id_fkey(created_at)")
    .in("thread_id", Array.from(lastReadByThread.keys()))
    .order("created_at", { ascending: false, foreignTable: "recent_messages" })
    .limit(1, { foreignTable: "recent_messages" });

  if (error) {
    logFailure("❌ getUnreadThreadCountForUser thread fetch error:", error);
    return 0;
  }

  return (threadRows || []).reduce((count, row) => {
    const latestCreatedAt = row.recent_messages?.[0]?.created_at || null;
    if (!latestCreatedAt) return count;
    const lastReadAt = lastReadByThread.get(row.thread_id) || null;
    const unread = !lastReadAt || new Date(latestCreatedAt) > new Date(lastReadAt);
    return unread ? count + 1 : count;
  }, 0);
};

const fetchThreadRecord = async (threadId) => {
  const { data, error } = await withHubFallback((withHub) =>
    dbClient
      .from("message_threads")
      .select(buildThreadSelect(withHub))
      .eq("thread_id", threadId)
      .order("created_at", {
        ascending: false,
        foreignTable: "recent_messages",
      })
      .limit(1, { foreignTable: "recent_messages" })
      .maybeSingle()
  );

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
    fetchMembershipRows(userIdNum, threadIdNum),
  ]);

  if (membershipResult?.error && membershipResult?.error?.code !== "PGRST116") {
    throw membershipResult.error;
  }

  const membershipData = membershipResult?.data?.[0] || null;

  if (!threadRow || !membershipData) {
    return null;
  }

  return formatThreadRow(threadRow, userIdNum, getMembershipMap([membershipData]));
};

// Throws unless `userId` belongs to the thread. Returns the member row.
export const assertThreadMember = async (threadId, userId) => {
  const threadIdNum = Number(threadId);
  const userIdNum = normalizeUserId(userId);
  if (!threadIdNum || !userIdNum) {
    const error = new Error("threadId and userId are required.");
    error.statusCode = 400;
    throw error;
  }
  const { data, error } = await dbClient
    .from("message_thread_members")
    .select("member_id, role")
    .eq("thread_id", threadIdNum)
    .eq("user_id", userIdNum)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const denied = new Error("You are not part of this conversation.");
    denied.statusCode = 403;
    throw denied;
  }
  return data;
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

  const fetchExistingMembers = async () => {
    const { data, error } = await dbClient
      .from("message_thread_members")
      .select("member_id, thread_id, user_id, joined_at, last_read_at, role")
      .eq("thread_id", threadId)
      .in("user_id", userIds);

    if (error) throw error;
    return data || [];
  };

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

  if (error) {
    const duplicateMembership =
      error.code === "23505" ||
      String(error.message || "").includes("message_thread_members_unique");
    if (duplicateMembership) {
      return fetchExistingMembers();
    }
    throw error;
  }

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

  // No password set: the customer must use the password-reset flow before
  // they can log in. password_algo='unset' makes verifyPassword refuse.
  const insertPayload = {
    first_name: firstName,
    last_name: lastName,
    name: fullName || firstName || "Customer",
    email: rawEmail,
    password_hash: "",
    password_algo: "unset",
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

// Resolve the contact summary shown in the messages thread header for a
// customer chat: name, phone, most-recent vehicle, and most-recent job number.
// The customer thread member exposes the linked email (users row provisioned
// from the customers row), so we look the customer up by email.
export const getCustomerMessageDetail = async (email) => {
  const cleaned = String(email || "").trim();
  if (!cleaned) return null;

  const { data: customer, error: customerError } = await dbClient
    .from("customers")
    .select("id, firstname, lastname, name, email, mobile, telephone")
    .ilike("email", cleaned)
    .maybeSingle();
  if (customerError && customerError.code !== "PGRST116") throw customerError;
  if (!customer?.id) return null;

  const name =
    String(customer.name || "").trim() ||
    [customer.firstname, customer.lastname].filter(Boolean).join(" ").trim() ||
    cleaned;
  const phone =
    String(customer.mobile || "").trim() ||
    String(customer.telephone || "").trim() ||
    "";

  // Most recent vehicle linked to this customer.
  const { data: vehicleRows } = await dbClient
    .from("vehicles")
    .select("reg_number, make, model, created_at")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const vehicleRow = vehicleRows?.[0] || null;
  const vehicle = vehicleRow
    ? [
        String(vehicleRow.reg_number || "").trim(),
        [vehicleRow.make, vehicleRow.model].filter(Boolean).join(" ").trim(),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  // Most recent job number for this customer.
  const { data: jobRows } = await dbClient
    .from("jobs")
    .select("job_number, created_at")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const jobNumber = String(jobRows?.[0]?.job_number || "").trim();

  return { name, phone, vehicle, jobNumber };
};

const buildJobCustomerThreadHash = (jobNumber) => {
  const trimmed = String(jobNumber || "").trim();
  return trimmed ? `job:${trimmed}` : null;
};

const buildCustomerDisplayName = (customerRow = {}) => {
  const combined = [customerRow.firstname, customerRow.lastname].filter(Boolean).join(" ").trim();
  return combined || customerRow.name || customerRow.email || "Customer";
};

const resolveJobCustomer = async ({
  jobId = null,
  jobNumber = "",
  customerEmail = "",
  customerName = "",
} = {}) => {
  let resolvedJobNumber = String(jobNumber || "").trim();
  let customerId = null;
  let jobCustomerName = String(customerName || "").trim();

  let jobQuery = dbClient
    .from("jobs")
    .select("id, job_number, customer, customer_id")
    .limit(1);

  const numericJobId = normalizeUserId(jobId);
  if (numericJobId) {
    jobQuery = jobQuery.eq("id", numericJobId);
  } else if (resolvedJobNumber) {
    jobQuery = jobQuery.eq("job_number", resolvedJobNumber);
  } else {
    throw new Error("Job number is required to create a customer conversation.");
  }

  const { data: jobRows, error: jobError } = await jobQuery;
  if (jobError) throw jobError;

  const jobRow = jobRows?.[0] || null;
  if (jobRow) {
    resolvedJobNumber = resolvedJobNumber || jobRow.job_number || "";
    customerId = jobRow.customer_id || null;
    jobCustomerName = jobCustomerName || jobRow.customer || "";
  }

  let customerRow = null;
  if (customerId) {
    const { data, error } = await dbClient
      .from("customers")
      .select("id, firstname, lastname, email, mobile, telephone, name")
      .eq("id", customerId)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    customerRow = data || null;
  }

  const fallbackEmail = String(customerEmail || "").trim();
  if (!customerRow && fallbackEmail) {
    const { data, error } = await dbClient
      .from("customers")
      .select("id, firstname, lastname, email, mobile, telephone, name")
      .ilike("email", fallbackEmail.toLowerCase())
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    customerRow = data || null;
  }

  if (!customerRow) {
    customerRow = {
      id: customerId,
      name: jobCustomerName || fallbackEmail || "Customer",
      email: fallbackEmail,
      firstname: "",
      lastname: "",
      mobile: null,
      telephone: null,
    };
  }

  return {
    jobNumber: resolvedJobNumber,
    customer: customerRow,
  };
};

export const ensureJobCustomerThread = async ({
  jobId = null,
  jobNumber = "",
  actorId,
  customerEmail = "",
  customerName = "",
} = {}) => {
  assertMessagingWriteAccess();
  const actorUserId = normalizeUserId(actorId);
  if (!actorUserId) {
    throw new Error("A signed-in staff user is required to message the customer.");
  }

  const { jobNumber: resolvedJobNumber, customer } = await resolveJobCustomer({
    jobId,
    jobNumber,
    customerEmail,
    customerName,
  });
  const hash = buildJobCustomerThreadHash(resolvedJobNumber);
  if (!hash) {
    throw new Error("Job number is required to create a customer conversation.");
  }

  const customerUserId = await ensureUserForCustomer(customer);
  const customerLabel = buildCustomerDisplayName(customer);
  const title = `Job #${resolvedJobNumber} · ${customerLabel}`;

  const { data: existing, error: existingError } = await dbClient
    .from("message_threads")
    .select("thread_id")
    .eq("unique_hash", hash)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  let threadId = existing?.thread_id || null;
  if (!threadId) {
    const { data: inserted, error: insertError } = await dbClient
      .from("message_threads")
      .insert({
        thread_type: "group",
        title,
        unique_hash: hash,
        created_by: actorUserId,
      })
      .select("thread_id")
      .single();

    if (insertError) {
      if (insertError.code !== "23505") throw insertError;
      const { data: raceRow, error: raceError } = await dbClient
        .from("message_threads")
        .select("thread_id")
        .eq("unique_hash", hash)
        .maybeSingle();
      if (raceError && raceError.code !== "PGRST116") throw raceError;
      threadId = raceRow?.thread_id || null;
    } else {
      threadId = inserted.thread_id;
    }
  }

  if (!threadId) {
    throw new Error("Unable to create the job customer conversation.");
  }

  await addMembersToThread(threadId, [
    { userId: actorUserId, role: "leader" },
    { userId: customerUserId, role: "customer" },
  ]);

  const snapshot = await getThreadSnapshotForUser(threadId, actorUserId);
  if (!snapshot) {
    throw new Error("Unable to load the job customer conversation.");
  }

  return {
    thread: snapshot,
    customer: {
      id: customer.id || null,
      name: customerLabel,
      email: customer.email || "",
      userId: customerUserId,
    },
  };
};

export const searchDirectoryUsers = async (searchTerm = "", limit = 25) => {
  const query = dbClient
    .from("users")
    .select("user_id, first_name, last_name, email, role")
    .neq("email", ALL_ACCESS_EMAIL) // the demo account is invisible to everyone else
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

// Department, job and announcement conversations.
//
//   department   one standing chat per department (unique_hash department:<name>).
//                Creating it again just joins the creator and the picked people.
//                `includeDepartment` adds every active user whose users.department
//                matches.
//   job          one internal chat per job card (unique_hash jobteam:<number>).
//                The job must exist.
//   announcement a broadcast channel; the creator leads, only leaders post.
//
// The hash doubles as the type marker for databases where the conversation-hub
// migration has not run yet (see deriveConversationType).
export const createConversationThread = async ({
  type,
  title = "",
  memberIds = [],
  createdBy,
  department = "",
  jobNumber = "",
  includeDepartment = false,
  priority = "normal",
}) => {
  assertMessagingWriteAccess();
  const creatorId = normalizeUserId(createdBy);
  if (!creatorId) throw new Error("Creator is required to start a conversation.");

  let uniqueHash = null;
  let resolvedTitle = String(title || "").trim() || null;
  let resolvedDepartment = null;
  let resolvedJobNumber = null;
  const extraMemberIds = [];

  if (type === "department") {
    resolvedDepartment = String(department || "").trim();
    if (!resolvedDepartment) throw new Error("Choose the department this chat is for.");
    uniqueHash = `department:${resolvedDepartment.toLowerCase()}`;
    resolvedTitle = resolvedTitle || `${resolvedDepartment} team`;
    if (includeDepartment) {
      const { data: deptUsers, error: deptError } = await dbClient
        .from("users")
        .select("user_id")
        .eq("is_active", true)
        .ilike("department", resolvedDepartment)
        .neq("email", ALL_ACCESS_EMAIL);
      if (deptError) throw deptError;
      (deptUsers || []).forEach((row) => extraMemberIds.push(row.user_id));
    }
  } else if (type === "job") {
    resolvedJobNumber = String(jobNumber || "").trim().replace(/^#/, "");
    if (!resolvedJobNumber) throw new Error("Enter the job number this chat is about.");
    const { data: jobRow, error: jobError } = await dbClient
      .from("jobs")
      .select("job_number, vehicle_reg, customer")
      .eq("job_number", resolvedJobNumber)
      .maybeSingle();
    if (jobError && jobError.code !== "PGRST116") throw jobError;
    if (!jobRow) throw new Error(`Job ${resolvedJobNumber} was not found.`);
    uniqueHash = `jobteam:${resolvedJobNumber}`;
    resolvedTitle =
      resolvedTitle ||
      [`Job ${resolvedJobNumber}`, jobRow.vehicle_reg, jobRow.customer].filter(Boolean).join(" · ");
  } else if (type === "announcement") {
    if (!resolvedTitle) throw new Error("Give the announcement channel a name.");
    uniqueHash = `announcement:${creatorId}:${Date.now()}`;
    if (department) {
      resolvedDepartment = String(department).trim();
      if (includeDepartment) {
        const { data: deptUsers, error: deptError } = await dbClient
          .from("users")
          .select("user_id")
          .eq("is_active", true)
          .ilike("department", resolvedDepartment)
          .neq("email", ALL_ACCESS_EMAIL);
        if (deptError) throw deptError;
        (deptUsers || []).forEach((row) => extraMemberIds.push(row.user_id));
      }
    }
  } else {
    return createGroupThread({ title, memberIds, createdBy });
  }

  const wantedMembers = sanitizeIds([...memberIds, ...extraMemberIds]).filter(
    (id) => id !== creatorId
  );
  if (type === "announcement" && !wantedMembers.length) {
    throw new Error("Add at least one person (or a whole department) to the announcement channel.");
  }

  const { data: existing, error: existingError } = await dbClient
    .from("message_threads")
    .select("thread_id")
    .eq("unique_hash", uniqueHash)
    .maybeSingle();
  if (existingError && existingError.code !== "PGRST116") throw existingError;

  let threadId = existing?.thread_id || null;
  let isNew = false;
  if (!threadId) {
    const basePayload = {
      thread_type: "group",
      title: resolvedTitle,
      unique_hash: uniqueHash,
      created_by: creatorId,
    };
    const hubPayload = {
      ...basePayload,
      conversation_type: type,
      department: resolvedDepartment,
      job_number: resolvedJobNumber,
      priority: PRIORITY_VALUES.includes(priority) ? priority : "normal",
      linked_records: resolvedJobNumber
        ? sanitizeLinks([{ recordType: "job_card", recordId: resolvedJobNumber, label: `Job ${resolvedJobNumber}` }])
        : [],
    };
    const { data: inserted, error: insertError } = await withHubFallback((withHub) =>
      dbClient
        .from("message_threads")
        .insert(withHub ? hubPayload : basePayload)
        .select("thread_id")
        .single()
    );
    if (insertError) {
      if (insertError.code !== "23505") throw insertError;
      const { data: raceRow } = await dbClient
        .from("message_threads")
        .select("thread_id")
        .eq("unique_hash", uniqueHash)
        .maybeSingle();
      threadId = raceRow?.thread_id || null;
    } else {
      threadId = inserted.thread_id;
      isNew = true;
    }
  }
  if (!threadId) throw new Error("Unable to create the conversation.");

  await addMembersToThread(threadId, [
    // The creator of a new channel leads it; joining an existing standing
    // department/job chat makes you an ordinary member.
    { userId: creatorId, role: isNew ? "leader" : "member" },
    ...wantedMembers.map((userId) => ({ userId, role: "member" })),
  ]);

  const snapshot = await getThreadSnapshotForUser(threadId, creatorId);
  if (!snapshot) throw new Error("Unable to load the new conversation.");
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
    logFailure("❌ hydrateConversationSenders error:", error);
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
    logFailure("❌ getThreadMessages error:", error);
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
    logFailure("❌ markThreadRead error:", error);
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
      .select("member_id, role")
      .eq("thread_id", threadIdNum)
      .eq("user_id", senderUserId)
      .maybeSingle();

    if (error) throw error;
    if (!membership) {
      throw new Error("You are not part of this conversation.");
    }

    const { data: threadRow, error: threadError } = await withHubFallback((withHub) =>
      dbClient
        .from("message_threads")
        .select(withHub ? "thread_type, unique_hash, conversation_type" : "thread_type, unique_hash")
        .eq("thread_id", threadIdNum)
        .maybeSingle()
    );

    if (threadError) throw threadError;
    if (!threadRow) {
      throw new Error("Conversation not found.");
    }

    const conversationType = deriveConversationType({
      conversationType: threadRow.conversation_type,
      uniqueHash: threadRow.unique_hash,
    });
    if (conversationType === "announcement" && membership.role !== "leader") {
      const denied = new Error("Only channel leaders can post in an announcement channel.");
      denied.statusCode = 403;
      throw denied;
    }

    // Mentions are only honoured for people who are in the conversation — a
    // hand-typed token for anyone else is left as plain text.
    const mentionIds = extractMentionIds(content);
    if (mentionIds.length) {
      const { data: memberRows } = await dbClient
        .from("message_thread_members")
        .select("user_id")
        .eq("thread_id", threadIdNum)
        .in("user_id", mentionIds);
      const valid = (memberRows || []).map((row) => row.user_id);
      metadata = { ...(metadata || {}), mentions: valid };
      if (!valid.length) delete metadata.mentions;
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

    const nextMetadata = {
      ...(entry.metadata || {}),
      ...(metadataPatch || {}),
    };
    // leaveRequest is deep-merged, and only when the patch carries one —
    // otherwise an unrelated patch would stamp an empty leaveRequest on the
    // message and it would start rendering as a leave request.
    if (metadataPatch?.leaveRequest) {
      nextMetadata.leaveRequest = {
        ...(entry.metadata?.leaveRequest || {}),
        ...metadataPatch.leaveRequest,
      };
    }
    return { ...entry, metadata: nextMetadata };
  });

  await persistThreadConversationRows({
    threadId: threadIdNum,
    entries: nextEntries,
    existingRows,
  });

  return nextEntries.find((entry) => String(entry.id) === messageKey) || null;
};

// ---------------------------------------------------------------------------
// Message actions: pin, tasks, reminders, edit, delete.
//
// Messages live in the thread's _conversation log, so every action is a
// read-modify-write of that one row.
// ---------------------------------------------------------------------------
const MESSAGE_ACTIONS = [
  "pin",
  "unpin",
  "task-done",
  "task-reopen",
  "reminder-done",
  "reminder-reopen",
  "edit",
  "delete",
];

export const applyMessageAction = async ({ threadId, actorId, messageId, action, content = "" }) => {
  assertMessagingWriteAccess();
  if (!MESSAGE_ACTIONS.includes(action)) {
    const error = new Error("Unknown message action.");
    error.statusCode = 400;
    throw error;
  }
  const threadIdNum = Number(threadId);
  const actorUserId = normalizeUserId(actorId);
  const messageKey = String(messageId || "").trim();
  await assertThreadMember(threadIdNum, actorUserId);

  const existingRows = await fetchThreadMessageRows(threadIdNum);
  const entries = extractConversationEntriesFromRows(existingRows);
  const index = entries.findIndex((entry) => String(entry.id) === messageKey);
  if (index < 0) {
    const error = new Error("Message not found in this conversation.");
    error.statusCode = 404;
    throw error;
  }

  const entry = entries[index];
  const metadata = { ...(entry.metadata || {}) };
  const isOwn = normalizeUserId(entry.senderId) === actorUserId;
  const [actor] = await hydrateConversationSenders([{ senderId: actorUserId }]);
  const stamp = { byId: actorUserId, byName: actor?.sender?.name || "", at: new Date().toISOString() };
  let nextContent = entry.content;

  const requireOwn = () => {
    if (!isOwn) {
      const error = new Error("You can only change your own messages.");
      error.statusCode = 403;
      throw error;
    }
  };

  switch (action) {
    case "pin":
      metadata.pinned = stamp;
      break;
    case "unpin":
      delete metadata.pinned;
      break;
    case "task-done":
    case "task-reopen":
      if (!metadata.task) throw new Error("That message is not a task.");
      metadata.task = {
        ...metadata.task,
        status: action === "task-done" ? "done" : "open",
        completedBy: action === "task-done" ? stamp : null,
      };
      break;
    case "reminder-done":
    case "reminder-reopen":
      if (!metadata.reminder) throw new Error("That message is not a reminder.");
      metadata.reminder = {
        ...metadata.reminder,
        status: action === "reminder-done" ? "done" : "open",
        completedBy: action === "reminder-done" ? stamp : null,
      };
      break;
    case "edit": {
      requireOwn();
      const trimmed = String(content || "").trim();
      if (!trimmed) throw new Error("A message cannot be empty.");
      if (metadata.deleted) throw new Error("A deleted message cannot be edited.");
      nextContent = trimmed.slice(0, 5000);
      metadata.editedAt = stamp.at;
      break;
    }
    case "delete":
      requireOwn();
      // The entry stays so replies and reactions keep their anchor; its
      // content, attachments and action cards go.
      nextContent = "This message was deleted.";
      delete metadata.attachments;
      delete metadata.task;
      delete metadata.reminder;
      delete metadata.pinned;
      metadata.deleted = { at: stamp.at };
      break;
    default:
      break;
  }

  const nextEntries = [...entries];
  nextEntries[index] = { ...entry, content: nextContent, metadata };
  await persistThreadConversationRows({ threadId: threadIdNum, entries: nextEntries, existingRows });

  const [hydrated] = await hydrateConversationSenders([nextEntries[index]]);
  return {
    id: hydrated.id,
    threadId: threadIdNum,
    content: hydrated.content,
    createdAt: hydrated.createdAt,
    senderId: hydrated.senderId,
    receiverId: hydrated.receiverId,
    sender: hydrated.sender,
    metadata: stripConversationMetadata(hydrated.metadata),
    savedForever: Boolean(hydrated.savedForever),
  };
};

// ---------------------------------------------------------------------------
// Conversation settings: status, priority, owner and linked DMS records.
// Any member may change these — they describe the work, not the membership.
// Status/priority only apply to work conversations (customer, job, department).
// ---------------------------------------------------------------------------
export const updateThreadSettings = async ({
  threadId,
  actorId,
  status,
  priority,
  assignedTo,
  addLinks = [],
  removeLinks = [],
}) => {
  assertMessagingWriteAccess();
  await assertHubReady();
  const threadIdNum = Number(threadId);
  const actorUserId = normalizeUserId(actorId);
  await assertThreadMember(threadIdNum, actorUserId);

  const current = await fetchThreadRecord(threadIdNum);
  if (!current) {
    const error = new Error("Conversation not found.");
    error.statusCode = 404;
    throw error;
  }
  const members = (current.participants || []).map(formatMemberRow);
  const conversationType = deriveConversationType({
    conversationType: current.conversation_type,
    members,
    uniqueHash: current.unique_hash,
  });

  const patch = {};
  if (status !== undefined || priority !== undefined) {
    if (!typeSupportsWorkflow(conversationType)) {
      const error = new Error("Status and priority apply to customer, job and department conversations.");
      error.statusCode = 400;
      throw error;
    }
  }
  if (status !== undefined) {
    if (!STATUS_VALUES.includes(status)) throw new Error("Unknown status.");
    patch.status = status;
  }
  if (priority !== undefined) {
    if (!PRIORITY_VALUES.includes(priority)) throw new Error("Unknown priority.");
    patch.priority = priority;
  }
  if (assignedTo !== undefined) {
    const assigneeId = assignedTo === null ? null : normalizeUserId(assignedTo);
    if (assigneeId && !members.some((member) => member.userId === assigneeId)) {
      throw new Error("The owner must be a member of this conversation.");
    }
    patch.assigned_to = assigneeId;
  }
  if (addLinks.length || removeLinks.length) {
    const removeKeys = new Set(sanitizeLinks(removeLinks).map(linkKey));
    const kept = sanitizeLinks(current.linked_records || []).filter(
      (link) => !removeKeys.has(linkKey(link))
    );
    patch.linked_records = sanitizeLinks([...kept, ...addLinks]);
  }

  if (Object.keys(patch).length) {
    const { error } = await dbClient
      .from("message_threads")
      .update(patch)
      .eq("thread_id", threadIdNum);
    if (error) throw error;
  }

  return getThreadSnapshotForUser(threadIdNum, actorUserId);
};

// Per-member notification level: all | mentions | none.
export const setMemberNotificationLevel = async ({ threadId, userId, level }) => {
  assertMessagingWriteAccess();
  await assertHubReady();
  if (!NOTIFICATION_LEVEL_VALUES.includes(level)) {
    const error = new Error("Unknown notification level.");
    error.statusCode = 400;
    throw error;
  }
  const threadIdNum = Number(threadId);
  const userIdNum = normalizeUserId(userId);
  await assertThreadMember(threadIdNum, userIdNum);
  const { error } = await dbClient
    .from("message_thread_members")
    .update({ notification_level: level })
    .eq("thread_id", threadIdNum)
    .eq("user_id", userIdNum);
  if (error) throw error;
  return getThreadSnapshotForUser(threadIdNum, userIdNum);
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
