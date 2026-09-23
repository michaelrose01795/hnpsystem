// file location: tools/scripts/seed-all-access-messages.js
//
// Seed demo conversations for the All Access demonstration login
// (alex.morgan@hnp-demo.co.uk), so /messages has something to show in a demo:
// a direct-style chat, a group with an unread @mention, a department chat with
// a task and an overdue reminder, an internal job chat with a pinned message,
// and an announcement channel.
//
//   npm run seed:all-access-messages            rebuild the demo conversations
//   npm run seed:all-access-messages -- --remove   delete them and stop
//
// KEEPING THE DEMO ACCOUNT INVISIBLE
// The All Access account must never surface to real staff
// (src/lib/database/allAccessVisibility.js). So every demo conversation has
// the demo account as its ONLY member. The other messages are attributed to
// real staff users — so names and roles look right — but those users are not
// members, and /messages only ever lists conversations you are a member of,
// so none of this reaches anyone else's inbox.
//
// Every demo thread's unique_hash starts with "demo-aa:" (DEMO_HASH_PREFIX in
// src/lib/messages/conversationModel.js). That is how a re-run finds and
// replaces them, and it keeps them from colliding with — or being joined as —
// a real standing department or job chat. Nothing else is touched.
//
// Messages are written in the same shape the app writes them: one row per
// thread carrying the whole transcript in metadata._conversation (see
// buildConversationRowPayload in src/lib/database/messages.js).

/* eslint-disable no-console */
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Kept in step with src/lib/database/allAccessVisibility.js and
// src/lib/messages/conversationModel.js (ESM with "@/" aliases, so they cannot
// be required from a plain Node script).
const ALL_ACCESS_EMAIL = "alex.morgan@hnp-demo.co.uk";
const DEMO_HASH_PREFIX = "demo-aa:";
const CONVERSATION_LOG_KEY = "_conversation";

const REMOVE_ONLY = process.argv.includes("--remove");

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60 * 1000).toISOString();
const hoursAgo = (hours) => minutesAgo(hours * 60);
const daysAgo = (days, hour = 9, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};
const mention = (user) => `@[${user.name}](u:${user.id})`;

const fail = (label, error) => {
  if (error) throw new Error(`${label}: ${error.message}`);
};

async function findDemoUser() {
  const { data, error } = await supabase
    .from("users")
    .select("user_id, first_name, last_name")
    .ilike("email", ALL_ACCESS_EMAIL)
    .maybeSingle();
  fail("Looking up the All Access user", error);
  if (!data) {
    throw new Error("The All Access user does not exist yet. Run `npm run seed:all-access` first.");
  }
  return { id: data.user_id, name: [data.first_name, data.last_name].filter(Boolean).join(" ") };
}

// Real, active staff to attribute the other side of each conversation to.
// Matched by role so the demo reads naturally; falls back to any active staff.
async function pickStaff(demoUserId) {
  const { data, error } = await supabase
    .from("users")
    .select("user_id, first_name, last_name, role")
    .eq("is_active", true)
    .neq("user_id", demoUserId);
  fail("Loading staff", error);
  const staff = (data || []).filter(
    (row) => !/customer|all access/i.test(String(row.role || ""))
  );
  if (staff.length < 3) throw new Error("Need at least three active staff users to attribute messages to.");

  const used = new Set();
  const take = (pattern) => {
    const row =
      staff.find((entry) => !used.has(entry.user_id) && pattern.test(String(entry.role || ""))) ||
      staff.find((entry) => !used.has(entry.user_id));
    used.add(row.user_id);
    return { id: row.user_id, name: [row.first_name, row.last_name].filter(Boolean).join(" ") };
  };

  return {
    workshop: take(/workshop manager/i),
    parts: take(/parts manager|^parts$/i),
    advisor: take(/^service$|service advis/i),
    tech: take(/tech/i),
    serviceManager: take(/service manager/i),
    general: take(/general manager|director|owner/i),
  };
}

async function pickJob() {
  const { data, error } = await supabase
    .from("jobs")
    .select("job_number, vehicle_reg, vehicle_make_model, customer")
    .not("vehicle_reg", "is", null)
    .not("job_number", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  fail("Loading a job", error);
  const row = data?.[0];
  return row
    ? {
        number: String(row.job_number),
        reg: String(row.vehicle_reg),
        model: row.vehicle_make_model || "",
        customer: row.customer || "the customer",
      }
    : { number: "12345", reg: "AB12CDE", model: "", customer: "the customer" };
}

async function removeDemoThreads() {
  const { data: threads, error } = await supabase
    .from("message_threads")
    .select("thread_id")
    .like("unique_hash", `${DEMO_HASH_PREFIX}%`);
  fail("Finding existing demo conversations", error);
  const ids = (threads || []).map((row) => row.thread_id);
  if (!ids.length) return 0;

  // Reactions are keyed by message id ("t<threadId>-m…"), so clear them by
  // prefix before the transcripts go.
  for (const threadId of ids) {
    const { error: reactionError } = await supabase
      .from("content_reactions")
      .delete()
      .eq("target_type", "message")
      .like("target_id", `t${threadId}-%`);
    fail("Removing demo reactions", reactionError);
  }
  fail("Removing demo messages", (await supabase.from("messages").delete().in("thread_id", ids)).error);
  fail("Removing demo members", (await supabase.from("message_thread_members").delete().in("thread_id", ids)).error);
  fail("Removing demo conversations", (await supabase.from("message_threads").delete().in("thread_id", ids)).error);
  return ids.length;
}

// Writes one conversation: thread row, the demo user's membership and the
// transcript row. `entries` are
// [{ at, from, content, metadata?, reactions?, replyToIndex? }].
async function createConversation({ key, title, demoUser, role = "leader", entries, unreadFrom = null }) {
  const createdAt = entries[0]?.at || new Date().toISOString();
  const updatedAt = entries[entries.length - 1]?.at || createdAt;

  const { data: thread, error: threadError } = await supabase
    .from("message_threads")
    .insert({
      thread_type: "group",
      title,
      unique_hash: `${DEMO_HASH_PREFIX}${key}`,
      created_by: demoUser.id,
      created_at: createdAt,
      updated_at: updatedAt,
    })
    .select("thread_id")
    .single();
  fail(`Creating "${title}"`, threadError);
  const threadId = thread.thread_id;

  // Everything before `unreadFrom` has been read; from it on is unread.
  const lastReadAt =
    unreadFrom != null && entries[unreadFrom]
      ? new Date(new Date(entries[unreadFrom].at).getTime() - 1000).toISOString()
      : updatedAt;
  const { error: memberError } = await supabase.from("message_thread_members").insert({
    thread_id: threadId,
    user_id: demoUser.id,
    role,
    joined_at: createdAt,
    last_read_at: lastReadAt,
  });
  fail(`Adding the demo user to "${title}"`, memberError);

  const log = entries.map((entry, index) => ({
    id: `t${threadId}-m${new Date(entry.at).getTime()}-${index}`,
    threadId,
    content: entry.content,
    createdAt: entry.at,
    senderId: entry.from.id,
    receiverId: null,
    sender: null,
    metadata: entry.metadata || null,
    savedForever: false,
  }));
  // A reply quotes an earlier entry by its position; point it at that entry's id.
  entries.forEach((entry, index) => {
    if (entry.replyToIndex == null) return;
    const quoted = log[entry.replyToIndex];
    const quotedEntry = entries[entry.replyToIndex];
    log[index].metadata = {
      ...(log[index].metadata || {}),
      replyTo: { id: quoted.id, senderName: quotedEntry.from.name, contentSnippet: quoted.content.slice(0, 200) },
    };
  });

  const latest = log[log.length - 1];
  const { error: messageError } = await supabase.from("messages").insert({
    thread_id: threadId,
    sender_id: latest.senderId,
    receiver_id: null,
    content: latest.content,
    created_at: latest.createdAt,
    metadata: { ...(latest.metadata || {}), [CONVERSATION_LOG_KEY]: log },
    saved_forever: false,
  });
  fail(`Writing the "${title}" transcript`, messageError);

  const reactions = [];
  entries.forEach((entry, index) => {
    (entry.reactions || []).forEach(([user, emoji]) => {
      reactions.push({ target_type: "message", target_id: log[index].id, user_id: user.id, emoji });
    });
  });
  if (reactions.length) {
    fail(`Adding reactions in "${title}"`, (await supabase.from("content_reactions").insert(reactions)).error);
  }

  return { threadId, title, messages: log.length, unread: unreadFrom != null ? entries.length - unreadFrom : 0 };
}

async function main() {
  const removed = await removeDemoThreads();
  if (removed) console.log(`Removed ${removed} existing demo conversation(s).`);
  if (REMOVE_ONLY) {
    console.log("Done (--remove).");
    return;
  }

  const me = await findDemoUser();
  const staff = await pickStaff(me.id);
  const job = await pickJob();
  const { workshop, parts, advisor, tech, serviceManager, general } = staff;
  const pinnedBy = { byId: workshop.id, byName: workshop.name, at: hoursAgo(20) };

  const conversations = [
    {
      key: "direct:workshop",
      title: workshop.name,
      unreadFrom: null,
      entries: [
        { at: daysAgo(2, 8, 12), from: workshop, content: `Morning ${me.name.split(" ")[0]} — can you have a look at /job ${job.number} before the customer calls? /reg ${job.reg}` },
        { at: daysAgo(2, 8, 20), from: me, content: "On it. Is the VHC finished?", reactions: [[workshop, "👍"]] },
        { at: daysAgo(2, 8, 41), from: workshop, content: "Yes — two ambers, front pads and a wiper blade. Photos are on the job card." },
        {
          at: daysAgo(2, 9, 3),
          from: me,
          content: "Perfect, I'll get the pads authorised and ring them back before lunch.",
          replyToIndex: 2,
        },
        { at: daysAgo(1, 16, 30), from: workshop, content: "Customer approved everything — thanks for chasing.", reactions: [[me, "🔥"]] },
      ],
    },
    {
      key: "group:workshop-handover",
      title: "Workshop handover",
      unreadFrom: 3,
      entries: [
        { at: hoursAgo(26), from: workshop, content: "Handover for tomorrow: three MOTs first thing, the Sportage clutch after 10." },
        { at: hoursAgo(25), from: tech, content: "I'll take the MOTs. Bay 2 lift is sticking again — can someone book the engineer?" },
        { at: hoursAgo(24), from: parts, content: "Clutch kit arrives on the 8am drop. I'll bring it straight to bay 4.", reactions: [[workshop, "👍"], [tech, "👍"]] },
        { at: minutesAgo(95), from: workshop, content: `${mention(me)} can you approve the lift engineer call-out? It's £180 plus parts.` },
        { at: minutesAgo(40), from: tech, content: `Also ${mention(me)} — the courtesy car is back with a quarter tank.` },
      ],
    },
    {
      key: "department:Service",
      title: "Service team",
      unreadFrom: 2,
      entries: [
        { at: daysAgo(3, 10, 5), from: serviceManager, content: "Reminder: all advisors need VHC videos sent within 30 minutes of the check." },
        {
          at: daysAgo(3, 10, 9),
          from: serviceManager,
          content: "Update the waiting-customer board after every call",
          metadata: { task: { text: "Update the waiting-customer board after every call", status: "open", createdBy: serviceManager.id } },
        },
        {
          at: hoursAgo(5),
          from: advisor,
          content: `Chase ${job.customer} for the service plan renewal`,
          metadata: { reminder: { text: `Chase ${job.customer} for the service plan renewal`, dueAt: hoursAgo(1), status: "open", createdBy: advisor.id } },
        },
        { at: hoursAgo(2), from: advisor, content: "Diary is full Thursday — I've started offering Friday collection instead." },
      ],
    },
    {
      key: `jobteam:${job.number}`,
      title: [`Job ${job.number}`, job.reg, job.customer].filter(Boolean).join(" · "),
      unreadFrom: null,
      entries: [
        { at: hoursAgo(22), from: workshop, content: `Internal notes for /job ${job.number}${job.model ? ` (${job.model})` : ""}.` },
        {
          at: hoursAgo(20),
          from: tech,
          content: "Found a split CV boot on the nearside — not on the original booking.",
          metadata: { pinned: pinnedBy },
          reactions: [[workshop, "😮"]],
        },
        { at: hoursAgo(19), from: parts, content: "CV boot kit is in stock, two on the shelf. /part CVB-201" },
        { at: hoursAgo(18), from: me, content: "Price it up and I'll get the customer's approval with the ambers." },
        {
          at: hoursAgo(17),
          from: parts,
          content: "Reserve the CV boot kit against this job",
          metadata: { task: { text: "Reserve the CV boot kit against this job", status: "done", createdBy: me.id, completedBy: { byId: parts.id, byName: parts.name, at: hoursAgo(16) } } },
        },
      ],
    },
    {
      key: "announcement:workshop-notices",
      title: "Workshop notices",
      role: "member",
      unreadFrom: 1,
      entries: [
        { at: daysAgo(4, 7, 45), from: general, content: "Welcome to Workshop notices — site-wide updates only, no replies needed.", reactions: [[workshop, "👍"]] },
        { at: hoursAgo(3), from: general, content: "Fire alarm test this Friday at 11:00. Please do not evacuate unless the alarm continues for more than a minute." },
      ],
    },
  ];

  const results = [];
  for (const conversation of conversations) {
    results.push(await createConversation({ ...conversation, demoUser: me }));
  }

  console.log(`Seeded ${results.length} demo conversations for ${me.name} (user ${me.id}):`);
  results.forEach((row) =>
    console.log(`  #${row.threadId}  ${row.title}  — ${row.messages} messages${row.unread ? `, ${row.unread} unread` : ""}`)
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
