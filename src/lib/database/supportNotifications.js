// file location: src/lib/database/supportNotifications.js
//
// Phase 10 — data layer for in-app notification delivery + subscription rules
// (support_notifications / support_notification_rules). Same privacy model:
// service-role behind dev-gated routes; owner-scoped. Degrades gracefully when
// the migration is absent. The pure matching/composition lives in
// src/lib/support/notificationRules.js; this file only persists + reads.

import { supabaseService } from "@/lib/database/supabaseClient";
import { supportTableExists } from "@/lib/database/supportTableProbe";
import { buildNotifications, DEFAULT_NOTIFICATION_RULES } from "@/lib/support/notificationRules";

const NOTIF = "support_notifications";
const RULES = "support_notification_rules";

// ---------------------------------------------------------------------------
// Notifications (per recipient)
// ---------------------------------------------------------------------------

export async function listNotifications(ownerKey, { unreadOnly = false, limit = 50 } = {}) {
  if (!supabaseService || !(await supportTableExists(NOTIF))) return { ok: true, data: [], unread: 0 };
  try {
    let q = supabaseService.from(NOTIF).select("*").eq("owner_key", ownerKey).order("created_at", { ascending: false }).limit(Math.min(limit, 200));
    if (unreadOnly) q = q.is("read_at", null);
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    const rows = data || [];
    const unread = rows.filter((r) => !r.read_at).length;
    return { ok: true, data: rows, unread };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function countUnread(ownerKey) {
  if (!supabaseService || !(await supportTableExists(NOTIF))) return { ok: true, count: 0 };
  try {
    const { count, error } = await supabaseService
      .from(NOTIF)
      .select("id", { head: true, count: "exact" })
      .eq("owner_key", ownerKey)
      .is("read_at", null);
    if (error) return { ok: false, error: error.message };
    return { ok: true, count: count || 0 };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function markNotificationRead(id, ownerKey) {
  if (!supabaseService || !(await supportTableExists(NOTIF))) return { ok: false, error: "Notifications table not applied." };
  try {
    const { data, error } = await supabaseService
      .from(NOTIF)
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_key", ownerKey)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Notification not found." };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function markAllRead(ownerKey) {
  if (!supabaseService || !(await supportTableExists(NOTIF))) return { ok: false, error: "Notifications table not applied." };
  try {
    const { error } = await supabaseService
      .from(NOTIF)
      .update({ read_at: new Date().toISOString() })
      .eq("owner_key", ownerKey)
      .is("read_at", null);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// ---------------------------------------------------------------------------
// Rules (subscriptions)
// ---------------------------------------------------------------------------

export async function listNotificationRules(ownerKey) {
  if (!supabaseService || !(await supportTableExists(RULES))) return { ok: true, data: [] };
  try {
    // The owner's own rules plus the team-wide broadcast rules (owner_key "*").
    const { data, error } = await supabaseService
      .from(RULES)
      .select("*")
      .or(`owner_key.eq.${ownerKey},owner_key.eq.*`)
      .order("created_at", { ascending: true });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function createNotificationRule(ownerKey, input = {}) {
  if (!supabaseService || !(await supportTableExists(RULES))) return { ok: false, error: "Rules table not applied." };
  if (!input.event) return { ok: false, error: "A rule requires an event." };
  const row = {
    owner_key: ownerKey,
    event: String(input.event),
    filters: input.filters && typeof input.filters === "object" ? input.filters : {},
    channels: Array.isArray(input.channels) && input.channels.length ? input.channels : ["inapp"],
    enabled: input.enabled !== false,
    updated_at: new Date().toISOString(),
  };
  try {
    const { data, error } = await supabaseService.from(RULES).insert([row]).select("*").maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function updateNotificationRule(id, ownerKey, patch = {}) {
  if (!supabaseService || !(await supportTableExists(RULES))) return { ok: false, error: "Rules table not applied." };
  const update = { updated_at: new Date().toISOString() };
  if (patch.filters !== undefined) update.filters = patch.filters && typeof patch.filters === "object" ? patch.filters : {};
  if (patch.channels !== undefined) update.channels = Array.isArray(patch.channels) && patch.channels.length ? patch.channels : ["inapp"];
  if (patch.enabled !== undefined) update.enabled = Boolean(patch.enabled);
  try {
    const { data, error } = await supabaseService
      .from(RULES)
      .update(update)
      .eq("id", id)
      .eq("owner_key", ownerKey)
      .select("*")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Rule not found or not owned by you." };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function deleteNotificationRule(id, ownerKey) {
  if (!supabaseService || !(await supportTableExists(RULES))) return { ok: false, error: "Rules table not applied." };
  try {
    const { data, error } = await supabaseService.from(RULES).delete().eq("id", id).eq("owner_key", ownerKey).select("id").maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Rule not found or not owned by you." };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// ---------------------------------------------------------------------------
// Delivery — match an event against the stored rules and persist notifications.
// Best-effort: never throws so it can't break the request that fired the event.
// ---------------------------------------------------------------------------

/** Distinct owner keys that could receive a broadcast (recipients for "*" rules). */
async function knownRecipients() {
  if (!supabaseService || !(await supportTableExists(RULES))) return ["dev-platform"];
  try {
    const { data } = await supabaseService.from(RULES).select("owner_key");
    const set = new Set(["dev-platform"]);
    (data || []).forEach((r) => {
      if (r.owner_key && r.owner_key !== "*") set.add(r.owner_key);
    });
    return Array.from(set);
  } catch {
    return ["dev-platform"];
  }
}

/**
 * Deliver an event: load rules (+ defaults), match, and insert one notification
 * row per recipient. Returns the count delivered. Never throws.
 * @param {object} event see notificationRules.buildNotifications
 */
export async function deliverEvent(event) {
  try {
    if (!supabaseService || !(await supportTableExists(NOTIF))) return { ok: true, delivered: 0 };
    let rules = DEFAULT_NOTIFICATION_RULES;
    if (await supportTableExists(RULES)) {
      const { data } = await supabaseService.from(RULES).select("*").eq("event", event.type).eq("enabled", true);
      // Combine stored rules for this event with the team defaults (deduped by identity).
      rules = [...(data || []), ...DEFAULT_NOTIFICATION_RULES.filter((d) => d.event === event.type)];
    }
    const recipients = await knownRecipients();
    const notifications = buildNotifications(event, rules, { recipients });
    if (!notifications.length) return { ok: true, delivered: 0 };
    const rows = notifications.map((n) => ({
      owner_key: n.owner_key,
      kind: n.kind,
      title: n.title,
      body: n.body,
      link: n.link,
      severity: n.severity,
      entity_type: n.entity_type,
      entity_id: n.entity_id,
    }));
    const { error } = await supabaseService.from(NOTIF).insert(rows);
    if (error) return { ok: false, error: error.message, delivered: 0 };
    return { ok: true, delivered: rows.length };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), delivered: 0 };
  }
}
