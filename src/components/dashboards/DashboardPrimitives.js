// file location: src/components/dashboards/DashboardPrimitives.js
// Shared presentational utilities for dashboard views: MetricPill, formatCurrency, formatCurrencyRounded.
// SectionCard re-export has been removed — all consumers now import it from @/components/Section directly.
import React from "react";

export const MetricPill = ({ label, value, accent = "var(--primary-dark)", helper }) => (
  <div
    style={{
      borderRadius: "var(--control-radius)",
      padding: "14px 16px",
      border: `1px solid ${accent}33`,
      background: `${accent}0f`,
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    }}
  >
    <span style={{ color: "var(--info)", fontSize: "0.8rem", letterSpacing: "0.05em" }}>{label}</span>
    <strong style={{ fontSize: "1.4rem", color: accent }}>{value}</strong>
    {helper && <span style={{ color: "var(--info)", fontSize: "0.85rem" }}>{helper}</span>}
  </div>
);

export const formatCurrency = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? `£${value.toFixed(2)}`
    : "£0.00";

export const formatCurrencyRounded = (value) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
