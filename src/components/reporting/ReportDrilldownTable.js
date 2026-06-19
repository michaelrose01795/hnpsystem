// file location: src/components/reporting/ReportDrilldownTable.js
//
// Shows the contributing records behind a KPI (from /api/reports/drilldown) and
// offers a CSV export (the audited /api/reports/export endpoint). It renders the
// rows the engine returned as-is — column set is inferred from the data so any
// KPI's drill-down works without bespoke wiring.

import React, { useMemo } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import { useDrilldown, buildExportUrl } from "@/hooks/reporting/useReporting";

const PRETTY = (k) =>
  String(k)
    .replace(/_/g, " ")
    .replace(/\bgbp\b/i, "£")
    .replace(/^\w/, (c) => c.toUpperCase());

const cell = (v) => {
  if (v == null) return "—";
  if (typeof v === "number") return v.toLocaleString("en-GB", { maximumFractionDigits: 2 });
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

export default function ReportDrilldownTable({ kpiId, label, filter, onClose }) {
  const { loading, error, rows, count, entityType, warnings } = useDrilldown(kpiId, filter, { enabled: Boolean(kpiId) });

  const columns = useMemo(() => {
    const seen = [];
    rows.slice(0, 50).forEach((r) => Object.keys(r || {}).forEach((k) => !seen.includes(k) && seen.push(k)));
    return seen;
  }, [rows]);

  return (
    <LayerSurface radius="var(--radius-sm)" padding="16px" gap="12px">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, color: "var(--accentText)" }}>{label || kpiId} — contributing records</div>
          <div style={{ fontSize: "0.78rem", color: "var(--surfaceTextMuted)" }}>
            {loading ? "Loading…" : `${count ?? rows.length} record${(count ?? rows.length) === 1 ? "" : "s"}${entityType ? ` · ${entityType}` : ""}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            className="app-btn app-btn--ghost"
            href={buildExportUrl(kpiId, filter)}
            style={{ fontSize: "0.78rem", padding: "6px 12px", textDecoration: "none" }}
          >
            Export CSV
          </a>
          {typeof onClose === "function" && (
            <button type="button" className="app-btn app-btn--ghost" onClick={onClose} style={{ fontSize: "0.78rem", padding: "6px 12px" }}>
              Close
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ color: "var(--danger-base)", fontSize: "0.82rem" }}>{error}</div>}
      {Array.isArray(warnings) && warnings.length > 0 && (
        <div style={{ color: "var(--warning-base)", fontSize: "0.76rem" }}>{warnings.join("; ")}</div>
      )}

      {!loading && rows.length === 0 && !error ? (
        <div style={{ color: "var(--surfaceTextMuted)", fontSize: "0.85rem", padding: "12px 0" }}>
          No records for the selected period.
        </div>
      ) : (
        <div className="app-table-shell-scroll" style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
          <table className="app-data-table app-table-shell app-table-shell--with-headings" style={{ width: "100%" }}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c} style={{ textAlign: "left", whiteSpace: "nowrap" }}>
                    {PRETTY(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id ?? r.vhc_id ?? r.user_id ?? i}>
                  {columns.map((c) => (
                    <td key={c} style={{ whiteSpace: "nowrap" }}>
                      {cell(r[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </LayerSurface>
  );
}
