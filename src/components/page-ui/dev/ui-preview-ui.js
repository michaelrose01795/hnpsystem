import Link from "next/link";

// Visual shell for /dev/ui/[uiKey]. Renders a thin labelled header above the
// previewed page-ui so it's obvious which UI is being shown standalone.
//
// The previewed UI is expected to render its own `.app-page-shell` /
// `.app-page-card` wrappers — this component supplies only the meta header.
export function UiPreviewShell({ uiKey, label, children }) {
  return (
    <div data-dev-ui-preview style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 16px",
          background: "var(--surfaceMutedToken, var(--theme))",
          borderBottom: "1px solid var(--border)",
          fontSize: 12,
          color: "var(--text-1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong style={{ fontSize: 13, color: "var(--primary)" }}>UI Preview</strong>
          <span aria-hidden="true">·</span>
          <span>{label}</span>
          <code
            style={{
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(var(--primary-rgb), 0.08)",
              color: "var(--primary)",
            }}
          >
            {uiKey}
          </code>
        </div>
        <Link
          href="/dev/ui"
          style={{
            color: "var(--primary)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          ← all UIs
        </Link>
      </div>
      <div>{children}</div>
    </div>
  );
}

// Index renderer — listing every registered uiKey grouped by area.
export function UiPreviewIndex({ groups }) {
  return (
    <div className="app-page-shell">
      <div className="app-page-card">
        <div className="app-page-stack">
          <div className="app-section-card">
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, color: "var(--primary)" }}>Page-UI Preview Index</h1>
              <span style={{ color: "var(--text-1)", fontSize: 13 }}>
                Standalone preview of every <code>src/components/page-ui/*</code> file with
                demo data — no live data, no presentation overlay.
              </span>
            </div>
          </div>

          {groups.map((group) => (
            <div key={group.label} className="app-section-card">
              <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 16 }}>{group.label}</h2>
              <ul
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: 8,
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                }}
              >
                {group.items.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={`/dev/ui/${encodeURIComponent(item.key)}`}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        padding: "10px 12px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                        textDecoration: "none",
                        color: "var(--text-1)",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{item.label}</span>
                      <code style={{ fontSize: 11, color: "var(--text-1)", opacity: 0.7 }}>
                        {item.key}
                      </code>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
