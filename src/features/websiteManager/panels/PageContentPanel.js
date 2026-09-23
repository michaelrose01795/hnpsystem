// file location: src/features/websiteManager/panels/PageContentPanel.js
//
// Drives every website page's content through the typed editors in ../editors.
// For each selected page we list the sections that belong to it, load their
// current rows from /api/website/sections/:section, and open a SectionEditor
// that patches the right table.
//
//   Singletons  — one row, edited in place.
//   Collections — delegated to <CollectionManager>, which supplies the list,
//                 reorder, add / edit / delete and show / hide controls.

import React, { useCallback, useEffect, useState } from "react";
import Section from "@/components/Section";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { SECTION_SCHEMAS, SECTIONS_BY_PAGE } from "../editors/sectionSchemas";
import SectionEditor from "../editors/SectionEditor";
import CollectionManager from "./CollectionManager";
import { fetchSection, patchSingleton } from "../websiteApi";
import { StatusBadge, formatDateTime } from "../helpers";

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
      <Section title="Pages and sections">
        <div className="website-manager__toolbar">
          <DropdownField
            className="website-manager__toolbar-filter"
            label="Website page"
            value={pageKey}
            onChange={(e) => setPageKey(e.target.value)}
            options={pages.map((p) => ({ value: p.key, label: p.name }))}
          />
          {selectedPage && (
            <div className="website-manager__row-actions">
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
          <p className="website-manager__meta">
            <span className="website-manager__cell-mono">{selectedPage.route}</span>
            {selectedPage.lastEditedAt
              ? ` · last edited by ${selectedPage.lastEditedBy} on ${formatDateTime(
                  selectedPage.lastEditedAt
                )}`
              : ""}
          </p>
        )}
      </Section>

      {sections.length === 0 ? (
        <Section title="Sections">
          <EmptyState
            variant="bare"
            title="No editable sections on this page"
            description="This page has no section schema mapped to it yet. Pick another page, or edit its blocks from Design and layout → Sections."
          />
        </Section>
      ) : (
        sections.map((sectionKey) => (
          <SectionPanel key={sectionKey} sectionKey={sectionKey} />
        ))
      )}
    </>
  );
}

function SectionPanel({ sectionKey }) {
  const schema = SECTION_SCHEMAS[sectionKey];
  if (!schema) return null;
  return schema.kind === "singleton" ? (
    <SingletonPanel sectionKey={sectionKey} schema={schema} />
  ) : (
    <CollectionManager sectionKey={sectionKey} schema={schema} />
  );
}

/* ---------------------------------------------------------------- */
/* Singleton — read-only summary until "Edit" is clicked             */
/* ---------------------------------------------------------------- */

function SingletonPanel({ sectionKey, schema }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchSection(sectionKey));
      setError("");
    } catch (e) {
      setError(e?.message || "This section could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [sectionKey]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (draft) => {
    const saved = await patchSingleton(sectionKey, draft);
    setData(saved || draft);
    setEditing(false);
  };

  return (
    <Section title={schema.label}>
      {error && (
        <div className="website-manager__notice website-manager__notice--warning" role="alert">
          {error}
        </div>
      )}
      {loading && <p className="website-manager__meta">Loading…</p>}
      {!loading && !editing && (
        <>
          <Summary data={data || {}} fields={schema.fields} />
          <div className="website-manager__actions">
            <Button type="button" variant="primary" size="sm" onClick={() => setEditing(true)}>
              {`Edit ${schema.label.toLowerCase()}`}
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

// The first four fields of a singleton, as a compact read-only table. Uses
// .app-data-table so it matches every other list in the app.
function Summary({ data, fields }) {
  return (
    <div className="website-manager__table-scroll">
      <table className="app-data-table app-data-table--compact">
        <tbody>
          {fields.slice(0, 4).map((f) => (
            <tr key={f.name}>
              <td className="website-manager__cell-muted website-manager__cell-nowrap">
                {f.label}
              </td>
              <td>{formatValue(data[f.name])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(v) {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) {
    if (v.length === 0) return "—";
    if (typeof v[0] === "string") return v.join(" · ");
    return `${v.length} item${v.length === 1 ? "" : "s"}`;
  }
  if (typeof v === "boolean") return v ? "On" : "Off";
  if (typeof v === "object") return `${JSON.stringify(v).slice(0, 80)}…`;
  return String(v);
}
