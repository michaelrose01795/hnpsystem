// file location: src/features/websiteManager/editors/SectionEditor.js
//
// Schema-driven editor. Renders the right inputs for any section in
// ./sectionSchemas based on the field types declared there. Used by:
//   - PageContentPanel (one editor per section in the chosen page)
//   - LivePreviewPanel (opens an editor when the user clicks a region)
//   - DesignPanel / NavigationPanel / SectionLayoutPanel (the site builder)
//
// Field type handlers live in ./fields.js so this file stays a thin shell.
//
// Styling is the `.website-manager__*` classes in
// src/styles/features/website-manager.css plus the canonical staff primitives
// (LayerTheme, Button, FieldError) — no one-off inline visual styling.

import React, { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
import FieldError from "@/components/ui/FieldError";
import { renderField } from "./fields";

export default function SectionEditor({
  schema,
  initialValue,
  onSave,
  onCancel,
  onDelete, // collection rows only
  onChange, // fired on every draft change - used by LivePreviewPanel to
            // forward keystrokes into the iframe for WYSIWYG previews.
  saveLabel = "Save changes",
}) {
  const [draft, setDraft] = useState(() => ({ ...(initialValue || {}) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Re-seed when the row being edited changes (live-preview selection swap).
  useEffect(() => {
    setDraft({ ...(initialValue || {}) });
    setError(null);
  }, [initialValue]);

  // Unsaved-changes marker. Compared against the row the editor opened with,
  // so switching rows in the Visual editor resets it along with the draft.
  const dirty = useMemo(
    () => JSON.stringify(initialValue || {}) !== JSON.stringify(draft),
    [initialValue, draft]
  );

  const setField = (name, value) => {
    setDraft((prev) => {
      const next = { ...prev, [name]: value };
      onChange?.(next);
      return next;
    });
  };

  const handleSave = async () => {
    // Required-field validation. `false` is a legitimate value for a boolean
    // field, so only null/undefined/"" count as missing.
    const missing = schema.fields
      .filter((f) => {
        if (!f.required) return false;
        const v = draft[f.name];
        return v === undefined || v === null || v === "";
      })
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
    <LayerTheme className="website-manager__editor" gap="var(--space-3)">
      <div className="website-manager__editor-header">
        <span className="website-manager__editor-title">{schema.label}</span>
        <span className="website-manager__editor-header-actions">
          {dirty && (
            <span className="app-badge app-badge--warning app-badge--uppercase">
              Unsaved
            </span>
          )}
          {onDelete && (
            <Button type="button" variant="danger" size="xs" onClick={onDelete} disabled={busy}>
              Delete
            </Button>
          )}
        </span>
      </div>

      {schema.fields.map((field) => (
        <label key={field.name} className="website-manager__field">
          <span className="website-manager__label">
            {field.label}
            {field.required ? " *" : ""}
          </span>
          {renderField({
            field,
            value: draft[field.name],
            onChange: (v) => setField(field.name, v),
            // A collection row's stable text PK is immutable once the row
            // exists — changing it would orphan every reference to it.
            disabled: busy || Boolean(field.idField && initialValue?.id),
          })}
        </label>
      ))}

      <FieldError>{error}</FieldError>

      <div className="website-manager__actions">
        <Button type="button" variant="primary" onClick={handleSave} busy={busy}>
          {saveLabel}
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
