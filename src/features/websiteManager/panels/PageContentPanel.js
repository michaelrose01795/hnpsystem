// file location: src/features/websiteManager/panels/PageContentPanel.js
//
// Phase 2 rewrite. Drives every page's content through the typed editors in
// ../editors. For each selected page we list the sections that belong to it,
// load their current rows from /api/website/sections/:section, and let the
// user open a SectionEditor that patches the right table.
//
// Singletons: one row, edit in place.
// Collections: row list with Edit + Delete + "+ Add" + reorder.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Section from "@/components/Section";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
import { SECTION_SCHEMAS, SECTIONS_BY_PAGE } from "../editors/sectionSchemas";
import SectionEditor from "../editors/SectionEditor";
import {
  fetchSection,
  patchSingleton,
  createRow,
  patchRow,
  deleteRowApi,
  reorderSection,
} from "../websiteApi";
import {
  StatusBadge,
  EmptyState,
  formatDateTime,
  cellStyle,
  headCellStyle,
} from "../helpers";

export default function PageContentPanel({
  pages,
  initialPageKey,
  onTogglePageStatus,
}) {
  const [pageKey, setPageKey] = useState(initialPageKey || pages[0]?.key || "home");
  useEffect(() => {
    if (initialPageKey) setPageKey(initialPageKey);
  }, [initialPageKey]);

  const sections = SECTIONS_BY_PAGE[pageKey] || [];
  const selectedPage = pages.find((p) => p.key === pageKey);

  return (
    <>
      <Section
        title="Page Content"
        subtitle="Pick a page, then edit the sections that make up that page."
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 240px" }}>
            <span
              style={{
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-1)",
                fontWeight: 700,
              }}
            >
              Website page
            </span>
            <select
              className="app-input"
              value={pageKey}
              onChange={(e) => setPageKey(e.target.value)}
            >
              {pages.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {selectedPage && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StatusBadge status={selectedPage.status} />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onTogglePageStatus(selectedPage.key)}
              >
                {selectedPage.status === "published"
                  ? "Switch page to draft"
                  : "Publish page"}
              </Button>
            </div>
          )}
        </div>
        {selectedPage && (
          <div style={{ fontSize: "0.82rem", color: "var(--text-1)" }}>
            Route <span style={{ fontFamily: "monospace" }}>{selectedPage.route}</span>
            {selectedPage.lastEditedAt
              ? ` · last edited by ${selectedPage.lastEditedBy} on ${formatDateTime(selectedPage.lastEditedAt)}`
              : ""}
          </div>
        )}
      </Section>

      {sections.length === 0 ? (
        <Section title="Sections">
          <EmptyState message="No editable sections are mapped to this page yet." />
        </Section>
      ) : (
        sections.map((sectionKey) => (
          <SectionPanel key={sectionKey} sectionKey={sectionKey} />
        ))
      )}
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Singleton + collection panel shells                              */
/* ---------------------------------------------------------------- */

function SectionPanel({ sectionKey }) {
  const schema = SECTION_SCHEMAS[sectionKey];
  if (!schema) return null;
  return schema.kind === "singleton" ? (
    <SingletonPanel sectionKey={sectionKey} schema={schema} />
  ) : (
    <CollectionPanel sectionKey={sectionKey} schema={schema} />
  );
}

function useSectionData(sectionKey) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchSection(sectionKey);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [sectionKey]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, loading, setData, reload };
}

function SingletonPanel({ sectionKey, schema }) {
  const { data, loading, setData } = useSectionData(sectionKey);
  const [editing, setEditing] = useState(false);

  const handleSave = async (draft) => {
    const saved = await patchSingleton(sectionKey, draft);
    setData(saved);
    setEditing(false);
  };

  return (
    <Section title={schema.label} subtitle={`/api/website/sections/${sectionKey}`}>
      {loading && <div style={{ color: "var(--text-1)" }}>Loading…</div>}
      {!loading && !editing && (
        <>
          <Summary data={data || {}} fields={schema.fields} />
          <div>
            <Button type="button" variant="primary" onClick={() => setEditing(true)}>
              Edit {schema.label.toLowerCase()}
            </Button>
          </div>
        </>
      )}
      {!loading && editing && (
        <SectionEditor
          schema={schema}
          initialValue={data || {}}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      )}
    </Section>
  );
}

function CollectionPanel({ sectionKey, schema }) {
  const { data, loading, setData, reload } = useSectionData(sectionKey);
  // editing.mode: null | "add" | "edit"; editing.row: row in edit mode
  const [editing, setEditing] = useState({ mode: null, row: null });
  const rows = data || [];

  const handleSave = async (draft) => {
    if (editing.mode === "add") {
      await createRow(sectionKey, draft);
    } else {
      await patchRow(sectionKey, editing.row.id, draft);
    }
    setEditing({ mode: null, row: null });
    await reload();
  };

  const handleDelete = async () => {
    if (!editing.row) return;
    if (
      !window.confirm(
        `Delete "${schema.rowLabel?.(editing.row) || editing.row.id}"? This cannot be undone.`
      )
    ) {
      return;
    }
    await deleteRowApi(sectionKey, editing.row.id);
    setEditing({ mode: null, row: null });
    await reload();
  };

  const move = async (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[idx], next[target]] = [next[target], next[idx]];
    setData(next);
    try {
      await reorderSection(
        sectionKey,
        next.map((r) => r.id)
      );
    } catch {
      // Revert if reorder failed.
      reload();
    }
  };

  return (
    <Section title={schema.label} subtitle={`/api/website/sections/${sectionKey}`}>
      {loading && <div style={{ color: "var(--text-1)" }}>Loading…</div>}
      {!loading && (
        <>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setEditing({ mode: "add", row: { status: "published" } })}
            >
              + Add {schema.label.replace(/s$/i, "").toLowerCase()}
            </Button>
          </div>

          {editing.mode && (
            <SectionEditor
              schema={schema}
              initialValue={editing.row || {}}
              onSave={handleSave}
              onCancel={() => setEditing({ mode: null, row: null })}
              onDelete={editing.mode === "edit" ? handleDelete : null}
            />
          )}

          {rows.length === 0 ? (
            <EmptyState message={`No ${schema.label.toLowerCase()} yet.`} />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                <thead>
                  <tr>
                    <th style={{ ...headCellStyle, width: 36 }}>#</th>
                    <th style={headCellStyle}>Item</th>
                    {schema.fields.some((f) => f.name === "status") && (
                      <th style={headCellStyle}>Status</th>
                    )}
                    <th style={headCellStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.id}>
                      <td style={{ ...cellStyle, color: "var(--text-1)" }}>{idx + 1}</td>
                      <td style={cellStyle}>
                        <span style={{ fontWeight: 600 }}>
                          {schema.rowLabel ? schema.rowLabel(row) : row.id}
                        </span>
                      </td>
                      {schema.fields.some((f) => f.name === "status") && (
                        <td style={cellStyle}>
                          <StatusBadge status={row.status} />
                        </td>
                      )}
                      <td style={cellStyle}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            disabled={idx === 0}
                            onClick={() => move(idx, -1)}
                          >
                            ↑
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            disabled={idx === rows.length - 1}
                            onClick={() => move(idx, 1)}
                          >
                            ↓
                          </Button>
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
        </>
      )}
    </Section>
  );
}

/* ---------------------------------------------------------------- */
/* Read-only summary for a singleton before "Edit" is clicked       */
/* ---------------------------------------------------------------- */
function Summary({ data, fields }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {fields.slice(0, 4).map((f) => {
        const v = data[f.name];
        return (
          <div key={f.name} style={{ display: "flex", gap: 8, fontSize: "0.88rem" }}>
            <span style={{ color: "var(--text-1)", minWidth: 130 }}>{f.label}:</span>
            <span>{formatValue(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatValue(v) {
  if (v == null) return "—";
  if (Array.isArray(v)) {
    if (v.length === 0) return "—";
    if (typeof v[0] === "string") return v.join(" · ");
    return `${v.length} item${v.length === 1 ? "" : "s"}`;
  }
  if (typeof v === "object") return JSON.stringify(v).slice(0, 80) + "…";
  return String(v);
}
