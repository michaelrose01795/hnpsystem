// ✅ New NotesTab with Multiple Notes Support
// file location: src/components/NotesTab_New.js
import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { getNotesByJob, createJobNote, updateJobNote, deleteJobNote } from "@/lib/database/notes";
import { normalizeRequests } from "@/lib/jobcards/utils";

export default function NotesTabNew({
  jobData,
  canEdit,
  actingUserNumericId,
  onNotesChange,
  onNoteAdded,
  highlightNoteIds = []
}) {
  const jobId = jobData?.id;
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteHidden, setNewNoteHidden] = useState(true); // Default: hidden from customer
  const [showAddNote, setShowAddNote] = useState(false);
  const [savingNewNote, setSavingNewNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [error, setError] = useState("");
  const [linkingNote, setLinkingNote] = useState(null);

  const requestOptions = useMemo(() => normalizeRequests(jobData?.requests), [jobData?.requests]);
  const authorisedItems = useMemo(
    () =>
      (jobData?.vhcChecks || []).filter(
        (check) => String(check?.approval_status || "").toLowerCase() === "authorized"
      ),
    [jobData?.vhcChecks]
  );
  const authorisedParts = useMemo(() => {
    const parts = Array.isArray(jobData?.partsAllocations)
      ? jobData.partsAllocations
      : Array.isArray(jobData?.parts_job_items)
      ? jobData.parts_job_items
      : [];
    return parts.filter((part) => part?.authorised === true);
  }, [jobData?.partsAllocations, jobData?.parts_job_items]);
  const highlightedNoteIdSet = useMemo(
    () => new Set(Array.isArray(highlightNoteIds) ? highlightNoteIds : []),
    [highlightNoteIds]
  );

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
      const nextNotes = fetchedNotes || [];
      setNotes(nextNotes);
      if (typeof onNotesChange === "function") {
        onNotesChange(nextNotes);
      }
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
        const createdNoteId = result?.data?.note_id ?? null;
        if (createdNoteId && typeof onNoteAdded === "function") {
          onNoteAdded(createdNoteId);
        }
        setNewNoteText("");
        setNewNoteHidden(true); // Reset to default
        setShowAddNote(false);
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

  const resolveLinkLabel = (note) => {
    const requestCount = Array.isArray(note.linkedRequestIndices)
      ? note.linkedRequestIndices.length
      : 0;
    const vhcCount = Array.isArray(note.linkedVhcIds)
      ? note.linkedVhcIds.length
      : 0;
    const partCount = Array.isArray(note.linkedPartIds)
      ? note.linkedPartIds.length
      : 0;
    if (!requestCount && !vhcCount && !partCount) return "";
    const parts = [];
    if (requestCount) parts.push(`Requests ${requestCount}`);
    if (vhcCount) parts.push(`Authorised ${vhcCount}`);
    if (partCount) parts.push(`Parts ${partCount}`);
    return parts.join(" • ");
  };

  const handleLinkNote = async (note, link) => {
    if (!note?.noteId) return;
    const currentRequestLinks = Array.isArray(note.linkedRequestIndices)
      ? note.linkedRequestIndices
      : [];
    const currentVhcLinks = Array.isArray(note.linkedVhcIds)
      ? note.linkedVhcIds
      : [];
    const currentPartLinks = Array.isArray(note.linkedPartIds)
      ? note.linkedPartIds
      : [];
    let nextRequestLinks = currentRequestLinks;
    let nextVhcLinks = currentVhcLinks;
    let nextPartLinks = currentPartLinks;

    if (link?.clear) {
      nextRequestLinks = [];
      nextVhcLinks = [];
      nextPartLinks = [];
    } else if (Number.isInteger(link?.linkedRequestIndex)) {
      if (currentRequestLinks.includes(link.linkedRequestIndex)) {
        nextRequestLinks = currentRequestLinks.filter((value) => value !== link.linkedRequestIndex);
      } else {
        nextRequestLinks = [...currentRequestLinks, link.linkedRequestIndex].sort((a, b) => a - b);
      }
    } else if (Number.isInteger(link?.linkedVhcId)) {
      if (currentVhcLinks.includes(link.linkedVhcId)) {
        nextVhcLinks = currentVhcLinks.filter((value) => value !== link.linkedVhcId);
      } else {
        nextVhcLinks = [...currentVhcLinks, link.linkedVhcId];
      }
    } else if (Number.isInteger(link?.linkedPartId)) {
      if (currentPartLinks.includes(link.linkedPartId)) {
        nextPartLinks = currentPartLinks.filter((value) => value !== link.linkedPartId);
      } else {
        nextPartLinks = [...currentPartLinks, link.linkedPartId];
      }
    }
    try {
      const result = await updateJobNote(
        note.noteId,
        {
          linkedRequestIndex: nextRequestLinks[0] ?? null,
          linkedVhcId: nextVhcLinks[0] ?? null,
          linkedPartId: nextPartLinks[0] ?? null,
          linkedRequestIndices: nextRequestLinks,
          linkedVhcIds: nextVhcLinks,
          linkedPartIds: nextPartLinks,
        },
        actingUserNumericId
      );
      if (!result.success) {
        setError(result.error?.message || "Failed to link note");
        return;
      }
      await loadNotes();
    } catch (err) {
      console.error("Failed to link note:", err);
      setError("Failed to link note");
    }
  };

  const isLinkedToRequest = (note, index) =>
    Array.isArray(note?.linkedRequestIndices) &&
    note.linkedRequestIndices.includes(index + 1);
  const isLinkedToAuthorised = (note, item) =>
    Array.isArray(note?.linkedVhcIds) &&
    note.linkedVhcIds.includes(item?.vhc_id ?? item?.id ?? null);
  const isLinkedToPart = (note, partId) =>
    Array.isArray(note?.linkedPartIds) && note.linkedPartIds.includes(partId);

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
      <div style={{ padding: "20px", textAlign: "center", color: "var(--text-secondary)" }}>
        Loading notes...
      </div>
    );
  }

  const panelStyle = {
    background: "var(--surface)",
    border: "1px solid var(--surface-light)",
    borderRadius: "16px",
    padding: "18px",
  };
  return (
    <div style={panelStyle}>
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
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showAddNote ? "12px" : "20px" }}>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              {notes.length} note{notes.length === 1 ? "" : "s"}
            </div>
            <button
              onClick={() => setShowAddNote(true)}
              style={{
                padding: "10px 20px",
                backgroundColor: "var(--primary)",
                color: "var(--text-inverse)",
                border: "1px solid var(--primary)",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
                display: showAddNote ? "none" : "inline-flex",
              }}
            >
              Add New Note
            </button>
          </div>

          {showAddNote && (
            <div
              style={{
                padding: "20px",
                backgroundColor: "var(--layer-section-level-3)",
                borderRadius: "12px",
                border: "1px solid var(--surface-light)",
                marginBottom: "20px",
              }}
            >
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
                Add New Note
              </div>
              <textarea
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                onInput={(e) => {
                  e.currentTarget.style.height = "auto";
                  const next = Math.min(e.currentTarget.scrollHeight, 220);
                  e.currentTarget.style.height = `${next}px`;
                }}
                placeholder="Type your note here..."
                style={{
                  width: "100%",
                  height: "56px",
                  minHeight: "56px",
                  maxHeight: "220px",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(var(--grey-accent-rgb), 0.45)",
                  fontSize: "14px",
                  lineHeight: 1.6,
                  resize: "none",
                  overflowY: "auto",
                  backgroundColor: "var(--surface)",
                  color: "var(--text-primary)",
                  marginBottom: "12px",
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-secondary)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={newNoteHidden}
                    onChange={(e) => setNewNoteHidden(e.target.checked)}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  Hide from customer
                </label>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => {
                      setShowAddNote(false);
                      setNewNoteText("");
                    }}
                    style={{
                      padding: "10px 18px",
                      backgroundColor: "var(--surface)",
                      color: "var(--info)",
                      border: "1px solid var(--info)",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "500"
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddNote}
                    disabled={!newNoteText.trim() || savingNewNote}
                    style={{
                      padding: "10px 18px",
                      backgroundColor: !newNoteText.trim() || savingNewNote ? "var(--surface-light)" : "var(--info)",
                      color: !newNoteText.trim() || savingNewNote ? "var(--text-secondary)" : "white",
                      border: "1px solid var(--info-dark)",
                      borderRadius: "8px",
                      cursor: !newNoteText.trim() || savingNewNote ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    {savingNewNote ? "Saving..." : "Save Note"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Notes List */}
      <div
        style={{
          maxHeight: notes.length > 2 ? "460px" : "none",
          overflowY: notes.length > 2 ? "auto" : "visible",
          paddingRight: notes.length > 2 ? "6px" : 0,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {notes.length === 0 ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              backgroundColor: "var(--layer-section-level-1)",
              borderRadius: "12px",
              border: "1px solid rgba(var(--grey-accent-rgb), 0.35)",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>📝</div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
              No Notes Yet
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0 }}>
              {canEdit ? "Add your first note above" : "No notes have been added to this job"}
            </p>
          </div>
        ) : (
          notes.map((note, index) => {
            const isEditing = editingNoteId === note.noteId;
            const linkLabel = resolveLinkLabel(note);
            const isHighlighted = highlightedNoteIdSet.has(note.noteId);

            return (
              <div
                key={note.noteId}
                style={{
                  padding: "14px",
                  backgroundColor: isHighlighted ? "var(--success-surface)" : "var(--layer-section-level-1)",
                  borderRadius: "12px",
                  border: `1px solid ${note.hiddenFromCustomer ? "var(--warning)" : "var(--success)"}`,
                  transition: "background-color 0.2s ease",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", rowGap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: "999px",
                          backgroundColor: "var(--surface-light)",
                          color: "var(--text-primary)",
                          fontSize: "10px",
                          fontWeight: 700,
                        }}
                      >
                        Note {index + 1}
                      </span>
                      {linkLabel && (
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "999px",
                            backgroundColor: "var(--accent-purple-surface)",
                            color: "var(--accent-purple)",
                            fontSize: "10px",
                            fontWeight: 600,
                          }}
                        >
                          Linked: {linkLabel}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                      {note.createdBy}
                      {note.createdByEmail && (
                        <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 400, marginLeft: "6px" }}>
                          ({note.createdByEmail})
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
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
                          padding: "3px 8px",
                          borderRadius: "999px",
                          backgroundColor: note.hiddenFromCustomer ? "var(--warning-surface)" : "var(--success-surface)",
                          color: note.hiddenFromCustomer ? "var(--warning)" : "var(--success-dark)",
                          fontSize: "10px",
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
                      onInput={(e) => {
                        e.currentTarget.style.height = "auto";
                        const next = Math.min(e.currentTarget.scrollHeight, 260);
                        e.currentTarget.style.height = `${next}px`;
                      }}
                      style={{
                        width: "100%",
                        height: "80px",
                        minHeight: "80px",
                        maxHeight: "260px",
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid rgba(var(--grey-accent-rgb), 0.45)",
                        fontSize: "14px",
                        lineHeight: 1.6,
                        resize: "none",
                        overflowY: "auto",
                        backgroundColor: "var(--surface)",
                        color: "var(--text-primary)",
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
                          backgroundColor: "var(--primary)",
                          color: "var(--text-inverse)",
                          fontWeight: 700,
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
                          border: "1px solid rgba(var(--grey-accent-rgb), 0.45)",
                          backgroundColor: "var(--surface-light)",
                          color: "var(--text-primary)",
                          fontWeight: 700,
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
                      color: "var(--text-primary)",
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
                        border: "1px solid rgba(var(--grey-accent-rgb), 0.45)",
                        backgroundColor: "var(--surface-light)",
                        color: "var(--primary)",
                        fontWeight: 700,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setLinkingNote(note)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid rgba(var(--grey-accent-rgb), 0.45)",
                        backgroundColor: "var(--surface-light)",
                        color: "var(--text-primary)",
                        fontWeight: 700,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Link
                    </button>
                    <button
                      onClick={() => handleToggleHiddenFromCustomer(note)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid rgba(var(--grey-accent-rgb), 0.45)",
                        backgroundColor: "var(--surface-light)",
                        color: "var(--text-primary)",
                        fontWeight: 700,
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
                        fontWeight: 700,
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
      {linkingNote && typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(10, 10, 20, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 220,
              padding: "20px",
            }}
          >
            <div
              style={{
                backgroundColor: "var(--surface)",
                borderRadius: "16px",
                padding: "20px",
                width: "min(520px, 100%)",
                border: "1px solid var(--surface-light)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--accent-purple)" }}>
                Link note
              </div>
              <button
                type="button"
                onClick={() => setLinkingNote(null)}
                style={{
                  border: "1px solid var(--surface-light)",
                  backgroundColor: "var(--surface)",
                  color: "var(--info)",
                  borderRadius: "8px",
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                onClick={() => handleLinkNote(linkingNote, { clear: true })}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--surface-light)",
                  backgroundColor: "var(--surface)",
                  color: "var(--info-dark)",
                  fontWeight: 600,
                  cursor: "pointer",
                  alignSelf: "flex-start",
                }}
              >
                Clear link
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--info-dark)", marginBottom: "8px" }}>
                  Customer requests
                </div>
                {requestOptions.length === 0 ? (
                  <div style={{ fontSize: "13px", color: "var(--info)" }}>No requests available.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {requestOptions.map((req, index) => {
                      const activeNote =
                        notes.find((note) => note.noteId === linkingNote.noteId) || linkingNote;
                      const isSelected = isLinkedToRequest(activeNote, index);
                      return (
                      <button
                        key={`request-link-${index}`}
                        type="button"
                        onClick={() => handleLinkNote(activeNote, { linkedRequestIndex: index + 1 })}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "10px",
                          border: isSelected ? "1px solid var(--success)" : "1px solid var(--surface-light)",
                          backgroundColor: isSelected ? "var(--success-surface)" : "var(--layer-section-level-3)",
                          textAlign: "left",
                          cursor: "pointer",
                          fontSize: "13px",
                          color: isSelected ? "var(--success)" : "var(--info-dark)",
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                        }}
                      >
                        <span>Request {index + 1}: {req?.text || req}</span>
                        {isSelected && (
                          <span style={{ fontSize: "11px", fontWeight: 700 }}>
                            Selected
                          </span>
                        )}
                      </button>
                    );
                    })}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--info-dark)", marginBottom: "8px" }}>
                  Authorised items
                </div>
                {authorisedItems.length === 0 ? (
                  <div style={{ fontSize: "13px", color: "var(--info)" }}>No authorised items available.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {authorisedItems.map((item) => {
                      const itemId = item.vhc_id ?? item.id;
                      const activeNote =
                        notes.find((note) => note.noteId === linkingNote.noteId) || linkingNote;
                      const isSelected = isLinkedToAuthorised(activeNote, item);
                      return (
                      <button
                        key={`authorized-link-${itemId}`}
                        type="button"
                        onClick={() => handleLinkNote(activeNote, { linkedVhcId: itemId })}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "10px",
                          border: isSelected ? "1px solid var(--success)" : "1px solid var(--surface-light)",
                          backgroundColor: isSelected ? "var(--success-surface)" : "var(--layer-section-level-3)",
                          textAlign: "left",
                          cursor: "pointer",
                          fontSize: "13px",
                          color: isSelected ? "var(--success)" : "var(--info-dark)",
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                        }}
                      >
                        <span>{item.issue_title || item.section}</span>
                        {isSelected && (
                          <span style={{ fontSize: "11px", fontWeight: 700 }}>
                            Selected
                          </span>
                        )}
                      </button>
                    );
                    })}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--info-dark)", marginBottom: "8px" }}>
                  Authorised parts
                </div>
                {authorisedParts.length === 0 ? (
                  <div style={{ fontSize: "13px", color: "var(--info)" }}>No authorised parts available.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {authorisedParts.map((part) => {
                      const activeNote =
                        notes.find((note) => note.noteId === linkingNote.noteId) || linkingNote;
                      const partId = part.partId ?? part.part_id ?? part.id;
                      const partLabel =
                        part.part?.name ||
                        part.part?.part_number ||
                        part.part_number ||
                        part.partNumber ||
                        "Authorised part";
                      const isSelected = isLinkedToPart(activeNote, partId);
                      return (
                        <button
                          key={`authorized-part-link-${partId}`}
                          type="button"
                          onClick={() => handleLinkNote(activeNote, { linkedPartId: partId })}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "10px",
                            border: isSelected ? "1px solid var(--success)" : "1px solid var(--surface-light)",
                            backgroundColor: isSelected ? "var(--success-surface)" : "var(--layer-section-level-3)",
                            textAlign: "left",
                            cursor: "pointer",
                            fontSize: "13px",
                            color: isSelected ? "var(--success)" : "var(--info-dark)",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "8px",
                          }}
                        >
                          <span>{partLabel}</span>
                          {isSelected && (
                            <span style={{ fontSize: "11px", fontWeight: 700 }}>
                              Selected
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
          document.body
        )}
    </div>
  );
}
