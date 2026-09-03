// file location: src/lib/database/reactions.js
//
// Emoji reactions for chat messages and news-feed updates.
//
// One table (public.content_reactions) serves both, keyed by
// (target_type, target_id). A UNIQUE constraint on
// (target_type, target_id, user_id) means a user holds at most ONE reaction on
// any one thing — see setReaction() for the three outcomes that produces.
//
// Reads run on whichever client is available (the browser gets the anon client
// and the SELECT policy allows it, so realtime refreshes can re-read directly).
// Writes require the service key, matching src/lib/database/messages.js.

import { supabase, supabaseService } from "@/lib/database/supabaseClient";
import { getDisplayName } from "@/lib/users/displayName";
import { logFailure } from "@/lib/utils/logFailure";

const REACTIONS_TABLE = "content_reactions";
const dbClient = supabaseService || supabase;
const isServiceClient = Boolean(supabaseService);

export const REACTION_TARGET_MESSAGE = "message";
export const REACTION_TARGET_NEWS_UPDATE = "news_update";
const VALID_TARGET_TYPES = [REACTION_TARGET_MESSAGE, REACTION_TARGET_NEWS_UPDATE];

const REACTION_COLUMNS = `
  reaction_id,
  target_type,
  target_id,
  user_id,
  emoji,
  created_at,
  user:users!content_reactions_user_id_fkey(user_id, first_name, last_name)
`;

const assertReactionWriteAccess = () => {
  if (!isServiceClient) {
    throw new Error(
      "Server missing SUPABASE_SERVICE_ROLE_KEY; reaction writes are blocked by RLS."
    );
  }
};

export const assertValidTargetType = (targetType) => {
  if (!VALID_TARGET_TYPES.includes(targetType)) {
    throw new Error(
      `Unknown reaction target type "${targetType}". Expected one of: ${VALID_TARGET_TYPES.join(", ")}.`
    );
  }
};

// The shape both pages consume: enough to render the bar (emoji) and the
// "who reacted" summary (userId + name).
const formatReactionRow = (row) => ({
  id: row.reaction_id,
  targetType: row.target_type,
  targetId: String(row.target_id),
  userId: row.user_id,
  name: row.user ? getDisplayName(row.user) : "Unknown user",
  emoji: row.emoji,
  createdAt: row.created_at,
});

// Returns { [targetId]: [reaction, ...] } so callers can index straight into
// it. Target ids are normalised to strings — messages use integers and news
// updates use uuids, and the caller should not have to care.
export const getReactions = async ({ targetType, targetIds = [] }) => {
  assertValidTargetType(targetType);

  const ids = [...new Set(targetIds.map((id) => String(id)).filter(Boolean))];
  if (!ids.length) return {};

  const { data, error } = await dbClient
    .from(REACTIONS_TABLE)
    .select(REACTION_COLUMNS)
    .eq("target_type", targetType)
    .in("target_id", ids)
    .order("created_at", { ascending: true });

  if (error) {
    logFailure("❌ getReactions error:", error);
    throw new Error(`Failed to load reactions: ${error.message}`);
  }

  const grouped = {};
  for (const row of data || []) {
    const reaction = formatReactionRow(row);
    (grouped[reaction.targetId] ||= []).push(reaction);
  }
  return grouped;
};

// Applies one user's pick to one target. Exactly one of three things happens:
//
//   no existing row            → insert it        (action: "added")
//   existing row, same emoji   → delete it        (action: "removed")
//   existing row, other emoji  → update the emoji (action: "replaced")
//
// The third case is the rule the UI needs: choosing 😂 while already on 😮
// moves the single reaction across rather than leaving both behind.
export const setReaction = async ({ targetType, targetId, userId, emoji }) => {
  assertReactionWriteAccess();
  assertValidTargetType(targetType);

  const normalizedTargetId = String(targetId || "").trim();
  const normalizedUserId = Number(userId);
  const normalizedEmoji = String(emoji || "").trim();

  if (!normalizedTargetId) throw new Error("targetId is required.");
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) {
    throw new Error("A valid userId is required.");
  }
  if (!normalizedEmoji) throw new Error("emoji is required.");

  const { data: existing, error: existingError } = await dbClient
    .from(REACTIONS_TABLE)
    .select("reaction_id, emoji")
    .eq("target_type", targetType)
    .eq("target_id", normalizedTargetId)
    .eq("user_id", normalizedUserId)
    .maybeSingle();

  if (existingError) {
    logFailure("❌ setReaction lookup error:", existingError);
    throw new Error(`Failed to read existing reaction: ${existingError.message}`);
  }

  if (existing && existing.emoji === normalizedEmoji) {
    const { error } = await dbClient
      .from(REACTIONS_TABLE)
      .delete()
      .eq("reaction_id", existing.reaction_id);

    if (error) {
      logFailure("❌ setReaction delete error:", error);
      throw new Error(`Failed to remove reaction: ${error.message}`);
    }
    return { action: "removed", emoji: null };
  }

  if (existing) {
    const { error } = await dbClient
      .from(REACTIONS_TABLE)
      .update({ emoji: normalizedEmoji, updated_at: new Date().toISOString() })
      .eq("reaction_id", existing.reaction_id);

    if (error) {
      logFailure("❌ setReaction update error:", error);
      throw new Error(`Failed to change reaction: ${error.message}`);
    }
    return { action: "replaced", emoji: normalizedEmoji };
  }

  // upsert (not insert) so a racing tab that inserted first is corrected to
  // this pick instead of failing on the one-per-user unique constraint.
  const { error } = await dbClient
    .from(REACTIONS_TABLE)
    .upsert(
      {
        target_type: targetType,
        target_id: normalizedTargetId,
        user_id: normalizedUserId,
        emoji: normalizedEmoji,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "target_type,target_id,user_id" }
    );

  if (error) {
    logFailure("❌ setReaction insert error:", error);
    throw new Error(`Failed to add reaction: ${error.message}`);
  }
  return { action: "added", emoji: normalizedEmoji };
};

// Browser-only. Fires onChange for every insert/update/delete on the table so
// the page can re-read and show other people's reactions live.
export const subscribeToReactions = (targetType, onChange) => {
  if (typeof window === "undefined") return () => {};
  assertValidTargetType(targetType);

  const channel = supabase
    .channel(`content-reactions-${targetType}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: REACTIONS_TABLE,
        filter: `target_type=eq.${targetType}`,
      },
      onChange
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
};
