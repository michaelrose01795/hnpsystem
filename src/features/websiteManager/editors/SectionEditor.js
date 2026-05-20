// file location: src/features/websiteManager/editors/SectionEditor.js
//
// Schema-driven editor. Renders the right inputs for any section in
// ./sectionSchemas based on the field types declared there. Used by:
//   - PageContentPanel (one editor per section in the chosen page)
//   - LivePreviewPanel (opens an editor when the user clicks a region)
//
// Field type handlers live in ./fields.js so this file stays a thin shell.

import React, { useState } from "react";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
import { renderField } from "./fields";

const labelStyle = {
  fontSize: "0.72rem",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--text-1)",
  fontWeight: 700,
};

export default function SectionEditor({
  schema,
  initialValue,
  onSave,
  onCancel,
  onDelete, // collection rows only
  onChange, // fired on every draft change - used by LivePreviewPanel to
            // forward keystrokes into the iframe for WYSIWYG previews.
}) {
  const [draft, setDraft] = useState(() => ({ ...(initialValue || {}) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Re-seed when the row being edited changes (live-preview selection swap).
  React.useEffect(() => {
    setDraft({ ...(initialValue || {}) });
  }, [initialValue]);

  const setField = (name, value) => {
    setDraft((prev) => {
      const next = { ...prev, [name]: value };
      onChange?.(next);
      return next;
    });
  };

  const handleSave = async () => {
    // Required-field validation
    const missing = schema.fields
      .filter((f) => f.required && !draft[f.name] && draft[f.name] !== 0)
      .map((f) => f.label);
    if (missing.length) {
      setError(`Required: ${missing.join(", ")}`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSave(draft);
    } catch (e) {
      setError(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <LayerTheme padding="16px" gap="14px">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700, color: "var(--accentText)" }}>
          {schema.label}
        </div>
        {onDelete && (
          <Button type="button" variant="danger" size="xs" onClick={onDelete} disabled={busy}>
            Delete
          </Button>
        )}
      </div>

      {schema.fields.map((field) => (
        <label key={field.name} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={labelStyle}>
            {field.label}
            {field.required ? " *" : ""}
          </span>
          {renderField({
            field,
            value: draft[field.name],
            onChange: (v) => setField(field.name, v),
            disabled: busy || (field.idField && initialValue?.id), // ID immutable once set
          })}
        </label>
      ))}

      {error && (
        <div style={{ color: "var(--danger-base, #b00)", fontSize: "0.85rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <Button type="button" variant="primary" onClick={handleSave} disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
      </div>
    </LayerTheme>
  );
}
