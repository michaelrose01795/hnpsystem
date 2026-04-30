// file location: src/features/jobCards/components/JobWorkflowDiagnostics.js
import React from "react";

// Lightweight diagnostics panel for development-only troubleshooting.
export default function JobWorkflowDiagnostics({ diagnostics = null }) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  if (!diagnostics) {
    return null;
  }

  return (
    <details
      style={{
        borderRadius: "var(--radius-sm)",
        border: "1px dashed var(--accent-purple)",
        backgroundColor: "var(--surface)",
        padding: "10px 12px",
      }}
    >
      <summary style={{ cursor: "pointer", fontWeight: 700, color: "var(--accent-purple)" }}>
        Workflow diagnostics (dev only)
      </summary>
      <pre
        style={{
          marginTop: "10px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: "12px",
          color: "var(--text-1)",
        }}
      >
        {JSON.stringify(diagnostics, null, 2)}
      </pre>
    </details>
  );
}
