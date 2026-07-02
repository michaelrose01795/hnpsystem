// file location: src/components/page-ui/dev/dev-status-snapshot-ui.js
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

export default function StatusSnapshotDevPageUi(props) {
  const {
    error,
    fetchSnapshot,
    jobInput,
    loading,
    setJobInput,
    snapshot,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return (
        <div style={{ padding: "8px 8px 32px" }}>
          <LayerSurface style={{ width: "100%" }} gap="8px">
            <h1 style={{ margin: 0 }}>Status Snapshot</h1>
            <p style={{ margin: 0, color: "var(--text-1)" }}>
              This page is only available in development mode.
            </p>
          </LayerSurface>
        </div>
      ); // render extracted page section.

    case "section2":
      return (
        <div style={{ padding: "8px 8px 32px" }}>
          <LayerSurface style={{ width: "100%" }} gap="12px">
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <h1 style={{ margin: 0 }}>Status Snapshot (Dev)</h1>
              <p style={{ margin: 0, color: "var(--text-1)" }}>
                Enter a job number or job id to view the snapshot response.
              </p>
            </div>

            <LayerTheme padding="12px" gap="8px" style={{ width: "100%" }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px",
                  alignItems: "center",
                }}
              >
                <input
                  type="text"
                  value={jobInput}
                  onChange={event => setJobInput(event.target.value)}
                  placeholder="Job number or id"
                  style={{
                    flex: "1 1 240px",
                    minWidth: "200px",
                    minHeight: "44px",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-xs)",
                    border: "1px solid var(--input-ring)",
                    background: "var(--surface)",
                    color: "var(--text-1)",
                  }}
                />
                <button
                  type="button"
                  onClick={fetchSnapshot}
                  disabled={loading}
                  style={{
                    flex: "0 0 auto",
                    minHeight: "44px",
                    padding: "10px 16px",
                    borderRadius: "var(--radius-xs)",
                    border: "none",
                    background: "var(--primary)",
                    color: "var(--text-2)",
                    fontWeight: 600,
                    cursor: loading ? "default" : "pointer",
                  }}
                >
                  {loading ? "Loading..." : "Fetch Snapshot"}
                </button>
              </div>
              {error && (
                <div style={{ color: "var(--danger)", fontWeight: 600 }}>{error}</div>
              )}
            </LayerTheme>

            {snapshot && (
              <LayerTheme padding="12px" style={{ width: "100%" }}>
                <pre
                  style={{
                    margin: 0,
                    color: "var(--text-1)",
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "13px",
                    lineHeight: 1.5,
                    whiteSpace: "pre",
                    overflowX: "auto",
                  }}
                >
                  {JSON.stringify(snapshot, null, 2)}
                </pre>
              </LayerTheme>
            )}
          </LayerSurface>
        </div>
      ); // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
