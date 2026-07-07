// file location: src/config/topbar/communicationShortcuts.js
//
// QUICK COMMUNICATION SHORTCUTS (Phase 4.4) — PURE deep-link builders. Lets any
// contextual operational surface (a presence row, an escalation, a cross-
// department link) offer a one-click "message this person / department" action
// that opens the existing Messages workspace straight into the right conversation.
//
// No React/window/storage. Each builder returns a plain href the Messages page
// understands (see the `?to=` / `?compose=group` deep-link handling in
// src/pages/messages/index.js, which reuses the real ensureDirectThread /
// createGroupThread primitives — no new messaging backend).
//
// URL contract (kept tiny + stable):
//   /messages?to=<userId>                          → open/start a 1:1 DM
//   /messages?compose=group&members=<id,id>&title= → open group compose pre-filled

const MESSAGES_BASE = "/messages";

// 1:1 direct message with a colleague.
export function messageUserHref(userId) {
  if (userId == null) return null;
  return `${MESSAGES_BASE}?to=${encodeURIComponent(String(userId))}`;
}

// Group message to a set of colleagues (a whole department), pre-titled.
export function messageGroupHref(memberIds = [], title = "") {
  const ids = (Array.isArray(memberIds) ? memberIds : [])
    .filter((id) => id != null)
    .map((id) => String(id));
  if (ids.length === 0) return null;
  const params = new URLSearchParams();
  params.set("compose", "group");
  params.set("members", ids.join(","));
  if (title) params.set("title", title);
  return `${MESSAGES_BASE}?${params.toString()}`;
}

// A ready-to-render "message" action for a presence member.
export function memberContactAction(member) {
  if (!member || member.id == null) return null;
  const href = messageUserHref(member.id);
  if (!href) return null;
  return {
    id: `message-user:${member.id}`,
    label: member.isSelf ? "Message yourself (notes)" : `Message ${member.name}`,
    shortLabel: "Message",
    icon: "💬",
    href,
  };
}

// A ready-to-render "message the whole department" action for a presence group.
export function departmentContactAction(group) {
  if (!group || !Array.isArray(group.members) || group.members.length === 0) return null;
  // Don't create a "group" of one — fall back to a direct message.
  const ids = group.members.map((m) => m.id).filter((id) => id != null);
  if (ids.length === 0) return null;
  const title = `${group.name} team`;
  const href = ids.length === 1 ? messageUserHref(ids[0]) : messageGroupHref(ids, title);
  if (!href) return null;
  return {
    id: `message-dept:${group.code}`,
    label: `Message the ${group.name} team`,
    shortLabel: "Message team",
    icon: "📣",
    href,
  };
}

// Build a message action addressed at a department's members drawn from a
// presence result (used by escalations/cross-department, which know a department
// code + audience but not the member list). `presenceByDept` maps code → group.
export function audienceContactAction(audienceCode, presenceDepartments = []) {
  if (!audienceCode) return null;
  const group = (presenceDepartments || []).find((d) => d.code === audienceCode);
  if (!group) return null;
  return departmentContactAction(group);
}
