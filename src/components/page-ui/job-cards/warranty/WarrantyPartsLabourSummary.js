// file location: src/components/page-ui/job-cards/warranty/WarrantyPartsLabourSummary.js
// "Parts & Labour Summary (warranty only)": a table of labour/parts net + inc-VAT
// totals, beside a two-segment ring (labour green, parts red, total inc VAT in the
// centre). The ring is an SVG functional diagram primitive — its strokes are
// allowlisted by the borders rule (CLAUDE.md §3.0a). Section is a LayerTheme; the
// table + ring sit on a depth-2 LayerSurface.
import React from "react";
import LayerTheme from "@/components/ui/LayerTheme";
import LayerSurface from "@/components/ui/LayerSurface";
import { formatCurrency } from "@/components/page-ui/job-cards/service-history/historyFormat";

const SIZE = 150;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function WarrantyPartsLabourSummary({ totals, style }) {
  const labourGross = totals?.labour?.gross || 0;
  const labourNet = totals?.labour?.net || 0;
  const partsGross = totals?.parts?.gross || 0;
  const partsNet = totals?.parts?.net || 0;
  const totalGross = totals?.total?.gross || 0;
  const totalNet = totals?.total?.net || 0;

  // Ring segments — labour (green) then parts (red), accumulating arc offsets.
  const segments = [
    { key: "labour", label: "Labour", token: "var(--success)", value: labourGross },
    { key: "parts", label: "Parts", token: "var(--danger)", value: partsGross },
  ];
  const ringTotal = labourGross + partsGross;
  let accumulated = 0;
  const arcs =
    ringTotal > 0
      ? segments
          .filter((seg) => seg.value > 0)
          .map((seg) => {
            const dash = (seg.value / ringTotal) * CIRCUMFERENCE;
            const arc = {
              key: seg.key,
              token: seg.token,
              dasharray: `${dash} ${CIRCUMFERENCE - dash}`,
              dashoffset: -accumulated,
            };
            accumulated += dash;
            return arc;
          })
      : [];

  const rows = [
    { key: "labour", label: "Labour", net: labourNet, gross: labourGross },
    { key: "parts", label: "Parts", net: partsNet, gross: partsGross },
  ];

  return (
    <LayerTheme
      sectionKey="jobcard-tab-warranty-parts-labour"
      parentKey="jobcard-tab-warranty-panel"
      gap="14px"
      style={style}
    >
      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
        Parts &amp; Labour Summary (Warranty)
      </h3>

      <LayerSurface
        sectionKey="jobcard-tab-warranty-parts-labour-body"
        parentKey="jobcard-tab-warranty-parts-labour"
        gap="20px"
        style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}
      >
        {/* Ring + centre total */}
        <div style={{ position: "relative", width: SIZE, height: SIZE, flexShrink: 0 }}>
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label={`Warranty total ${formatCurrency(totalGross)} inc VAT`}
          >
            <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke="rgba(var(--grey-accent-rgb), 0.22)"
                strokeWidth={STROKE}
              />
              {arcs.map((arc) => (
                <circle
                  key={arc.key}
                  cx={CENTER}
                  cy={CENTER}
                  r={RADIUS}
                  fill="none"
                  stroke={arc.token}
                  strokeWidth={STROKE}
                  strokeDasharray={arc.dasharray}
                  strokeDashoffset={arc.dashoffset}
                  strokeLinecap="butt"
                />
              ))}
            </g>
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-1)", lineHeight: 1 }}>
              {formatCurrency(totalGross)}
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-1)",
                opacity: 0.6,
                marginTop: "2px",
              }}
            >
              total inc VAT
            </span>
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: "1 1 280px", minWidth: 0, overflowX: "auto" }}>
          <table className="app-data-table app-data-table--rounded">
            <thead>
              <tr>
                <th>Type</th>
                <th>Total ex VAT</th>
                <th>Total inc VAT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "var(--radius-pill)",
                          background: row.key === "labour" ? "var(--success)" : "var(--danger)",
                          flexShrink: 0,
                        }}
                      />
                      {row.label}
                    </span>
                  </td>
                  <td>{formatCurrency(row.net)}</td>
                  <td>{formatCurrency(row.gross)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ fontWeight: 700 }}>Total</td>
                <td style={{ fontWeight: 700 }}>{formatCurrency(totalNet)}</td>
                <td style={{ fontWeight: 700 }}>{formatCurrency(totalGross)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </LayerSurface>
    </LayerTheme>
  );
}
