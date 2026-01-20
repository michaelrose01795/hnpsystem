// file location: src/pages/dev/status-snapshot.js
import { useCallback, useState } from "react";

export default function StatusSnapshotDevPage() {
  const [jobInput, setJobInput] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isProduction = process.env.NODE_ENV === "production";

  const fetchSnapshot = useCallback(async () => {
    const trimmed = jobInput.trim();
    if (!trimmed) {
      setError("Enter a job number or job id.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/status/snapshot?jobId=${encodeURIComponent(trimmed)}`);
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to load snapshot");
      }
      setSnapshot(payload.snapshot);
    } catch (err) {
      setSnapshot(null);
      setError(err.message || "Unable to load snapshot");
    } finally {
      setLoading(false);
    }
  }, [jobInput]);

  if (isProduction) {
    return (
      <div style={{ padding: "32px" }}>
        <h1>Status Snapshot</h1>
        <p>This page is only available in development mode.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px" }}>
      <h1>Status Snapshot (Dev)</h1>
      <p style={{ marginBottom: "16px", color: "var(--text-secondary)" }}>
        Enter a job number or job id to view the snapshot response.
      </p>
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
        <input
          type="text"
          value={jobInput}
          onChange={(event) => setJobInput(event.target.value)}
          placeholder="Job number or id"
          style={{
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid var(--surface-light)",
            minWidth: "240px",
          }}
        />
        <button
          type="button"
          onClick={fetchSnapshot}
          disabled={loading}
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            border: "none",
            background: "var(--primary)",
            color: "var(--text-inverse)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {loading ? "Loading..." : "Fetch Snapshot"}
        </button>
      </div>
      {error && (
        <div style={{ color: "var(--danger)", marginBottom: "16px" }}>{error}</div>
      )}
      {snapshot && (
        <pre
          style={{
            background: "var(--surface-light)",
            padding: "16px",
            borderRadius: "8px",
            overflowX: "auto",
          }}
        >
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      )}
    </div>
  );
}
