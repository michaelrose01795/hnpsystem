// file location: src/lib/database/newsFeed/preferences.js
//
// Per-user notification and display preferences for the communication hub.
//
// A user with no row gets the defaults below rather than an error, so the
// table needs no backfill: a row is written the first time somebody changes
// something.

import {
  CATEGORY_VALUES,
  DENSITY_COMFORTABLE,
  DENSITY_VALUES,
  DIGEST_VALUES,
  normalizeDepartments,
} from "@/lib/news/constants";
import { assertWriteAccess, db, requireUserId, throwIf, toPositiveInt } from "./client";

const TABLE = "news_notification_preferences";

export const DEFAULT_PREFERENCES = {
  notifyAll: true,
  notifyUrgent: true,
  notifyMentions: true,
  notifyAcknowledgements: true,
  notifyComments: true,
  notifySystemPosts: false,
  mutedCategories: [],
  mutedDepartments: [],
  digestFrequency: "realtime",
  feedDensity: DENSITY_COMFORTABLE,
};

const formatRow = (row) => {
  if (!row) return { ...DEFAULT_PREFERENCES };
  return {
    notifyAll: Boolean(row.notify_all),
    notifyUrgent: Boolean(row.notify_urgent),
    notifyMentions: Boolean(row.notify_mentions),
    notifyAcknowledgements: Boolean(row.notify_acknowledgements),
    notifyComments: Boolean(row.notify_comments),
    notifySystemPosts: Boolean(row.notify_system_posts),
    mutedCategories: Array.isArray(row.muted_categories) ? row.muted_categories : [],
    mutedDepartments: normalizeDepartments(row.muted_departments),
    digestFrequency: row.digest_frequency || "realtime",
    feedDensity: row.feed_density || DENSITY_COMFORTABLE,
  };
};

export async function getPreferences(userId) {
  const viewerId = toPositiveInt(userId);
  if (!viewerId) return { ...DEFAULT_PREFERENCES };

  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("user_id", viewerId)
    .maybeSingle();

  throwIf(error, "Failed to load your notification preferences");
  return formatRow(data);
}

const pickEnum = (value, allowed, fallback) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
};

export async function savePreferences(userId, input = {}) {
  assertWriteAccess("saving notification preferences");
  const viewerId = requireUserId(userId);
  const current = await getPreferences(viewerId);

  const merged = {
    user_id: viewerId,
    notify_all: input.notifyAll ?? current.notifyAll,
    notify_urgent: input.notifyUrgent ?? current.notifyUrgent,
    notify_mentions: input.notifyMentions ?? current.notifyMentions,
    notify_acknowledgements: input.notifyAcknowledgements ?? current.notifyAcknowledgements,
    notify_comments: input.notifyComments ?? current.notifyComments,
    notify_system_posts: input.notifySystemPosts ?? current.notifySystemPosts,
    muted_categories: (input.mutedCategories ?? current.mutedCategories).filter((value) =>
      CATEGORY_VALUES.includes(value)
    ),
    muted_departments: normalizeDepartments(input.mutedDepartments ?? current.mutedDepartments),
    digest_frequency: pickEnum(
      input.digestFrequency ?? current.digestFrequency,
      DIGEST_VALUES,
      "realtime"
    ),
    feed_density: pickEnum(
      input.feedDensity ?? current.feedDensity,
      DENSITY_VALUES,
      DENSITY_COMFORTABLE
    ),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from(TABLE)
    .upsert(merged, { onConflict: "user_id" })
    .select()
    .single();

  throwIf(error, "Failed to save your notification preferences");
  return formatRow(data);
}

// The notify rule itself is pure and lives in src/lib/news/notify.js so the
// browser can apply it without importing this server-side data module.
export { shouldNotify } from "@/lib/news/notify";
