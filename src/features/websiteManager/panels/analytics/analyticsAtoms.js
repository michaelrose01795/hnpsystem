// file location: src/features/websiteManager/panels/analytics/analyticsAtoms.js
// Shared, stateless presentational atoms for the Website Analytics sections.
// Kept inside the analytics folder because they are specific to this area.
//
// Presentation matches the rest of the Website Manager: `.app-data-table` for
// tables, the canonical `<EmptyState>` for "no data", `.website-manager__*`
// classes (in src/styles/features/website-manager.css) for everything else.
// The bar track/fill are data-visualisation primitives rather than card
// surfaces, so they live in that stylesheet too — not as inline styles.
import React from "react";
import LayerTheme from "@/components/ui/LayerTheme";
import EmptyState from "@/components/ui/EmptyState";

// Re-exported so analytics sections keep importing StatCard from here.
export { StatCard } from "../../helpers";

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

// Responsive row of StatCards.
export function StatGrid({ children }) {
  return <div className="website-manager__stat-grid">{children}</div>;
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
    <LayerTheme gap="var(--space-3)">
      <div className="website-manager__chip-row">
        <span className="app-badge app-badge--warning app-badge--uppercase">No data</span>
        <span className="website-manager__editor-title">{heading}</span>
      </div>
      {lead && <p className="website-manager__meta">{lead}</p>}
      {metrics.length > 0 && (
        <div className="website-manager__field">
          <span className="website-manager__label">Will appear here once connected</span>
          <ul className="website-manager__bullets">
            {metrics.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {endpoint && (
        <p className="website-manager__meta">
          {"TODO: connect "}
          <span className="website-manager__cell-mono">{endpoint}</span>
          {" (staff-auth gated; never exposed on the public /website)."}
        </p>
      )}
    </LayerTheme>
  );
}

// Horizontal bar list — items: [{ label, value, sub? }].
// Bars are scaled against the largest value in the set.
export function BarList({ items = [], format = formatNumber, emptyMessage = "No data yet." }) {
  if (!items.length) {
    return <EmptyState variant="bare" role="status" title="Nothing to chart" description={emptyMessage} />;
  }
  const max = Math.max(...items.map((i) => Number(i.value) || 0), 1);
  return (
    <div className="website-manager__bars">
      {items.map((item) => (
        <div key={item.label} className="website-manager__bar-row">
          <div className="website-manager__bar-head">
            <span className="website-manager__cell-strong">{item.label}</span>
            <span className="website-manager__cell-muted website-manager__cell-nowrap">
              {format(item.value)}
              {item.sub ? ` · ${item.sub}` : ""}
            </span>
          </div>
          {/* Chart track + fill — data-viz primitive, not a card surface.
              The fill width is the datum itself, so it stays inline. */}
          <div className="website-manager__bar-track">
            <div
              className="website-manager__bar-fill"
              style={{ width: `${Math.max(2, ((Number(item.value) || 0) / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Generic data table. columns: [{ label, render(row), align?, nowrap?, muted? }].
export function DataTable({ columns = [], rows = [], rowKey, emptyMessage = "No data yet." }) {
  if (!rows.length) {
    return <EmptyState variant="bare" role="status" title="Nothing to show" description={emptyMessage} />;
  }
  const cellClass = (col) =>
    [
      col.align === "right" ? "website-manager__cell-right" : null,
      col.nowrap ? "website-manager__cell-nowrap" : null,
      col.muted ? "website-manager__cell-muted" : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="website-manager__table-scroll">
      <table className="app-data-table">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                className={col.align === "right" ? "website-manager__cell-right" : undefined}
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
                <td key={ci} className={cellClass(col)}>
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
