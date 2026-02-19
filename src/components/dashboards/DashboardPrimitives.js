// file location: src/components/dashboards/DashboardPrimitives.js
// Shared presentational components used across dashboard views.
import React from "react";

export const SectionCard = ({ title, subtitle, children, borderColor = "var(--surface-light)", style }) => (
  <section
    style={{
      background: "var(--surface)",
      borderRadius: "18px",
      padding: "20px",
      border: `1px solid ${borderColor}`,
      boxShadow: "none",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
      ...style,
    }}
  >
    {(title || subtitle) && (
      <div>
        {title && <h2 style={{ margin: 0, fontSize: "1.1rem", color: "var(--primary-dark)" }}>{title}</h2>}
        {subtitle && (
          <p style={{ margin: "4px 0 0", color: "var(--info)", fontSize: "0.9rem" }}>{subtitle}</p>
        )}
      </div>
    )}
    {children}
  </section>
);

export const MetricPill = ({ label, value, accent = "var(--primary-dark)", helper }) => (
  <div
    style={{
      borderRadius: "14px",
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
