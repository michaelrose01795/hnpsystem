// Mock data for the Internal Messages presentation deck (/messages, slide 0).
//
// The real /messages page reads several shapes, all served by the
// presentation data layer (see ../dataLayer/apiRouteTable.js):
//   - GET /api/messages/threads                  → `threads`
//   - GET /api/messages/threads/:id/messages     → `threadMessages[:id]`
//   - GET /api/messages/threads/:id/members      → thread members
//   - GET /api/messages/users                    → `directory`
//   - GET /api/messages/customer-requests        → `customerRequests`
// It also pulls system notifications straight from the supabase stub
// (`supabase.from("notifications")`), which routes to the `rows` export.
//
// The demo user is always Supabase user_id 1 (see UserContext presentation
// branch), so every thread lists user 1 as a participant and the conversation
// rows alternate between user 1 and the other party.
//
// The transcripts deliberately exercise the full message UI:
//   - two READ threads (101, 104) and two UNREAD threads (102, 103)
//   - reply messages        → `replyToId` on a raw row
//   - emoji reactions       → `reactions: [{ userId, emoji }]` on a raw row
//   - inline slash commands → /job1042, /vhc1042, /parts, /invoiceINV0009 …
//     (rendered as highlighted tokens; they are demo-only and don't navigate)

const CURRENT_USER_ID = 1;

// Minimal directory of staff the demo user can message. Shape matches
// `formatUserProfile` in src/lib/database/messages.js.
const PROFILES = {
  1: { id: 1, firstName: "Demo", lastName: "Manager", email: "demo.manager@hnp.example", role: "Service Manager", name: "Demo Manager" },
  2: { id: 2, firstName: "Demo", lastName: "Tech", email: "demo.tech@hnp.example", role: "Technician", name: "Demo Tech" },
  3: { id: 3, firstName: "Demo", lastName: "Parts", email: "demo.parts@hnp.example", role: "Parts Advisor", name: "Demo Parts" },
  4: { id: 4, firstName: "Demo", lastName: "Reception", email: "demo.recep@hnp.example", role: "Receptionist", name: "Demo Reception" },
  5: { id: 5, firstName: "Demo", lastName: "Accounts", email: "demo.accounts@hnp.example", role: "Accounts Manager", name: "Demo Accounts" },
  6: { id: 6, firstName: "Demo", lastName: "MOT", email: "demo.mot@hnp.example", role: "MOT Tester", name: "Demo MOT" },
};

// Conversation transcripts, keyed by thread id (string keys so they match the
// path param the API route extracts from /api/messages/threads/:id/messages).
// Raw rows may carry `replyToId` (id of an earlier row in the same thread) and
// `reactions`; both are folded into `metadata` during hydration below.
const rawThreadMessages = {
  // Thread 101 — direct, READ. A job hand-off between manager and technician.
  "101": [
    { id: "t101-m1", senderId: 1, receiverId: 2, content: "Morning — can you take a look at /job1042? Customer reported a knocking noise on the front offside.", createdAt: "2026-05-19T08:05:00.000Z" },
    { id: "t101-m2", senderId: 2, receiverId: 1, content: "On it now. Looks like a worn lower suspension arm — I'll get it on the ramp.", createdAt: "2026-05-19T08:32:00.000Z", reactions: [{ userId: 1, emoji: "👍" }] },
    { id: "t101-m3", senderId: 2, receiverId: 1, content: "Confirmed. Suspension arm fitted and road-tested fine — I've logged it all on /vhc1042.", createdAt: "2026-05-19T11:25:00.000Z" },
    { id: "t101-m4", senderId: 1, receiverId: 2, content: "Great work. Please mark it ready and I'll get it invoiced.", createdAt: "2026-05-19T11:30:00.000Z", replyToId: "t101-m3", reactions: [{ userId: 2, emoji: "🔥" }] },
    { id: "t101-m5", senderId: 2, receiverId: 1, content: "Will do. Do you want me to order the /partBP2294 front brake pads while it's here? They're borderline.", createdAt: "2026-05-19T11:38:00.000Z" },
    { id: "t101-m6", senderId: 1, receiverId: 2, content: "Yes please — raise it on /parts and I'll approve the /orderPO5567.", createdAt: "2026-05-19T11:41:00.000Z", replyToId: "t101-m5" },
    { id: "t101-m7", senderId: 2, receiverId: 1, content: "All raised. Customer's good to collect after 3pm.", createdAt: "2026-05-19T11:44:00.000Z", reactions: [{ userId: 1, emoji: "👍" }, { userId: 1, emoji: "❤️" }] },
  ],
  // Thread 102 — direct, UNREAD. Reception keeping the manager updated.
  "102": [
    { id: "t102-m1", senderId: 4, receiverId: 1, content: "Mr Reynolds is in reception for /job1044. He's asking if the car will be ready before 3pm.", createdAt: "2026-05-19T09:50:00.000Z" },
    { id: "t102-m2", senderId: 1, receiverId: 4, content: "Should be fine — it's just the brake fluid service left. Tell him 2:30pm to be safe.", createdAt: "2026-05-19T09:55:00.000Z" },
    { id: "t102-m3", senderId: 4, receiverId: 1, content: "He's happy with 2:30pm — I'll keep him in the waiting area.", createdAt: "2026-05-19T09:58:00.000Z", replyToId: "t102-m2", reactions: [{ userId: 1, emoji: "👍" }] },
    { id: "t102-m4", senderId: 4, receiverId: 1, content: "One more thing — he's asking about the balance on /invoiceINV0009. Can you confirm before he leaves?", createdAt: "2026-05-19T10:12:00.000Z" },
  ],
  // Thread 103 — group "Workshop Floor", UNREAD. Multi-party banter + commands.
  "103": [
    { id: "t103-m1", senderId: 1, receiverId: null, content: "Team — workshop is full this afternoon. Prioritise the two waiting jobs: /job1042 and /job1044.", createdAt: "2026-05-19T08:00:00.000Z" },
    { id: "t103-m2", senderId: 2, receiverId: null, content: "I've got /job1042 on the ramp now, /job1044 straight after.", createdAt: "2026-05-19T08:14:00.000Z", replyToId: "t103-m1", reactions: [{ userId: 1, emoji: "👍" }] },
    { id: "t103-m3", senderId: 3, receiverId: null, content: "CKP sensor for /job1043 has been ordered — ETA tomorrow AM. I'm tracking it on /parts.", createdAt: "2026-05-19T10:10:00.000Z", reactions: [{ userId: 1, emoji: "👍" }, { userId: 2, emoji: "👍" }] },
    { id: "t103-m4", senderId: 6, receiverId: null, content: "MOT on /job1052 failed — front nearside tyre below the limit. I've advised the /customer.", createdAt: "2026-05-19T12:20:00.000Z", reactions: [{ userId: 1, emoji: "😮" }, { userId: 3, emoji: "😮" }] },
    { id: "t103-m5", senderId: 1, receiverId: null, content: "Thanks for the heads up. Can you quote the tyre and add it to /vhc1052?", createdAt: "2026-05-19T12:24:00.000Z", replyToId: "t103-m4" },
    { id: "t103-m6", senderId: 6, receiverId: null, content: "Will do. Also check the /tracking board — the bay 3 key has been sitting unlogged for an hour.", createdAt: "2026-05-19T12:31:00.000Z" },
  ],
  // Thread 104 — direct, READ. Accounts chasing an overdue invoice.
  "104": [
    { id: "t104-m1", senderId: 5, receiverId: 1, content: "Invoice /invoiceINV0009 for James Holt is now 18 days overdue. Can someone chase payment?", createdAt: "2026-05-19T08:15:00.000Z" },
    { id: "t104-m2", senderId: 1, receiverId: 5, content: "Noted — I'll call him this morning and let you know the outcome.", createdAt: "2026-05-19T08:40:00.000Z" },
    { id: "t104-m3", senderId: 5, receiverId: 1, content: "Thanks. If he can't pay today, please hold any further work on /job1043.", createdAt: "2026-05-19T08:43:00.000Z", replyToId: "t104-m2" },
    { id: "t104-m4", senderId: 1, receiverId: 5, content: "Spoke to him — he's paying by card this afternoon. I'll confirm once it's through.", createdAt: "2026-05-19T09:30:00.000Z", reactions: [{ userId: 5, emoji: "❤️" }, { userId: 5, emoji: "👍" }] },
    { id: "t104-m5", senderId: 5, receiverId: 1, content: "Brilliant, thank you 🙌", createdAt: "2026-05-19T09:33:00.000Z" },
  ],
};

// Fold `replyToId` / `reactions` into the `metadata` block the conversation
// panel expects, and attach each message's full sender profile.
function buildMetadata(message, transcript) {
  const metadata = {};
  if (message.replyToId) {
    const target = transcript.find((row) => row.id === message.replyToId);
    if (target) {
      metadata.replyTo = {
        id: target.id,
        senderName: (PROFILES[target.senderId] || {}).name || "Unknown",
        contentSnippet: String(target.content || "").slice(0, 200),
      };
    }
  }
  if (Array.isArray(message.reactions) && message.reactions.length) {
    metadata.reactions = message.reactions.map((reaction) => ({
      userId: reaction.userId,
      emoji: reaction.emoji,
    }));
  }
  return Object.keys(metadata).length ? metadata : null;
}

export const threadMessages = Object.fromEntries(
  Object.entries(rawThreadMessages).map(([threadKey, transcript]) => [
    threadKey,
    transcript.map((message) => ({
      id: message.id,
      threadId: Number(threadKey),
      content: message.content,
      createdAt: message.createdAt,
      senderId: message.senderId,
      receiverId: message.receiverId ?? null,
      sender: PROFILES[message.senderId] || null,
      metadata: buildMetadata(message, transcript),
      savedForever: false,
    })),
  ])
);

// Builds the `lastMessage` block a thread row carries (shape matches
// `formatMessageRow`). Returns null for an empty transcript.
function lastMessageOf(threadKey) {
  const transcript = threadMessages[threadKey] || [];
  const latest = transcript[transcript.length - 1];
  if (!latest) return null;
  return {
    id: latest.id,
    threadId: latest.threadId,
    content: latest.content,
    createdAt: latest.createdAt,
    senderId: latest.senderId,
    receiverId: latest.receiverId,
    sender: latest.sender,
    metadata: latest.metadata,
    savedForever: false,
  };
}

function member(userId, role = "member", lastReadAt = null) {
  return {
    userId,
    role,
    joinedAt: "2026-05-12T09:00:00.000Z",
    lastReadAt,
    profile: PROFILES[userId] || null,
  };
}

// Thread list for the demo user. Shape matches `formatThreadRow`.
// hasUnread true  → unread state (badge on the row)  → threads 102, 103
// hasUnread false → read state (no badge)            → threads 101, 104
export const threads = [
  {
    id: 102,
    type: "direct",
    title: "Demo Reception",
    createdBy: 4,
    createdAt: "2026-05-19T09:50:00.000Z",
    updatedAt: "2026-05-19T10:12:00.000Z",
    members: [member(1, "member", "2026-05-19T09:58:00.000Z"), member(4, "member", "2026-05-19T10:12:00.000Z")],
    lastMessage: lastMessageOf("102"),
    hasUnread: true,
    lastReadAt: "2026-05-19T09:58:00.000Z",
  },
  {
    id: 103,
    type: "group",
    title: "Workshop Floor",
    createdBy: 1,
    createdAt: "2026-05-12T09:00:00.000Z",
    updatedAt: "2026-05-19T12:31:00.000Z",
    members: [member(1, "leader", "2026-05-19T12:24:00.000Z"), member(2), member(3), member(6)],
    lastMessage: lastMessageOf("103"),
    hasUnread: true,
    lastReadAt: "2026-05-19T12:24:00.000Z",
  },
  {
    id: 101,
    type: "direct",
    title: "Demo Tech",
    createdBy: 1,
    createdAt: "2026-05-19T08:05:00.000Z",
    updatedAt: "2026-05-19T11:44:00.000Z",
    members: [member(1, "member", "2026-05-19T11:45:00.000Z"), member(2, "member", "2026-05-19T11:44:00.000Z")],
    lastMessage: lastMessageOf("101"),
    hasUnread: false,
    lastReadAt: "2026-05-19T11:45:00.000Z",
  },
  {
    id: 104,
    type: "direct",
    title: "Demo Accounts",
    createdBy: 5,
    createdAt: "2026-05-19T08:15:00.000Z",
    updatedAt: "2026-05-19T09:33:00.000Z",
    members: [member(1, "member", "2026-05-19T09:35:00.000Z"), member(5, "member", "2026-05-19T09:33:00.000Z")],
    lastMessage: lastMessageOf("104"),
    hasUnread: false,
    lastReadAt: "2026-05-19T09:35:00.000Z",
  },
];

// Directory used by the "New chat" modal. Excludes the demo user themselves.
export const directory = Object.values(PROFILES).filter(
  (profile) => profile.id !== CURRENT_USER_ID
);

// Customer service requests for the read-only "Bookings" feed. Shape matches
// the `items` array from /api/messages/customer-requests; the /messages page
// renders each as an inbox card with a "Create job" button.
export const customerRequests = [
  {
    event_id: "demo-req-001",
    activity_type: "booking_request",
    type_label: "Service booking",
    occurred_at: "2026-05-19T09:20:00.000Z",
    customer_id: "demo-cust-101",
    customer_name: "Sarah Whitlock",
    customer_email: "sarah.whitlock@demo.invalid",
    customer_mobile: "07700 900181",
    vehicle_id: "demo-veh-101",
    vehicle_label: "KX19 PTR · BMW 3 Series",
    vehicle_reg: "KX19 PTR",
    description: "Full service plus a check on an oil leak from under the engine.",
    preferred_date: "2026-05-22",
    service_type: "Full service",
  },
  {
    event_id: "demo-req-002",
    activity_type: "valet_request",
    type_label: "Valet booking",
    occurred_at: "2026-05-19T08:05:00.000Z",
    customer_id: "demo-cust-102",
    customer_name: "Tom Beale",
    customer_email: "tom.beale@demo.invalid",
    customer_mobile: "07700 900244",
    vehicle_id: "demo-veh-102",
    vehicle_label: "LR68 NHK · Land Rover Discovery",
    vehicle_reg: "LR68 NHK",
    description: "Interior valet and a machine polish before the vehicle goes up for resale.",
    preferred_date: "2026-05-21",
    service_type: "Premium valet",
  },
  {
    event_id: "demo-req-003",
    activity_type: "parts_enquiry",
    type_label: "Parts enquiry",
    occurred_at: "2026-05-18T16:40:00.000Z",
    customer_id: "demo-cust-103",
    customer_name: "Priya Anand",
    customer_email: "priya.anand@demo.invalid",
    customer_mobile: "07700 900377",
    vehicle_id: "demo-veh-103",
    vehicle_label: "MA21 OWN · Audi A4",
    vehicle_reg: "MA21 OWN",
    description: "Price and availability for a replacement nearside wing mirror.",
    preferred_date: null,
    service_type: null,
  },
  {
    event_id: "demo-req-004",
    activity_type: "body_repair_request",
    type_label: "Body repair quote",
    occurred_at: "2026-05-18T14:10:00.000Z",
    customer_id: "demo-cust-104",
    customer_name: "Liam Foster",
    customer_email: "liam.foster@demo.invalid",
    customer_mobile: "07700 900412",
    vehicle_id: "demo-veh-104",
    vehicle_label: "EX70 DRC · Ford Focus",
    vehicle_reg: "EX70 DRC",
    description: "Rear bumper scuff repair quote after a knock in a supermarket car park.",
    preferred_date: "2026-05-26",
    service_type: null,
  },
];

// Read-only "System notifications" feed. The /messages page pulls these via
// `supabase.from("notifications")` with a filter of
// `target_role.ilike.%customer% OR target_role.is.null`, so every row here
// uses a null or customer-facing target_role to stay visible.
const rawNotifications = [
  { notification_id: "demo-note-001", message: "VHC report for DEMO-1042 has been sent to the customer for approval.", target_role: null, created_at: "2026-05-19T11:40:00.000Z" },
  { notification_id: "demo-note-002", message: "Customer payment received for invoice INV-0014 (£312.50).", target_role: "customer", created_at: "2026-05-19T10:05:00.000Z" },
  { notification_id: "demo-note-003", message: "Online booking request received for a full service.", target_role: "customer", created_at: "2026-05-19T09:20:00.000Z" },
  { notification_id: "demo-note-004", message: "DEMO-1050 mobile EV battery swap completed on-site.", target_role: null, created_at: "2026-05-19T08:35:00.000Z" },
  { notification_id: "demo-note-005", message: "Three staff leave requests are awaiting a manager decision.", target_role: null, created_at: "2026-05-19T07:55:00.000Z" },
];

// Default export consumed by queryRouter for the `notifications` /
// `messages` / `message_threads` tables.
export const rows = rawNotifications.map((row) => ({
  ...row,
  updated_at: row.created_at,
  read: false,
}));
