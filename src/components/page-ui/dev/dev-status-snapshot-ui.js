// file location: src/components/page-ui/dev/dev-status-snapshot-ui.js

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
      return <div style={{
  padding: "32px"
}}>
        <h1>Status Snapshot</h1>
        <p>This page is only available in development mode.</p>
      </div>; // render extracted page section.

    case "section2":
      return <div style={{
  padding: "32px"
}}>
      <h1>Status Snapshot (Dev)</h1>
      <p style={{
    marginBottom: "16px",
    color: "var(--text-secondary)"
  }}>
        Enter a job number or job id to view the snapshot response.
      </p>
      <div style={{
    display: "flex",
    gap: "12px",
    marginBottom: "16px"
  }}>
        <input type="text" value={jobInput} onChange={event => setJobInput(event.target.value)} placeholder="Job number or id" style={{
      padding: "10px 12px",
      borderRadius: "var(--radius-xs)",
      border: "none",
      minWidth: "240px"
    }} />
        <button type="button" onClick={fetchSnapshot} disabled={loading} style={{
      padding: "10px 16px",
      borderRadius: "var(--radius-xs)",
      border: "none",
      background: "var(--primary)",
      color: "var(--text-inverse)",
      fontWeight: 600,
      cursor: "pointer"
    }}>
          {loading ? "Loading..." : "Fetch Snapshot"}
        </button>
      </div>
      {error && <div style={{
    color: "var(--danger)",
    marginBottom: "16px"
  }}>{error}</div>}
      {snapshot && <pre style={{
    background: "var(--surface-light)",
    padding: "16px",
    borderRadius: "var(--radius-xs)",
    overflowX: "auto"
  }}>
          {JSON.stringify(snapshot, null, 2)}
        </pre>}
    </div>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
