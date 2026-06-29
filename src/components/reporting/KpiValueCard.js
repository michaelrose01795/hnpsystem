// file location: src/components/reporting/KpiValueCard.js
//
// A single KPI "summary card": label, big value (formatted by the engine's unit/
// format), an optional sub-line, and optional drill-down / not-implemented
// states. It NEVER computes a metric — it renders whatever /api/reports/kpi
// returned. Used by the scorecard strip and the operational KPI grids.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import { formatKpiValue, targetHint } from "@/utils/reporting/formatKpiValue";
import ProvenanceFooter from "./ProvenanceFooter";
import { reportDevKey } from "./reportDevOverlay";

const toneColor = (tone) =>
  tone === "good" ? "var(--success-base)" : tone === "bad" ? "var(--danger-base)" : "var(--surfaceTextMuted)";

export default function KpiValueCard({ result, readiness, onDrilldown, showProvenance = false, compact = false, loading = false }) {
  // `result` is the engine envelope's per-KPI object: { kpiId, label, value,
  // unit, format, targetType, provenance, warnings }. When a KPI is declared
  // but has no resolver, value is null and provenance carries the reason.
  const label = result?.label || result?.kpiId || "—";
  const value = result?.value;
  const unit = result?.unit || "count";
  const format = result?.format || "0,0";
  const notImplemented = !loading && value == null && (result?.warnings || []).some((w) => /declared but not yet/i.test(w));
  const hint = targetHint(result?.targetType);
  const devSectionKey = reportDevKey("report-kpi-card", result?.kpiId || label);

  // The whole card is the drill-down affordance (the old "View records" button
  // was removed). It only becomes interactive when there is an actual record
  // set to open — i.e. a real, captured value and a handler.
  const clickable = typeof onDrilldown === "function" && !loading && !notImplemented && value != null;
  const handleActivate = () => {
    if (clickable) onDrilldown(result);
  };
  const interactiveProps = clickable
    ? {
        className: "report-kpi-card--clickable",
        role: "button",
        tabIndex: 0,
        "aria-label": `${label} — view records`,
        onClick: handleActivate,
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleActivate();
          }
        },
      }
    : {};

  return (
    <LayerSurface
      radius="var(--radius-sm)"
      padding={compact ? "14px" : "16px"}
      gap="6px"
      style={{ minWidth: 0, flex: "1 1 180px" }}
      sectionKey={devSectionKey}
      sectionType="stat-card"
      data-dev-text-preview={label}
      {...interactiveProps}
    >
      {loading && <SkeletonKeyframes />}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {loading ? (
          <SkeletonBlock width="64%" height="14px" borderRadius="999px" />
        ) : (
          <span style={{ fontSize: "0.78rem", color: "var(--surfaceTextMuted)", lineHeight: 1.2 }}>{label}</span>
        )}
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

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 2 }}>
          <SkeletonBlock width={compact ? "72px" : "96px"} height={compact ? "24px" : "32px"} borderRadius="var(--radius-sm)" />
          <SkeletonBlock width="42%" height="10px" borderRadius="999px" />
        </div>
      ) : notImplemented ? (
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

      {showProvenance && <ProvenanceFooter meta={result?.provenance} warnings={result?.warnings} compact />}
    </LayerSurface>
  );
}
