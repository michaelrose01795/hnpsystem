// file location: src/components/page-ui/job-cards/warranty/WarrantyNotesPanel.js
// "Warranty Notes" section. Notes added here are written to the LINKED warranty
// job's job_notes (via createJobNote with the warranty job id), and the existing
// warranty-job notes are listed below. Section is a LayerTheme; the composer and
// each note flip to LayerSurface (depth 2).
import React, { useCallback, useEffect, useState } from "react";
import LayerTheme from "@/components/ui/LayerTheme";
import LayerSurface from "@/components/ui/LayerSurface";
import { createJobNote, getNotesByJob } from "@/lib/database/notes";

const formatStamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const authorName = (note) => {
  const user = note?.user;
  if (!user) return "Staff";
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "Staff";
};

export default function WarrantyNotesPanel({
  warrantyJobId,
  linkedJob,
  actingUserId = null,
  canEdit = false,
  alert = (msg) => window.alert(msg),
}) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const loadNotes = useCallback(async () => {
    if (!warrantyJobId) return;
    setLoading(true);
    try {
      const data = await getNotesByJob(warrantyJobId);
      setNotes(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [warrantyJobId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleAdd = async () => {
    const text = draft.trim();
    if (!text || !warrantyJobId) return;
    setSaving(true);
    try {
      const res = await createJobNote({
        job_id: warrantyJobId,
        user_id: actingUserId,
        note_text: text,
      });
      if (!res?.success) {
        alert(res?.error?.message || "Failed to add warranty note.");
        return;
      }
      setDraft("");
      await loadNotes();
    } finally {
      setSaving(false);
    }
  };

  return (
    <LayerTheme
      sectionKey="jobcard-tab-warranty-notes"
      parentKey="jobcard-tab-warranty-panel"
      gap="14px"
    >
      <div>
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
          Warranty Notes
        </h3>
        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--text-1)", opacity: 0.7 }}>
          Notes are added to the linked warranty job (#{linkedJob?.jobNumber || "—"}).
        </p>
      </div>

      {canEdit && (
        <LayerSurface
          sectionKey="jobcard-tab-warranty-notes-composer"
          parentKey="jobcard-tab-warranty-notes"
          gap="10px"
        >
          <textarea
            className="app-input"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a warranty note…"
            disabled={saving}
            style={{ resize: "vertical" }}
          />
          <div>
            <button
              type="button"
              className="app-btn app-btn--primary"
              onClick={handleAdd}
              disabled={saving || !draft.trim()}
            >
              {saving ? "Adding…" : "Add Note"}
            </button>
          </div>
        </LayerSurface>
      )}

      {loading ? (
        <span style={{ fontSize: "13px", color: "var(--text-1)", opacity: 0.7 }}>
          Loading notes…
        </span>
      ) : notes.length === 0 ? (
        <div className="app-status-message app-status-message--info">
          No warranty notes yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {notes.map((note) => (
            <LayerSurface
              key={note.note_id}
              radius="var(--radius-sm)"
              padding="12px"
              gap="6px"
            >
              <span style={{ fontSize: "14px", color: "var(--text-1)", whiteSpace: "pre-wrap" }}>
                {note.note_text}
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-1)", opacity: 0.6 }}>
                {authorName(note)} · {formatStamp(note.created_at)}
              </span>
            </LayerSurface>
          ))}
        </div>
      )}
    </LayerTheme>
  );
}
