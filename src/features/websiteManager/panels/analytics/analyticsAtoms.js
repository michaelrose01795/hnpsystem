// file location: src/features/websiteManager/panels/analytics/analyticsAtoms.js
// Shared, stateless presentational atoms for the Website Analytics sections.
// Kept inside the analytics folder because they are specific to this area.
//
// These render data-visualisation primitives (stat cards, bar lists, tables) —
// the inline `background` on a bar fill is a chart primitive, not a card
// surface, so it is outside the CLAUDE.md §3.0 surface rules.
import React from "react";
import LayerTheme from "@/components/ui/LayerTheme";
import { cellStyle, headCellStyle, EmptyState } from "../../helpers";

// Thousands-separated integer, e.g. 48213 → "48,213".
export function formatNumber(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("en-GB");
}

// Seconds → "2m 48s" / "52s".
export function formatDuration(sec) {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// Pence-free GBP, e.g. 17995 → "£17,995".
export function formatGbp(n) {
  if (n == null) return "—";
  return `£${Number(n).toLocaleString("en-GB")}`;
}

// A single headline metric tile. Renders as a <LayerTheme> so it alternates
// correctly inside a <Section> (which is a LayerSurface).
export function StatCard({ label, value, hint }) {
  return (
    <LayerTheme padding="14px" gap="4px" style={{ flex: "1 1 160px", minWidth: 160 }}>
      <div style={{ fontSize: "0.78rem", color: "var(--text-1)" }}>{label}</div>
      <div style={{ fontSize: "1.7rem", fontWeight: 700, color: "var(--accentText)" }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: "0.74rem", color: "var(--text-1)" }}>{hint}</div>}
    </LayerTheme>
  );
}

// Responsive row of StatCards.
export function StatGrid({ children }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>{children}</div>
  );
}

// Honest "no data yet" panel for an analytics section. There is no tracking
// backend, so every analytics section renders this instead of fabricated
// figures. `metrics` lists what the section will show once connected;
// `endpoint` is the API route that will supply it.
export function NotConnectedNotice({
  lead,
  metrics = [],
  endpoint,
  heading = "Analytics tracking not yet connected",
}) {
  return (
    <LayerTheme padding="18px" gap="12px">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span className="app-badge app-badge--warning app-badge--uppercase">No data</span>
        <span style={{ fontWeight: 700, color: "var(--accentText)" }}>{heading}</span>
      </div>
      {lead && (
        <p style={{ margin: 0, color: "var(--text-1)", fontSize: "0.9rem" }}>{lead}</p>
      )}
      {metrics.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--text-1)",
            }}
          >
            Will appear here once connected
          </span>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              color: "var(--text-1)",
              fontSize: "0.86rem",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {metrics.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {endpoint && (
        <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--text-1)" }}>
          TODO: connect{" "}
          <span style={{ fontFamily: "monospace" }}>{endpoint}</span> (staff-auth
          gated; never exposed on the public /website).
        </p>
      )}
    </LayerTheme>
  );
}

// Horizontal bar list — items: [{ label, value, sub? }].
// Bars are scaled against the largest value in the set.
export function BarList({ items = [], format = formatNumber, emptyMessage = "No data." }) {
  if (!items.length) return <EmptyState message={emptyMessage} />;
  const max = Math.max(...items.map((i) => Number(i.value) || 0), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              fontSize: "0.84rem",
            }}
          >
            <span style={{ fontWeight: 600 }}>{item.label}</span>
            <span style={{ color: "var(--text-1)", whiteSpace: "nowrap" }}>
              {format(item.value)}
              {item.sub ? ` · ${item.sub}` : ""}
            </span>
          </div>
          {/* Chart track + fill — data-viz primitive, not a card surface. */}
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-sm, 6px)",
              height: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: "var(--accentMain)",
                height: "100%",
                width: `${Math.max(2, ((Number(item.value) || 0) / max) * 100)}%`,
                borderRadius: "var(--radius-sm, 6px)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Generic data table. columns: [{ label, render(row), align?, nowrap? }].
// Follows the same inline-styled table pattern used by the other panels so the
// analytics area stays visually consistent with the rest of Website Manager.
export function DataTable({ columns = [], rows = [], rowKey, emptyMessage = "No data." }) {
  if (!rows.length) return <EmptyState message={emptyMessage} />;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                style={{ ...headCellStyle, textAlign: col.align || "left" }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={rowKey ? rowKey(row, ri) : ri}>
              {columns.map((col, ci) => (
                <td
                  key={ci}
                  style={{
                    ...cellStyle,
                    textAlign: col.align || "left",
                    ...(col.nowrap ? { whiteSpace: "nowrap" } : {}),
                    ...(col.muted ? { color: "var(--text-1)" } : {}),
                  }}
                >
                  {col.render(row, ri)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Coloured pill — `tone` maps to an app-badge variant.
const TONE_BADGE = {
  accent: "app-badge--accent-soft",
  success: "app-badge--success",
  warning: "app-badge--warning",
  danger: "app-badge--danger",
  neutral: "app-badge--neutral",
};
export function Pill({ tone = "neutral", children, uppercase = false }) {
  return (
    <span
      className={`app-badge ${TONE_BADGE[tone] || TONE_BADGE.neutral}${
        uppercase ? " app-badge--uppercase" : ""
      }`}
    >
      {children}
    </span>
  );
}
