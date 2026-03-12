import { supabase } from "@/lib/supabaseClient";

const TABLE = "floating_notes";
const SHARE_TABLE = "floating_note_shares";
let resolvedGlobalColumn = null;
let resolvedNoteIdColumn = null;

const mapRow = (row = {}, globalColumn = "is_global", noteIdColumn = "note_id") => ({
  noteId: row[noteIdColumn],
  userId: row.user_id,
  title: row.title || "",
  description: row.description || "",
  isGlobal: Boolean(row[globalColumn]),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const resolveGlobalColumn = async () => {
  if (resolvedGlobalColumn) return resolvedGlobalColumn;
  const noteIdColumn = await resolveNoteIdColumn();

  const tryIsGlobal = await supabase.from(TABLE).select(`${noteIdColumn}, is_global`).limit(1);
  if (!tryIsGlobal.error) {
    resolvedGlobalColumn = "is_global";
    return resolvedGlobalColumn;
  }

  const tryLegacy = await supabase.from(TABLE).select(`${noteIdColumn}, shared_all_users`).limit(1);
  if (!tryLegacy.error) {
    resolvedGlobalColumn = "shared_all_users";
    return resolvedGlobalColumn;
  }

  resolvedGlobalColumn = "is_global";
  return resolvedGlobalColumn;
};

const resolveNoteIdColumn = async () => {
  if (resolvedNoteIdColumn) return resolvedNoteIdColumn;

  const tryNoteId = await supabase.from(TABLE).select("note_id").limit(1);
  if (!tryNoteId.error) {
    resolvedNoteIdColumn = "note_id";
    return resolvedNoteIdColumn;
  }

  const tryId = await supabase.from(TABLE).select("id").limit(1);
  if (!tryId.error) {
    resolvedNoteIdColumn = "id";
    return resolvedNoteIdColumn;
  }

  resolvedNoteIdColumn = "note_id";
  return resolvedNoteIdColumn;
};

const selectColumns = (noteIdColumn, globalColumn) =>
  `${noteIdColumn}, user_id, title, description, ${globalColumn}, created_at, updated_at`;

export const getFloatingNotesForUser = async (userId) => {
  const numericUserId = Number(userId);
  if (!Number.isInteger(numericUserId)) return [];

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
    console.error("Failed to load floating notes:", error);
    return [];
  }

  return (data || []).map((row) => mapRow(row, globalColumn, noteIdColumn));
};

export const getShareableUsers = async () => {
  const { data, error } = await supabase
    .from("users")
    .select("user_id, first_name, last_name, email")
    .order("first_name", { ascending: true })
    .order("last_name", { ascending: true });

  if (error) {
    console.error("Failed to load shareable users:", error);
    return [];
  }

  return (data || []).map((row) => ({
    userId: row.user_id,
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    email: row.email || "",
  }));
};

export const getNoteSharedUserIds = async (noteId) => {
  const numericNoteId = Number(noteId);
  if (!Number.isInteger(numericNoteId)) return [];

  const { data, error } = await supabase
    .from(SHARE_TABLE)
    .select("user_id")
    .eq("note_id", numericNoteId);

  if (error) {
    console.error("Failed to load note shared users:", error);
    return [];
  }

  return (data || [])
    .map((row) => Number(row.user_id))
    .filter((userId) => Number.isInteger(userId));
};

export const setNoteSharedUsers = async ({ noteId, sharedByUserId, userIds = [] }) => {
  const numericNoteId = Number(noteId);
  const numericSharedBy = Number(sharedByUserId);

  if (!Number.isInteger(numericNoteId)) {
    return { success: false, error: { message: "A valid note id is required" } };
  }

  if (!Number.isInteger(numericSharedBy)) {
    return { success: false, error: { message: "A valid user id is required" } };
  }

  const cleanedUserIds = Array.from(
    new Set(
      (userIds || [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value))
    )
  );

  const { error: deleteError } = await supabase.from(SHARE_TABLE).delete().eq("note_id", numericNoteId);
  if (deleteError) {
    console.error("Failed to clear note shared users:", deleteError);
    return { success: false, error: { message: deleteError.message } };
  }

  if (cleanedUserIds.length === 0) {
    return { success: true, data: [] };
  }

  const payload = cleanedUserIds.map((userId) => ({
    note_id: numericNoteId,
    user_id: userId,
    shared_by: numericSharedBy,
  }));

  const { error: insertError } = await supabase.from(SHARE_TABLE).insert(payload);
  if (insertError) {
    console.error("Failed to save note shared users:", insertError);
    return { success: false, error: { message: insertError.message } };
  }

  return { success: true, data: cleanedUserIds };
};

export const createFloatingNote = async ({ userId, title, description, isGlobal = false }) => {
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
    [globalColumn]: Boolean(isGlobal),
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert([payload])
    .select(selectColumns(noteIdColumn, globalColumn))
    .single();

  if (error) {
    console.error("Failed to create floating note:", error);
    return { success: false, error: { message: error.message } };
  }

  return { success: true, data: mapRow(data, globalColumn, noteIdColumn) };
};

export const updateFloatingNote = async (noteId, updates = {}) => {
  const numericNoteId = Number(noteId);
  if (!Number.isInteger(numericNoteId)) {
    return { success: false, error: { message: "A valid note id is required" } };
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
    .select(selectColumns(noteIdColumn, globalColumn))
    .single();

  if (error) {
    console.error("Failed to update floating note:", error);
    return { success: false, error: { message: error.message } };
  }

  return { success: true, data: mapRow(data, globalColumn, noteIdColumn) };
};

export const deleteFloatingNote = async (noteId) => {
  const numericNoteId = Number(noteId);
  if (!Number.isInteger(numericNoteId)) {
    return { success: false, error: { message: "A valid note id is required" } };
  }

  const noteIdColumn = await resolveNoteIdColumn();
  const { error } = await supabase.from(TABLE).delete().eq(noteIdColumn, numericNoteId);

  if (error) {
    console.error("Failed to delete floating note:", error);
    return { success: false, error: { message: error.message } };
  }

  return { success: true };
};
