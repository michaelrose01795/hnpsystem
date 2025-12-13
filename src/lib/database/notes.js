// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/lib/database/notes.js
import { supabase } from "@/lib/supabaseClient";

/* ============================================
   CREATE JOB NOTE
   ✅ Enhanced with user tracking
============================================ */
export const createJobNote = async (noteData) => {
  console.log("➕ createJobNote called with:", noteData); // debug log
  
  try {
    // ✅ Validate required fields
    if (!noteData.job_id) {
      throw new Error("Job ID is required");
    }
    if (!noteData.note_text || noteData.note_text.trim() === "") {
      throw new Error("Note text cannot be empty");
    }

    const { data, error } = await supabase
      .from("job_notes")
      .insert([{
        job_id: noteData.job_id,
        user_id: noteData.user_id || null, // ✅ Track who created the note
        last_updated_by: noteData.user_id || null,
        note_text: noteData.note_text.trim(),
        hidden_from_customer: noteData.hidden_from_customer !== undefined ? noteData.hidden_from_customer : true, // Default: hidden
        created_at: new Date().toISOString()
      }])
      .select(`
        note_id,
        job_id,
        user_id,
        last_updated_by,
        note_text,
        hidden_from_customer,
        created_at,
        updated_at,
        user:user_id(
          user_id,
          first_name,
          last_name,
          email,
          role
        ),
        updatedBy:last_updated_by(
          user_id,
          first_name,
          last_name,
          email
        )
      `)
      .single();

    if (error) throw error;

    console.log("✅ Job note created:", data); // debug log
    return { success: true, data };
  } catch (error) {
    console.error("❌ createJobNote error:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   GET NOTES BY JOB
   ✅ Enhanced with user info and sorting
============================================ */
export const getNotesByJob = async (jobId) => {
  console.log("🔍 getNotesByJob for job:", jobId); // debug log
  
  try {
    const { data, error } = await supabase
      .from("job_notes")
      .select(`
        note_id,
        job_id,
        user_id,
        note_text,
        hidden_from_customer,
        created_at,
        updated_at,
        last_updated_by,
        user:user_id(
          user_id,
          first_name,
          last_name,
          email,
          role
        ),
        updatedBy:last_updated_by(
          user_id,
          first_name,
          last_name,
          email
        )
      `)
      .eq("job_id", jobId)
      .order("created_at", { ascending: false }); // newest first

    if (error) throw error;

    console.log("✅ Notes found:", data?.length || 0); // debug log
    
    // ✅ Format notes for display
    const formattedNotes = (data || []).map(note => {
      const creatorName = note.user
        ? `${note.user.first_name || ""} ${note.user.last_name || ""}`.trim()
        : "Unknown";
      const updaterName = note.updatedBy
        ? `${note.updatedBy.first_name || ""} ${note.updatedBy.last_name || ""}`.trim()
        : creatorName;
      return {
        noteId: note.note_id,
        jobId: note.job_id,
        userId: note.user_id,
        noteText: note.note_text,
        hiddenFromCustomer: note.hidden_from_customer !== null ? note.hidden_from_customer : true,
        createdAt: note.created_at,
        updatedAt: note.updated_at,
        createdBy: creatorName || "Unknown",
        createdByEmail: note.user?.email || "",
        createdByRole: note.user?.role || "",
        lastUpdatedBy: updaterName || "Unknown",
        lastUpdatedByEmail: note.updatedBy?.email || note.user?.email || "",
        lastUpdatedById: note.last_updated_by || note.user_id || null
      };
    });

    return formattedNotes;
  } catch (error) {
    console.error("❌ getNotesByJob error:", error);
    return [];
  }
};

/* ============================================
   GET ALL NOTES
   ✅ NEW: Get all notes with pagination
============================================ */
export const getAllNotes = async (limit = 100, offset = 0) => {
  console.log("🔍 getAllNotes - limit:", limit, "offset:", offset); // debug log
  
  try {
    const { data, error, count } = await supabase
      .from("job_notes")
      .select(`
        note_id,
        job_id,
        user_id,
        note_text,
        created_at,
        updated_at,
        job:job_id(
          job_number,
          vehicle_reg,
          customer_id
        ),
        user:user_id(
          first_name,
          last_name,
          email
        )
      `, { count: 'exact' })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    console.log("✅ All notes fetched:", data?.length || 0, "Total:", count); // debug log
    return { success: true, data: data || [], count: count || 0 };
  } catch (error) {
    console.error("❌ getAllNotes error:", error);
    return { success: false, data: [], count: 0, error: { message: error.message } };
  }
};

/* ============================================
   UPDATE NOTE
   ✅ Enhanced with updated_at tracking
============================================ */
export const updateJobNote = async (noteId, updates, userId = null) => {
  console.log("🔄 updateJobNote:", noteId, "userId:", userId); // debug log

  try {
    // ✅ Handle both old API (string) and new API (object)
    const updateData = typeof updates === 'string'
      ? { note_text: updates.trim() }
      : {
          ...(updates.noteText !== undefined && { note_text: updates.noteText.trim() }),
          ...(updates.hiddenFromCustomer !== undefined && { hidden_from_customer: updates.hiddenFromCustomer })
        };

    // ✅ Validate
    if (updateData.note_text !== undefined && updateData.note_text === "") {
      throw new Error("Note text cannot be empty");
    }

    const { data, error } = await supabase
      .from("job_notes")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
        last_updated_by: userId || null
      })
      .eq("note_id", noteId)
      .select(`
        note_id,
        job_id,
        user_id,
        last_updated_by,
        note_text,
        hidden_from_customer,
        created_at,
        updated_at,
        user:user_id(
          first_name,
          last_name,
          email
        ),
        updatedBy:last_updated_by(
          user_id,
          first_name,
          last_name,
          email
        )
      `)
      .single();

    if (error) throw error;

    console.log("✅ Note updated:", data); // debug log
    return { success: true, data };
  } catch (error) {
    console.error("❌ updateJobNote error:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   DELETE NOTE
   ✅ Enhanced with safety check
============================================ */
export const deleteJobNote = async (noteId, userId = null) => {
  console.log("🗑️ deleteJobNote:", noteId, "by user:", userId); // debug log
  
  try {
    // ✅ Optional: Check if user owns the note before deleting
    if (userId) {
      const { data: note } = await supabase
        .from("job_notes")
        .select("user_id")
        .eq("note_id", noteId)
        .single();

      if (note && note.user_id !== userId) {
        throw new Error("You can only delete your own notes");
      }
    }

    const { error } = await supabase
      .from("job_notes")
      .delete()
      .eq("note_id", noteId);

    if (error) throw error;

    console.log("✅ Note deleted successfully"); // debug log
    return { success: true };
  } catch (error) {
    console.error("❌ deleteJobNote error:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   SEARCH NOTES
   ✅ NEW: Search notes by text content
============================================ */
export const searchNotes = async (searchTerm, jobId = null) => {
  console.log("🔍 searchNotes:", searchTerm, "jobId:", jobId); // debug log
  
  try {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return [];
    }

    let query = supabase
      .from("job_notes")
      .select(`
        note_id,
        job_id,
        user_id,
        note_text,
        created_at,
        updated_at,
        job:job_id(
          job_number,
          vehicle_reg
        ),
        user:user_id(
          first_name,
          last_name
        )
      `)
      .ilike("note_text", `%${searchTerm}%`)
      .order("created_at", { ascending: false })
      .limit(50);

    // ✅ Filter by job if provided
    if (jobId) {
      query = query.eq("job_id", jobId);
    }

    const { data, error } = await query;

    if (error) throw error;

    console.log("✅ Search results:", data?.length || 0, "notes"); // debug log
    return data || [];
  } catch (error) {
    console.error("❌ searchNotes error:", error);
    return [];
  }
};

/* ============================================
   GET RECENT NOTES
   ✅ NEW: Get most recent notes across all jobs
============================================ */
export const getRecentNotes = async (limit = 10) => {
  console.log("🔍 getRecentNotes - limit:", limit); // debug log
  
  try {
    const { data, error } = await supabase
      .from("job_notes")
      .select(`
        note_id,
        job_id,
        user_id,
        note_text,
        created_at,
        job:job_id(
          job_number,
          vehicle_reg,
          customer_id
        ),
        user:user_id(
          first_name,
          last_name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    console.log("✅ Recent notes fetched:", data?.length || 0); // debug log
    return data || [];
  } catch (error) {
    console.error("❌ getRecentNotes error:", error);
    return [];
  }
};

/* ============================================
   GET NOTES BY USER
   ✅ NEW: Get all notes created by a specific user
============================================ */
export const getNotesByUser = async (userId) => {
  console.log("🔍 getNotesByUser:", userId); // debug log
  
  try {
    const { data, error } = await supabase
      .from("job_notes")
      .select(`
        note_id,
        job_id,
        user_id,
        note_text,
        created_at,
        updated_at,
        job:job_id(
          job_number,
          vehicle_reg
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    console.log("✅ User notes found:", data?.length || 0); // debug log
    return data || [];
  } catch (error) {
    console.error("❌ getNotesByUser error:", error);
    return [];
  }
};

/* ============================================
   BULK CREATE NOTES
   ✅ NEW: Create multiple notes at once
============================================ */
export const bulkCreateNotes = async (notes) => {
  console.log("➕ bulkCreateNotes - count:", notes.length); // debug log
  
  try {
    if (!notes || notes.length === 0) {
      throw new Error("No notes provided");
    }

    // ✅ Validate all notes
    const validNotes = notes.filter(note => 
      note.job_id && 
      note.note_text && 
      note.note_text.trim() !== ""
    );

    if (validNotes.length === 0) {
      throw new Error("No valid notes to create");
    }

    // ✅ Add timestamps
    const notesToInsert = validNotes.map(note => ({
      job_id: note.job_id,
      user_id: note.user_id || null,
      note_text: note.note_text.trim(),
      created_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from("job_notes")
      .insert(notesToInsert)
      .select();

    if (error) throw error;

    console.log("✅ Bulk notes created:", data?.length || 0); // debug log
    return { success: true, data };
  } catch (error) {
    console.error("❌ bulkCreateNotes error:", error);
    return { success: false, error: { message: error.message } };
  }
};
