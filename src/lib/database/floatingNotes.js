import { supabase } from "@/lib/supabaseClient";

const TABLE = "floating_notes";
let resolvedGlobalColumn = null;
let resolvedIdColumn = null;

const mapRow = (row = {}, globalColumn = "is_global", idColumn = "id") => ({
  noteId: row[idColumn],
  userId: row.user_id,
  title: row.title || "",
  description: row.description || "",
  isGlobal: Boolean(row[globalColumn]),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const resolveGlobalColumn = async () => {
  if (resolvedGlobalColumn) return resolvedGlobalColumn;

  const tryIsGlobal = await supabase.from(TABLE).select("note_id, is_global").limit(1);
  if (!tryIsGlobal.error) {
    resolvedGlobalColumn = "is_global";
    return resolvedGlobalColumn;
  }

  const tryLegacy = await supabase.from(TABLE).select("note_id, shared_all_users").limit(1);
  if (!tryLegacy.error) {
    resolvedGlobalColumn = "shared_all_users";
    return resolvedGlobalColumn;
  }

  resolvedGlobalColumn = "is_global";
  return resolvedGlobalColumn;
};

const resolveIdColumn = async () => {
  if (resolvedIdColumn) return resolvedIdColumn;

  const tryId = await supabase.from(TABLE).select("id").limit(1);
  if (!tryId.error) {
    resolvedIdColumn = "id";
    return resolvedIdColumn;
  }

  const tryNoteId = await supabase.from(TABLE).select("note_id").limit(1);
  if (!tryNoteId.error) {
    resolvedIdColumn = "note_id";
    return resolvedIdColumn;
  }

  resolvedIdColumn = "id";
  return resolvedIdColumn;
};

const selectColumns = (idColumn, globalColumn) =>
  `${idColumn}, user_id, title, description, ${globalColumn}, created_at, updated_at`;

export const getFloatingNotesForUser = async (userId) => {
  const numericUserId = Number(userId);
  if (!Number.isInteger(numericUserId)) return [];

  const idColumn = await resolveIdColumn();
  const globalColumn = await resolveGlobalColumn();
  const { data, error } = await supabase
    .from(TABLE)
    .select(selectColumns(idColumn, globalColumn))
    .or(`user_id.eq.${numericUserId},${globalColumn}.eq.true`)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load floating notes:", error);
    return [];
  }

  return (data || []).map((row) => mapRow(row, globalColumn, idColumn));
};

export const createFloatingNote = async ({ userId, title, description, isGlobal = false }) => {
  const numericUserId = Number(userId);
  if (!Number.isInteger(numericUserId)) {
    return { success: false, error: { message: "A valid user id is required" } };
  }

  const idColumn = await resolveIdColumn();
  const globalColumn = await resolveGlobalColumn();
  const payload = {
    user_id: numericUserId,
    title: String(title || "New note").slice(0, 200),
    description: String(description || ""),
    [globalColumn]: Boolean(isGlobal),
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert([payload])
    .select(selectColumns(idColumn, globalColumn))
    .single();

  if (error) {
    console.error("Failed to create floating note:", error);
    return { success: false, error: { message: error.message } };
  }

  return { success: true, data: mapRow(data, globalColumn, idColumn) };
};

export const updateFloatingNote = async (noteId, updates = {}) => {
  const numericNoteId = Number(noteId);
  if (!Number.isInteger(numericNoteId)) {
    return { success: false, error: { message: "A valid note id is required" } };
  }

  const idColumn = await resolveIdColumn();
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
    .eq(idColumn, numericNoteId)
    .select(selectColumns(idColumn, globalColumn))
    .single();

  if (error) {
    console.error("Failed to update floating note:", error);
    return { success: false, error: { message: error.message } };
  }

  return { success: true, data: mapRow(data, globalColumn, idColumn) };
};

export const deleteFloatingNote = async (noteId) => {
  const numericNoteId = Number(noteId);
  if (!Number.isInteger(numericNoteId)) {
    return { success: false, error: { message: "A valid note id is required" } };
  }

  const idColumn = await resolveIdColumn();
  const { error } = await supabase.from(TABLE).delete().eq(idColumn, numericNoteId);

  if (error) {
    console.error("Failed to delete floating note:", error);
    return { success: false, error: { message: error.message } };
  }

  return { success: true };
};
