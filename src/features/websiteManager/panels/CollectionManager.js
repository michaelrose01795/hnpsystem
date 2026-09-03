// file location: src/features/websiteManager/panels/CollectionManager.js
//
// One reusable CRUD surface for any collection section in
// ../editors/sectionSchemas: list the rows, reorder them, add / edit / delete
// through a SectionEditor, and toggle a row between published and draft
// without opening the editor.
//
// Used by:
//   PageContentPanel      every collection belonging to a website page
//   NavigationPanel       the /website top bar (website_nav)
//   SectionLayoutPanel    the /website block running order
//
// Extracted from PageContentPanel so all three read and behave identically —
// previously the page-content list was the only one with reorder controls.

import React, { useCallback, useEffect, useState } from "react";
import Section from "@/components/Section";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import SectionEditor from "../editors/SectionEditor";
import {
  fetchSection,
  createRow,
  patchRow,
  deleteRowApi,
  reorderSection,
} from "../websiteApi";
import { StatusBadge, slugify } from "../helpers";

export default function CollectionManager({
  sectionKey,
  schema,
  title,
  // Extra table columns beyond "#", "Item" and "Status".
  // [{ label, render(row) , className? }]
  columns = [],
  // Seed for a new row, before the editor opens.
  newRowDefaults = { status: "published" },
  // Derive the stable text PK from the draft when adding. Returning "" lets
  // the editor's own required-field check ask for it instead.
  deriveId,
  addLabel,
  // Rows that must not be deleted (e.g. a block the page renderer needs).
  lockedIds = [],
  emptyTitle,
  emptyDescription,
  onChanged,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState({ mode: null, row: null });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSection(sectionKey);
      setRows(Array.isArray(data) ? data : []);
      setError("");
    } catch (e) {
      setRows([]);
      setError(e?.message || "This section could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [sectionKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  const close = () => setEditing({ mode: null, row: null });

  const handleSave = async (draft) => {
    if (editing.mode === "add") {
      // Collection rows need a stable text PK. Derive one from the draft so
      // staff never have to invent an id, and keep it unique against the rows
      // already on screen.
      const next = { ...draft };
      if (!next.id && deriveId) {
        const base = slugify(deriveId(next), sectionKey);
        let candidate = base;
        let n = 2;
        while (rows.some((r) => r.id === candidate)) candidate = `${base}-${n++}`;
        next.id = candidate;
      }
      // New rows go to the end of the list.
      if (next.sort_order == null) next.sort_order = rows.length;
      await createRow(sectionKey, next);
    } else {
      await patchRow(sectionKey, editing.row.id, draft);
    }
    close();
    await reload();
    onChanged?.();
  };

  const handleDelete = async () => {
    if (!editing.row) return;
    const name = schema.rowLabel?.(editing.row) || editing.row.id;
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await deleteRowApi(sectionKey, editing.row.id);
    close();
    await reload();
    onChanged?.();
  };

  const toggleStatus = async (row) => {
    const next = row.status === "published" ? "draft" : "published";
    const snapshot = rows;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
    try {
      await patchRow(sectionKey, row.id, { status: next });
      onChanged?.();
    } catch (e) {
      setRows(snapshot);
      setError(e?.message || "That change could not be saved.");
    }
  };

  const move = async (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= rows.length) return;
    const snapshot = rows;
    const next = [...rows];
    [next[idx], next[target]] = [next[target], next[idx]];
    setRows(next);
    try {
      await reorderSection(sectionKey, next.map((r) => r.id));
      onChanged?.();
    } catch (e) {
      setRows(snapshot);
      setError(e?.message || "The new order could not be saved.");
    }
  };

  const hasStatus = schema.fields.some((f) => f.name === "status");
  const singular = (addLabel || schema.label).replace(/s$/i, "").toLowerCase();

  return (
    <Section title={title || schema.label}>
      <div className="website-manager__actions">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setEditing({ mode: "add", row: { ...newRowDefaults } })}
        >
          {`+ Add ${singular}`}
        </Button>
      </div>

      {error && (
        <div className="website-manager__notice website-manager__notice--warning" role="alert">
          {error}
        </div>
      )}

      {editing.mode && (
        <SectionEditor
          schema={schema}
          initialValue={editing.row || {}}
          onSave={handleSave}
          onCancel={close}
          onDelete={
            editing.mode === "edit" && !lockedIds.includes(editing.row?.id)
              ? handleDelete
              : null
          }
          saveLabel={editing.mode === "add" ? `Add ${singular}` : "Save changes"}
        />
      )}

      {loading && <p className="website-manager__meta">Loading…</p>}

      {!loading && rows.length === 0 && (
        <EmptyState
          variant="bare"
          title={emptyTitle || `No ${schema.label.toLowerCase()} yet`}
          description={
            emptyDescription ||
            `Nothing has been added here yet. Use “Add ${singular}” to create the first one.`
          }
        />
      )}

      {!loading && rows.length > 0 && (
        <div className="website-manager__table-scroll">
          <table className="app-data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                {columns.map((col) => (
                  <th key={col.label}>{col.label}</th>
                ))}
                {hasStatus && <th>Status</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id}>
                  <td className="website-manager__cell-muted">{idx + 1}</td>
                  <td className="website-manager__cell-strong">
                    {schema.rowLabel ? schema.rowLabel(row) : row.id}
                  </td>
                  {columns.map((col) => (
                    <td key={col.label} className={col.className}>
                      {col.render(row)}
                    </td>
                  ))}
                  {hasStatus && (
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                  )}
                  <td>
                    <div className="website-manager__row-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        disabled={idx === 0}
                        onClick={() => move(idx, -1)}
                        aria-label={`Move ${row.id} up`}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        disabled={idx === rows.length - 1}
                        onClick={() => move(idx, 1)}
                        aria-label={`Move ${row.id} down`}
                      >
                        ↓
                      </Button>
                      {hasStatus && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="xs"
                          onClick={() => toggleStatus(row)}
                        >
                          {row.status === "published" ? "Hide" : "Show"}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={() => setEditing({ mode: "edit", row })}
                      >
                        Edit
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

