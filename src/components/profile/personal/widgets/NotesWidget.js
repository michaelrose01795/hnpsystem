import React, { useState } from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import {
  EmptyState,
  SectionLabel,
  formatDate,
  widgetButtonStyle,
  widgetGhostButtonStyle,
  widgetInputStyle,
} from "@/components/profile/personal/widgets/shared";

export default function NotesWidget({
  widget,
  datasets,
  actions,
  onRemove,
  dragHandleProps,
  resizeHandleProps,
  compact = false,
}) {
  const [draft, setDraft] = useState("");

  const addNote = async () => {
    if (!draft.trim()) return;
    await actions.createNote({ content: draft.trim() });
    setDraft("");
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Notes"}
      subtitle="Private reminders and references"
      accent="var(--text-primary)"
      onRemove={onRemove}
      dragHandleProps={dragHandleProps}
      resizeHandleProps={resizeHandleProps}
      compact={compact}
    >
      <SectionLabel>New note</SectionLabel>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        style={{ ...widgetInputStyle, minHeight: "110px", resize: "vertical" }}
        placeholder="Capture a thought, reminder, or personal reference..."
      />
      <button type="button" onClick={addNote} style={{ ...widgetButtonStyle, alignSelf: "flex-start" }}>
        Save note
      </button>

      <SectionLabel>Saved notes</SectionLabel>
      {(datasets.notes || []).length === 0 ? (
        <EmptyState>No notes yet.</EmptyState>
      ) : (
        <div style={{ display: "grid", gap: "8px", overflowY: "auto" }}>
          {(datasets.notes || []).map((note) => (
            <div
              key={note.id}
              style={{
                display: "grid",
                gap: "8px",
                padding: "12px",
                borderRadius: "14px",
                background: "rgba(var(--accent-purple-rgb), 0.04)",
              }}
            >
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Updated {formatDate(note.updatedAt || note.createdAt)}
              </div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: "0.86rem", lineHeight: 1.5 }}>
                {note.content}
              </div>
              <div>
                <button type="button" onClick={() => actions.deleteNote(note.id)} style={widgetGhostButtonStyle}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </BaseWidget>
  );
}
