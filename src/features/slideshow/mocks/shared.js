// Small shared helpers used by every slideshow mock so the visual language
// stays consistent with the real app. These are presentation-only — no data
// fetching, no side effects.

export const mockCellStyle = {
  padding: "10px 12px",
  fontSize: 13,
  color: "var(--text-primary)",
};

export const mockHeaderCellStyle = {
  ...mockCellStyle,
  background: "var(--surfaceMuted, rgba(0,0,0,0.03))",
  fontWeight: 700,
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-secondary)",
};

const STATUS_COLORS = {
  "In Progress":        { bg: "rgba(59,130,246,0.12)", fg: "#1d4ed8" },
  "Awaiting Parts":     { bg: "rgba(234,179,8,0.15)",  fg: "#a16207" },
  "Ready for Collection": { bg: "rgba(34,197,94,0.15)", fg: "#166534" },
  "Booked":             { bg: "rgba(99,102,241,0.15)", fg: "#4338ca" },
  "Ordered":            { bg: "rgba(234,179,8,0.15)",  fg: "#a16207" },
  "Goods In":           { bg: "rgba(59,130,246,0.12)", fg: "#1d4ed8" },
  "In Stock":           { bg: "rgba(34,197,94,0.15)",  fg: "#166534" },
  "Fitted":             { bg: "rgba(107,114,128,0.15)", fg: "#374151" },
};

export function StatusPill({ status }) {
  const c = STATUS_COLORS[status] || { bg: "rgba(107,114,128,0.15)", fg: "#374151" };
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 999,
      background: c.bg,
      color: c.fg,
      fontWeight: 600,
      fontSize: 12,
    }}>{status}</span>
  );
}

export function PageShell({ title, subtitle, children }) {
  return (
    <div className="app-page-shell">
      <div className="app-page-card">
        <div className="app-page-stack">
          {(title || subtitle) && (
            <div className="app-section-card">
              {title && <h1 style={{ margin: 0, color: "var(--accentText, var(--text-primary))", fontSize: 22 }}>{title}</h1>}
              {subtitle && <div style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>{subtitle}</div>}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

export function KpiTile({ label, value, hint }) {
  return (
    <div className="app-section-card" style={{ minWidth: 160 }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", margin: "6px 0 2px" }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{hint}</div>}
    </div>
  );
}

export function Field({ label, value, full }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: 4 }}>{label}</div>
      <div style={{
        padding: "10px 12px",
        background: "var(--surface, #fff)",
        borderRadius: 6,
        fontSize: 14,
        color: "var(--text-primary)",
        minHeight: 18,
      }}>{value || "—"}</div>
    </div>
  );
}

export function PrimaryBtn({ children, ...rest }) {
  return <button type="button" className="app-btn app-btn--primary" {...rest}>{children}</button>;
}

export function GhostBtn({ children, ...rest }) {
  return <button type="button" className="app-btn app-btn--ghost" {...rest}>{children}</button>;
}
