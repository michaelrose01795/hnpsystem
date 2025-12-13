// ✅ New NotesTab with Multiple Notes Support
// file location: src/components/NotesTab_New.js
import React, { useState, useEffect } from "react";
import { getNotesByJob, createJobNote, updateJobNote, deleteJobNote } from "@/lib/database/notes";

export default function NotesTabNew({ jobData, canEdit, actingUserNumericId }) {
  const jobId = jobData?.id;
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteHidden, setNewNoteHidden] = useState(true); // Default: hidden from customer
  const [savingNewNote, setSavingNewNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [error, setError] = useState("");

  // Load notes
  useEffect(() => {
    if (!jobId) return;
    loadNotes();
  }, [jobId]);

  const loadNotes = async () => {
    setLoading(true);
    setError("");
    try {
      const fetchedNotes = await getNotesByJob(jobId);
      setNotes(fetchedNotes || []);
    } catch (err) {
      console.error("Failed to load notes:", err);
      setError("Failed to load notes");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!canEdit || !newNoteText.trim()) return;

    setSavingNewNote(true);
    setError("");
    try {
      const result = await createJobNote({
        job_id: jobId,
        user_id: actingUserNumericId,
        note_text: newNoteText.trim(),
        hidden_from_customer: newNoteHidden,
      });

      if (result.success) {
        setNewNoteText("");
        setNewNoteHidden(true); // Reset to default
        await loadNotes();
      } else {
        setError(result.error?.message || "Failed to create note");
      }
    } catch (err) {
      console.error("Failed to add note:", err);
      setError("Failed to add note");
    } finally {
      setSavingNewNote(false);
    }
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note.noteId);
    setEditingNoteText(note.noteText);
  };

  const handleSaveEdit = async (noteId) => {
    if (!editingNoteText.trim()) return;

    try {
      const result = await updateJobNote(
        noteId,
        { noteText: editingNoteText.trim() },
        actingUserNumericId
      );

      if (result.success) {
        setEditingNoteId(null);
        setEditingNoteText("");
        await loadNotes();
      } else {
        setError(result.error?.message || "Failed to update note");
      }
    } catch (err) {
      console.error("Failed to update note:", err);
      setError("Failed to update note");
    }
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingNoteText("");
  };

  const handleToggleHiddenFromCustomer = async (note) => {
    if (!canEdit) return;

    try {
      const result = await updateJobNote(
        note.noteId,
        { hiddenFromCustomer: !note.hiddenFromCustomer },
        actingUserNumericId
      );

      if (result.success) {
        await loadNotes();
      } else {
        setError(result.error?.message || "Failed to toggle visibility");
      }
    } catch (err) {
      console.error("Failed to toggle visibility:", err);
      setError("Failed to toggle visibility");
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!canEdit) return;
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      const result = await deleteJobNote(noteId, actingUserNumericId);

      if (result.success) {
        await loadNotes();
      } else {
        setError(result.error?.message || "Failed to delete note");
      }
    } catch (err) {
      console.error("Failed to delete note:", err);
      setError("Failed to delete note");
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "Unknown";
    try {
      return new Date(dateString).toLocaleString("en-GB", {
        hour12: false,
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Unknown";
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "var(--info)" }}>
        Loading notes...
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "var(--text-primary)" }}>
        Job Notes
      </h2>

      {error && (
        <div
          style={{
            padding: "12px",
            marginBottom: "16px",
            borderRadius: "8px",
            backgroundColor: "var(--warning-surface)",
            color: "var(--danger)",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      {/* Add New Note */}
      {canEdit && (
        <div
          style={{
            padding: "16px",
            backgroundColor: "var(--surface)",
            borderRadius: "12px",
            border: "1px solid var(--surface-light)",
            marginBottom: "20px",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--primary)", marginBottom: "12px" }}>
            Add New Note
          </div>
          <textarea
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Type your note here..."
            style={{
              width: "100%",
              minHeight: "100px",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid var(--surface-light)",
              fontSize: "14px",
              lineHeight: 1.6,
              resize: "vertical",
              backgroundColor: "var(--surface)",
              color: "var(--info-dark)",
              marginBottom: "12px",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--info-dark)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={newNoteHidden}
                onChange={(e) => setNewNoteHidden(e.target.checked)}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              Hide from customer
            </label>
            <button
              onClick={handleAddNote}
              disabled={!newNoteText.trim() || savingNewNote}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: !newNoteText.trim() || savingNewNote ? "var(--info)" : "var(--accent-purple)",
                color: "white",
                fontWeight: 600,
                fontSize: "14px",
                cursor: !newNoteText.trim() || savingNewNote ? "not-allowed" : "pointer",
              }}
            >
              {savingNewNote ? "Adding..." : "Add Note"}
            </button>
          </div>
        </div>
      )}

      {/* Notes List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {notes.length === 0 ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              backgroundColor: "var(--info-surface)",
              borderRadius: "12px",
              border: "1px solid var(--surface-light)",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>📝</div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--accent-purple)", marginBottom: "4px" }}>
              No Notes Yet
            </div>
            <p style={{ color: "var(--info)", fontSize: "14px", margin: 0 }}>
              {canEdit ? "Add your first note above" : "No notes have been added to this job"}
            </p>
          </div>
        ) : (
          notes.map((note) => {
            const isEditing = editingNoteId === note.noteId;

            return (
              <div
                key={note.noteId}
                style={{
                  padding: "16px",
                  backgroundColor: "var(--surface)",
                  borderRadius: "12px",
                  border: `2px solid ${note.hiddenFromCustomer ? "var(--warning-surface)" : "var(--success-surface)"}`,
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent-purple)" }}>
                      {note.createdBy}
                      {note.createdByEmail && (
                        <span style={{ fontSize: "11px", color: "var(--info)", fontWeight: 400, marginLeft: "6px" }}>
                          ({note.createdByEmail})
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--info)", marginTop: "2px" }}>
                      Created: {formatDateTime(note.createdAt)}
                      {note.updatedAt !== note.createdAt && (
                        <span style={{ marginLeft: "8px" }}>
                          · Updated: {formatDateTime(note.updatedAt)} by {note.lastUpdatedBy}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "999px",
                        backgroundColor: note.hiddenFromCustomer ? "var(--warning-surface)" : "var(--success-surface)",
                        color: note.hiddenFromCustomer ? "var(--warning)" : "var(--success-dark)",
                        fontSize: "11px",
                        fontWeight: 600,
                      }}
                    >
                      {note.hiddenFromCustomer ? "Hidden" : "Visible"}
                    </span>
                  </div>
                </div>

                {/* Note Content */}
                {isEditing ? (
                  <div>
                    <textarea
                      value={editingNoteText}
                      onChange={(e) => setEditingNoteText(e.target.value)}
                      style={{
                        width: "100%",
                        minHeight: "100px",
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid var(--surface-light)",
                        fontSize: "14px",
                        lineHeight: 1.6,
                        resize: "vertical",
                        backgroundColor: "var(--surface)",
                        color: "var(--info-dark)",
                        marginBottom: "10px",
                      }}
                    />
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => handleSaveEdit(note.noteId)}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "6px",
                          border: "none",
                          backgroundColor: "var(--accent-purple)",
                          color: "white",
                          fontWeight: 600,
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "6px",
                          border: "1px solid var(--surface-light)",
                          backgroundColor: "var(--surface)",
                          color: "var(--info-dark)",
                          fontWeight: 600,
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: "14px",
                      color: "var(--info-dark)",
                      lineHeight: 1.7,
                      whiteSpace: "pre-wrap",
                      marginBottom: "12px",
                    }}
                  >
                    {note.noteText}
                  </div>
                )}

                {/* Actions */}
                {canEdit && !isEditing && (
                  <div style={{ display: "flex", gap: "12px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--surface-light)" }}>
                    <button
                      onClick={() => handleEditNote(note)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid var(--surface-light)",
                        backgroundColor: "var(--surface)",
                        color: "var(--accent-purple)",
                        fontWeight: 600,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleHiddenFromCustomer(note)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid var(--surface-light)",
                        backgroundColor: "var(--surface)",
                        color: "var(--info-dark)",
                        fontWeight: 600,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      {note.hiddenFromCustomer ? "Show to Customer" : "Hide from Customer"}
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.noteId)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid var(--danger-surface)",
                        backgroundColor: "var(--warning-surface)",
                        color: "var(--danger)",
                        fontWeight: 600,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
