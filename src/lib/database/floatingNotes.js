import { supabase } from "@/lib/database/supabaseClient";
import { CUSTOMER_ROLES, isCustomerRole } from "@/lib/auth/roles";
import { ALL_ACCESS_EMAIL } from "@/lib/database/allAccessVisibility";
import { logFailure } from "@/lib/utils/logFailure";

const TABLE = "floating_notes";
const SHARE_TABLE = "floating_note_shares";
let resolvedGlobalColumn = null;
let resolvedNoteIdColumn = null;

const mapRow = (
  row = {},
  globalColumn = "is_global",
  noteIdColumn = "note_id",
  sharing = {}
) => ({
  noteId: row[noteIdColumn],
  userId: row.user_id,
  title: row.title || "",
  description: row.description || "",
  isGlobal: Boolean(row[globalColumn]),
  isShared: Boolean(row[globalColumn]) || Boolean(sharing.isShared),
  sharedWithCurrentUser: Boolean(sharing.sharedWithCurrentUser),
  sharedUserCount: Number(sharing.sharedUserCount) || 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const invalidIdResult = (message) => ({ success: false, error: { message } });
const inaccessibleNoteResult = () => ({
  success: false,
  error: {
    code: "NOTE_NOT_ACCESSIBLE",
    message: "Note not found or you do not have permission",
  },
});

// These two used to be discovered at runtime: each issued `limit 1` probe
// queries against floating_notes to find out whether the table keys on `note_id`
// or `id`, and whether the global flag is `is_global` or the legacy
// `shared_all_users`. Because the widget mounts in the global shell, those probes
// ran from the browser on EVERY page load in every session — measured against
// production, up to four extra Supabase round trips per page before the widget
// could ask for a single note.
//
// The schema is fixed and known at build time
// (lib/database/schema/schemaReference.sql:1603):
//
//   note_id          bigint  GENERATED ALWAYS AS IDENTITY  → PRIMARY KEY
//   is_global        boolean NOT NULL DEFAULT false
//   shared_all_users boolean NOT NULL DEFAULT false        ← legacy, still present
//   id               bigint  GENERATED ALWAYS AS IDENTITY  ← legacy, still present
//
// Both legacy columns still exist, so the first probe in each pair always
// succeeded — the answer was never in doubt, it just cost four requests to
// re-confirm it on every page. Pinning them keeps every downstream query byte
// for byte the same.
//
// The functions stay async so the nine `await resolve…()` call sites below are
// untouched.
const NOTE_ID_COLUMN = "note_id";
const GLOBAL_COLUMN = "is_global";

const resolveGlobalColumn = async () => {
  resolvedGlobalColumn = GLOBAL_COLUMN;
  return resolvedGlobalColumn;
};

const resolveNoteIdColumn = async () => {
  resolvedNoteIdColumn = NOTE_ID_COLUMN;
  return resolvedNoteIdColumn;
};

const selectColumns = (noteIdColumn, globalColumn) =>
  `${noteIdColumn}, user_id, title, description, ${globalColumn}, created_at, updated_at`;

export const getFloatingNotesForUser = async (userId) => {
  const numericUserId = Number(userId);
  // `> 0`, not just isInteger. Number(null) is 0, which IS an integer, so an
  // unresolved user id sailed through this guard and issued a real query for
  // user_id=0 — visible in production as a guaranteed-empty
  // floating_note_shares?user_id=eq.0 request on every page load. users.user_id
  // is a positive identity column, so 0 can never match a row.
  if (!Number.isInteger(numericUserId) || numericUserId <= 0) return [];

  const noteIdColumn = await resolveNoteIdColumn();
  const globalColumn = await resolveGlobalColumn();
  let sharedNoteIds = [];

  const { data: shareRows, error: shareError } = await supabase
    .from(SHARE_TABLE)
    .select("note_id")
    .eq("user_id", numericUserId);

  if (!shareError) {
    sharedNoteIds = (shareRows || [])
      .map((row) => Number(row.note_id))
      .filter((noteId) => Number.isInteger(noteId));
  }

  const filters = [`user_id.eq.${numericUserId}`, `${globalColumn}.eq.true`];
  if (sharedNoteIds.length > 0) {
    filters.push(`${noteIdColumn}.in.(${sharedNoteIds.join(",")})`);
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select(selectColumns(noteIdColumn, globalColumn))
    .or(filters.join(","))
    .order("created_at", { ascending: true });

  if (error) {
    logFailure("Failed to load floating notes:", error);
    return [];
  }

  const visibleRows = data || [];
  const visibleNoteIds = visibleRows
    .map((row) => Number(row[noteIdColumn]))
    .filter((noteId) => Number.isInteger(noteId));
  const sharedUserCounts = new Map();

  if (visibleNoteIds.length > 0) {
    const { data: visibleShareRows, error: visibleShareError } = await supabase
      .from(SHARE_TABLE)
      .select("note_id, user_id")
      .in("note_id", visibleNoteIds);

    if (!visibleShareError) {
      for (const shareRow of visibleShareRows || []) {
        const sharedNoteId = Number(shareRow.note_id);
        if (!Number.isInteger(sharedNoteId)) continue;
        sharedUserCounts.set(sharedNoteId, (sharedUserCounts.get(sharedNoteId) || 0) + 1);
      }
    }
  }

  const directlySharedNoteIds = new Set(sharedNoteIds);
  return visibleRows.map((row) => {
    const noteId = Number(row[noteIdColumn]);
    const sharedUserCount = sharedUserCounts.get(noteId) || 0;
    return mapRow(row, globalColumn, noteIdColumn, {
      isShared: directlySharedNoteIds.has(noteId) || sharedUserCount > 0,
      sharedWithCurrentUser: directlySharedNoteIds.has(noteId),
      sharedUserCount,
    });
  });
};

// Customers live in the same `users` table as staff, so sharing is restricted to
// staff accounts. `isCustomerRole` only matches the exact configured customer
// roles, so also reject any variant of them ("Customer Portal", "customer") and
// any account with no role at all.
const isShareableStaffRole = (role) => {
  const normalized = String(role || "").trim().toLowerCase();
  if (!normalized) return false;
  if (isCustomerRole(role)) return false;
  return !CUSTOMER_ROLES.some((customerRole) =>
    normalized.includes(String(customerRole).trim().toLowerCase())
  );
};

const getShareableUsers = async () => {
  const { data, error } = await supabase
    .from("users")
    .select("user_id, first_name, last_name, email, role, is_active")
    .neq("email", ALL_ACCESS_EMAIL) // the demo account is invisible to everyone else
    .eq("is_active", true)
    .order("first_name", { ascending: true })
    .order("last_name", { ascending: true });

  if (error) {
    logFailure("Failed to load shareable users:", error);
    return [];
  }

  return (data || [])
    .filter((row) => isShareableStaffRole(row.role))
    .map((row) => ({
      userId: row.user_id,
      firstName: row.first_name || "",
      lastName: row.last_name || "",
      email: row.email || "",
    }));
};

const getValidStaffUserIds = async (userIds = []) => {
  if (userIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from("users")
    .select("user_id, role, is_active")
    .in("user_id", userIds)
    .eq("is_active", true);

  if (error) return { data: [], error };
  return {
    data: (data || [])
      .filter((row) => isShareableStaffRole(row.role))
      .map((row) => Number(row.user_id))
      .filter((userId) => Number.isInteger(userId)),
    error: null,
  };
};

const getNoteSharedUserIds = async (noteId) => {
  const numericNoteId = Number(noteId);
  if (!Number.isInteger(numericNoteId)) return [];

  const { data, error } = await supabase
    .from(SHARE_TABLE)
    .select("user_id")
    .eq("note_id", numericNoteId);

  if (error) {
    logFailure("Failed to load note shared users:", error);
    return [];
  }

  return (data || [])
    .map((row) => Number(row.user_id))
    .filter((userId) => Number.isInteger(userId));
};

const getOwnedNote = async (noteId, ownerUserId) => {
  const numericNoteId = Number(noteId);
  const numericOwnerUserId = Number(ownerUserId);
  if (!Number.isInteger(numericNoteId) || !Number.isInteger(numericOwnerUserId)) {
    return { data: null, error: null };
  }

  const noteIdColumn = await resolveNoteIdColumn();
  return supabase
    .from(TABLE)
    .select(`${noteIdColumn}, user_id`)
    .eq(noteIdColumn, numericNoteId)
    .eq("user_id", numericOwnerUserId)
    .maybeSingle();
};

export const getFloatingNoteShareOptions = async (noteId, ownerUserId) => {
  const ownedNote = await getOwnedNote(noteId, ownerUserId);
  if (ownedNote.error) {
    return { success: false, error: { message: ownedNote.error.message } };
  }
  if (!ownedNote.data) return inaccessibleNoteResult();

  const [users, sharedUserIds] = await Promise.all([
    getShareableUsers(),
    getNoteSharedUserIds(noteId),
  ]);
  const numericOwnerUserId = Number(ownerUserId);
  const availableUserIds = new Set(users.map((userRow) => Number(userRow.userId)));

  return {
    success: true,
    data: {
      users: users.filter((userRow) => Number(userRow.userId) !== numericOwnerUserId),
      sharedUserIds: sharedUserIds.filter((userId) => availableUserIds.has(Number(userId))),
    },
  };
};

export const setNoteSharedUsers = async ({ noteId, ownerUserId, userIds = [] }) => {
  const numericNoteId = Number(noteId);
  const numericOwnerUserId = Number(ownerUserId);

  if (!Number.isInteger(numericNoteId)) {
    return invalidIdResult("A valid note id is required");
  }

  if (!Number.isInteger(numericOwnerUserId)) {
    return invalidIdResult("A valid user id is required");
  }

  const cleanedUserIds = Array.from(
    new Set(
      (userIds || [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0 && value !== numericOwnerUserId)
    )
  );

  const ownedNote = await getOwnedNote(numericNoteId, numericOwnerUserId);
  if (ownedNote.error) {
    return { success: false, error: { message: ownedNote.error.message } };
  }
  if (!ownedNote.data) return inaccessibleNoteResult();

  const validStaffUsers = await getValidStaffUserIds(cleanedUserIds);
  if (validStaffUsers.error) {
    return { success: false, error: { message: validStaffUsers.error.message } };
  }
  const staffUserIds = validStaffUsers.data;

  const { error: deleteError } = await supabase.from(SHARE_TABLE).delete().eq("note_id", numericNoteId);
  if (deleteError) {
    logFailure("Failed to clear note shared users:", deleteError);
    return { success: false, error: { message: deleteError.message } };
  }

  if (staffUserIds.length === 0) {
    return { success: true, data: [] };
  }

  const payload = staffUserIds.map((userId) => ({
    note_id: numericNoteId,
    user_id: userId,
    shared_by: numericOwnerUserId,
  }));

  const { error: insertError } = await supabase.from(SHARE_TABLE).insert(payload);
  if (insertError) {
    logFailure("Failed to save note shared users:", insertError);
    return { success: false, error: { message: insertError.message } };
  }

  return { success: true, data: staffUserIds };
};

export const createFloatingNote = async ({ userId, title, description }) => {
  const numericUserId = Number(userId);
  if (!Number.isInteger(numericUserId)) {
    return { success: false, error: { message: "A valid user id is required" } };
  }

  const noteIdColumn = await resolveNoteIdColumn();
  const globalColumn = await resolveGlobalColumn();
  const payload = {
    user_id: numericUserId,
    title: String(title ?? "").slice(0, 200),
    description: String(description ?? ""),
    // New notes always start private. Sharing is a separate, deliberate owner action.
    [globalColumn]: false,
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert([payload])
    .select(selectColumns(noteIdColumn, globalColumn))
    .single();

  if (error) {
    logFailure("Failed to create floating note:", error);
    return { success: false, error: { message: error.message } };
  }

  return { success: true, data: mapRow(data, globalColumn, noteIdColumn) };
};

export const updateFloatingNote = async (noteId, ownerUserId, updates = {}) => {
  const numericNoteId = Number(noteId);
  const numericOwnerUserId = Number(ownerUserId);
  if (!Number.isInteger(numericNoteId)) {
    return invalidIdResult("A valid note id is required");
  }
  if (!Number.isInteger(numericOwnerUserId)) {
    return invalidIdResult("A valid user id is required");
  }

  const noteIdColumn = await resolveNoteIdColumn();
  const globalColumn = await resolveGlobalColumn();
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(updates, "title")) {
    payload.title = String(updates.title || "").slice(0, 200);
  }

  if (Object.prototype.hasOwnProperty.call(updates, "description")) {
    payload.description = String(updates.description || "");
  }

  if (Object.prototype.hasOwnProperty.call(updates, "isGlobal")) {
    payload[globalColumn] = Boolean(updates.isGlobal);
  }

  if (Object.keys(payload).length === 0) {
    return { success: true };
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(payload)
    .eq(noteIdColumn, numericNoteId)
    .eq("user_id", numericOwnerUserId)
    .select(selectColumns(noteIdColumn, globalColumn))
    .maybeSingle();

  if (error) {
    logFailure("Failed to update floating note:", error);
    return { success: false, error: { message: error.message } };
  }
  if (!data) return inaccessibleNoteResult();

  return { success: true, data: mapRow(data, globalColumn, noteIdColumn) };
};

export const deleteFloatingNote = async (noteId, ownerUserId) => {
  const numericNoteId = Number(noteId);
  const numericOwnerUserId = Number(ownerUserId);
  if (!Number.isInteger(numericNoteId)) {
    return invalidIdResult("A valid note id is required");
  }
  if (!Number.isInteger(numericOwnerUserId)) {
    return invalidIdResult("A valid user id is required");
  }

  // Authorise before touching dependent share rows. The browser can request a
  // note id, but only the server-resolved owner may mutate that note.
  const ownedNote = await getOwnedNote(numericNoteId, numericOwnerUserId);
  if (ownedNote.error) {
    return { success: false, error: { message: ownedNote.error.message } };
  }
  if (!ownedNote.data) return inaccessibleNoteResult();

  // The schema does not currently cascade floating_note_shares when its note
  // is deleted, so clear those dependent rows first to avoid orphaned shares.
  const { error: shareDeleteError } = await supabase
    .from(SHARE_TABLE)
    .delete()
    .eq("note_id", numericNoteId);

  if (shareDeleteError) {
    logFailure("Failed to clear floating note shares:", shareDeleteError);
    return { success: false, error: { message: shareDeleteError.message } };
  }

  const noteIdColumn = await resolveNoteIdColumn();
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq(noteIdColumn, numericNoteId)
    .eq("user_id", numericOwnerUserId);

  if (error) {
    logFailure("Failed to delete floating note:", error);
    return { success: false, error: { message: error.message } };
  }

  return { success: true };
};
