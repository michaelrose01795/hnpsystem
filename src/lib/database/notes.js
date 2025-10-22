// ✅ File location: src/lib/database/notes.js
import { supabase } from "../supabaseClient";

/* ============================================
   CREATE JOB NOTE
============================================ */
export const createJobNote = async (noteData) => {
  const { data, error } = await supabase
    .from("job_notes")
    .insert([{
      job_id: noteData.job_id,
      note_text: noteData.note_text,
      created_by: noteData.created_by || null,
      created_at: new Date().toISOString()
    }])
    .select()
    .single();

  return { success: !error, data, error };
};

/* ============================================
   GET NOTES BY JOB
============================================ */
export const getNotesByJob = async (jobId) => {
  const { data, error } = await supabase
    .from("job_notes")
    .select(`
      note_id,
      note_text,
      created_at,
      created_by,
      user:created_by(first_name, last_name)
    `)
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  return error ? [] : data;
};

/* ============================================
   UPDATE NOTE
============================================ */
export const updateJobNote = async (noteId, noteText) => {
  const { data, error } = await supabase
    .from("job_notes")
    .update({ 
      note_text: noteText,
      updated_at: new Date().toISOString()
    })
    .eq("note_id", noteId)
    .select()
    .single();

  return { success: !error, data, error };
};

/* ============================================
   DELETE NOTE
============================================ */
export const deleteJobNote = async (noteId) => {
  const { error } = await supabase
    .from("job_notes")
    .delete()
    .eq("note_id", noteId);

  return { success: !error, error };
};