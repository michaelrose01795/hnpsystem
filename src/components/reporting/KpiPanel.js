// file location: src/components/reporting/KpiPanel.js
//
// A fuller KPI panel: headline value + trend chart + optional inline
// drill-down toggle. Used in the Operations / VHC tabs where a metric warrants
// its own card with history. Composes the value and trend hooks; no maths here.

import React, { useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import { useKpiValues, useKpiTrend } from "@/hooks/reporting/useReporting";
import { formatKpiValue, targetHint } from "@/utils/reporting/formatKpiValue";
import KpiTrendChart from "./KpiTrendChart";
import ProvenanceFooter from "./ProvenanceFooter";
import ReportDrilldownTable from "./ReportDrilldownTable";
import { reportDevKey } from "./reportDevOverlay";

const toneColor = (tone) =>
  tone === "good" ? "var(--success-base)" : tone === "bad" ? "var(--danger-base)" : "var(--surfaceTextMuted)";

export default function KpiPanel({ kpi, filter, withTrend = true, withDrilldown = true }) {
  const [open, setOpen] = useState(false);
  const { byId, loading } = useKpiValues([kpi.id], filter);
  const result = byId[kpi.id];
  const unit = result?.unit || kpi.unit || "count";
  const format = result?.format || kpi.format || "0,0";
  const hint = targetHint(result?.targetType || kpi.targetType);
  const trend = useKpiTrend(kpi.id, filter, { enabled: withTrend });
  const notImplemented = !loading && result?.value == null && (result?.warnings || []).some((w) => /declared but not yet/i.test(w));
  const devSectionKey = reportDevKey("report-kpi-panel", kpi.id || kpi.label);

  return (
    <LayerSurface
      radius="var(--radius-sm)"
      padding="16px"
      gap="10px"
      sectionKey={devSectionKey}
      sectionType="content-card"
      data-dev-text-preview={kpi.label || kpi.id}
    >
      {loading && <SkeletonKeyframes />}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: "0.82rem", color: "var(--surfaceTextMuted)" }}>{kpi.label}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            {loading ? (
              <SkeletonBlock width="96px" height="30px" borderRadius="var(--radius-sm)" />
            ) : (
              <span style={{ fontSize: "1.7rem", fontWeight: 700, color: "var(--text-1)" }}>
                {formatKpiValue(result?.value, unit, format)}
              </span>
            )}
            {!loading && result?.value != null && hint.glyph && <span style={{ color: toneColor(hint.tone) }}>{hint.glyph}</span>}
          </div>
        </div>
        {kpi.readiness && kpi.readiness !== "R1" && (
          <span
            style={{
              fontSize: "0.62rem",
              fontWeight: 700,
              color: "var(--warning-base)",
              background: "rgba(var(--primary-rgb), 0.08)",
              borderRadius: 999,
              padding: "1px 7px",
            }}
          >
            {kpi.readiness}
          </span>
        )}
      </div>

      {kpi.description && (
        <div style={{ fontSize: "0.74rem", color: "var(--surfaceTextMuted)", lineHeight: 1.35 }}>{kpi.description}</div>
      )}

      {notImplemented ? (
        <div style={{ fontSize: "0.8rem", color: "var(--surfaceTextMuted)", padding: "8px 0" }}>
          Declared in the catalogue - capture lands in a later phase.
          {kpi.futureNotes ? <span style={{ display: "block", marginTop: 4 }}>{kpi.futureNotes}</span> : null}
        </div>
      ) : (
        withTrend && (
          <KpiTrendChart
            series={trend.series}
            unit={unit}
            format={format}
            loading={trend.loading}
            sectionKey={`${devSectionKey}-trend`}
          />
        )
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {withDrilldown && kpi.hasDrilldown && !loading && !notImplemented && (
          <button
            type="button"
            className="app-btn app-btn--ghost"
            onClick={() => setOpen((o) => !o)}
            style={{ fontSize: "0.74rem", padding: "4px 10px" }}
          >
            {open ? "Hide records" : "View records"}
          </button>
        )}
      </div>

      <ProvenanceFooter meta={result?.provenance} warnings={result?.warnings} compact />

      {open && withDrilldown && (
        <ReportDrilldownTable kpiId={kpi.id} label={kpi.label} filter={filter} onClose={() => setOpen(false)} parentKey={devSectionKey} />
      )}
    </LayerSurface>
  );
}
