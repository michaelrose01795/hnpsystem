// file location: src/components/reporting/KpiValueCard.js
//
// A single KPI "summary card": label, big value (formatted by the engine's unit/
// format), an optional sub-line, and optional drill-down / not-implemented
// states. It NEVER computes a metric — it renders whatever /api/reports/kpi
// returned. Used by the scorecard strip and the operational KPI grids.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import { formatKpiValue, targetHint } from "@/utils/reporting/formatKpiValue";
import ProvenanceFooter from "./ProvenanceFooter";

const toneColor = (tone) =>
  tone === "good" ? "var(--success-base)" : tone === "bad" ? "var(--danger-base)" : "var(--surfaceTextMuted)";

export default function KpiValueCard({ result, readiness, onDrilldown, showProvenance = false, compact = false }) {
  // `result` is the engine envelope's per-KPI object: { kpiId, label, value,
  // unit, format, targetType, provenance, warnings }. When a KPI is declared
  // but has no resolver, value is null and provenance carries the reason.
  const label = result?.label || result?.kpiId || "—";
  const value = result?.value;
  const unit = result?.unit || "count";
  const format = result?.format || "0,0";
  const notImplemented = value == null && (result?.warnings || []).some((w) => /declared but not yet/i.test(w));
  const hint = targetHint(result?.targetType);

  return (
    <LayerSurface
      radius="var(--radius-sm)"
      padding={compact ? "14px" : "16px"}
      gap="6px"
      style={{ minWidth: 0, flex: "1 1 180px" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: "0.78rem", color: "var(--surfaceTextMuted)", lineHeight: 1.2 }}>{label}</span>
        {readiness && readiness !== "R1" && (
          <span
            title={`Readiness ${readiness}`}
            style={{
              fontSize: "0.62rem",
              fontWeight: 700,
              color: "var(--warning-base)",
              background: "rgba(var(--primary-rgb), 0.08)",
              borderRadius: 999,
              padding: "1px 7px",
            }}
          >
            {readiness}
          </span>
        )}
      </div>

      {notImplemented ? (
        <div style={{ fontSize: "0.9rem", color: "var(--surfaceTextMuted)", fontWeight: 500 }}>
          Not yet captured
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: compact ? "1.5rem" : "1.8rem", fontWeight: 700, color: "var(--text-1)", lineHeight: 1.1 }}>
            {formatKpiValue(value, unit, format)}
          </span>
          {value != null && hint.glyph && (
            <span style={{ fontSize: "0.85rem", color: toneColor(hint.tone) }}>{hint.glyph}</span>
          )}
        </div>
      )}

      {typeof onDrilldown === "function" && !notImplemented && value != null && (
        <button
          type="button"
          className="app-btn app-btn--ghost"
          onClick={() => onDrilldown(result)}
          style={{ alignSelf: "flex-start", fontSize: "0.74rem", padding: "2px 8px", marginTop: 2 }}
        >
          View records
        </button>
      )}

      {showProvenance && <ProvenanceFooter meta={result?.provenance} warnings={result?.warnings} compact />}
    </LayerSurface>
  );
}
