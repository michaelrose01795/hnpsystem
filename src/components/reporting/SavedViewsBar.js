// file location: src/components/reporting/SavedViewsBar.js
//
// Saved views for a report area: list the caller's saved filter sets (from
// /api/reports/views), apply one back into the filter, save the current filter
// as a new view, or delete one. The current filter is stored verbatim as the
// view's `filter` payload — the engine re-normalises it on read.

import React, { useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import { useSavedViews } from "@/hooks/reporting/useReporting";
import { reportDevKey } from "./reportDevOverlay";

export default function SavedViewsBar({ targetRef, currentFilter, onApply }) {
  const { views, loading, error, createView, deleteView } = useSavedViews(targetRef);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState(null);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setLocalError(null);
    try {
      await createView({ name: name.trim(), filter: currentFilter });
      setName("");
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <LayerSurface
      radius="var(--radius-sm)"
      padding="12px"
      gap="10px"
      sectionKey={reportDevKey("report-saved-views", targetRef || "default")}
      sectionType="toolbar"
      data-dev-text-preview="Saved report views"
    >
      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--accentText)" }}>Saved views</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {loading && <span style={{ fontSize: "0.78rem", color: "var(--surfaceTextMuted)" }}>Loading…</span>}
        {!loading && views.length === 0 && (
          <span style={{ fontSize: "0.78rem", color: "var(--surfaceTextMuted)" }}>No saved views yet — save the current filter below.</span>
        )}
        {views.map((v) => (
          <span
            key={v.view_id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--theme)",
              borderRadius: 999,
              padding: "4px 6px 4px 12px",
              fontSize: "0.78rem",
            }}
          >
            <button
              type="button"
              onClick={() => onApply?.(v.filter || {})}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-1)", fontWeight: 600 }}
            >
              {v.name}
            </button>
            <button
              type="button"
              title="Delete view"
              onClick={() => deleteView(v.view_id)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--surfaceTextMuted)", lineHeight: 1 }}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="text"
          placeholder="Name this view…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            height: 36,
            flex: "1 1 160px",
            maxWidth: 240,
            borderRadius: "var(--radius-sm)",
            padding: "0 10px",
            background: "var(--surface)",
            color: "var(--text-1)",
            border: "1px solid var(--input-ring)",
          }}
        />
        <button type="button" className="app-btn app-btn--ghost" onClick={save} disabled={busy || !name.trim()} style={{ fontSize: "0.78rem", padding: "6px 12px" }}>
          Save current filter
        </button>
      </div>

      {(error || localError) && <div style={{ color: "var(--danger-base)", fontSize: "0.76rem" }}>{error || localError}</div>}
    </LayerSurface>
  );
}
