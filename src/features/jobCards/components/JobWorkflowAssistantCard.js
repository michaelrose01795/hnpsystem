// file location: src/features/jobCards/components/JobWorkflowAssistantCard.js
import React from "react";

// Compact deterministic assistant summary for job-card workflow.
export default function JobWorkflowAssistantCard({
  guidance,
  workflowSummary,
}) {
  if (!guidance || !workflowSummary) {
    return null;
  }

  const badgeStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    borderRadius: "var(--radius-sm)",
    fontSize: "12px",
    fontWeight: 600,
    backgroundColor: "var(--info-surface)",
    color: "var(--info-dark)",
  };

  return (
    <section
      style={{
        padding: "14px 16px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--accent-purple-surface)",
        backgroundColor: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "11px", letterSpacing: "0.18em", color: "var(--grey-accent)", fontWeight: 700 }}>
            ASSISTANT (RULE-BASED)
          </div>
          <h3 style={{ margin: "6px 0 0", fontSize: "16px", color: "var(--accent-purple)", fontWeight: 700 }}>
            {guidance.title}
          </h3>
        </div>
        <span style={badgeStyle}>Owner: {guidance.ownerRole}</span>
      </div>

      <p style={{ margin: 0, fontSize: "14px", color: "var(--text-secondary)" }}>
        <strong>Next action:</strong> {guidance.action}
      </p>
      <p style={{ margin: 0, fontSize: "13px", color: "var(--grey-accent-dark)" }}>
        {guidance.reason}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        <span style={badgeStyle}>Write-Up: {workflowSummary.writeUpComplete ? "Complete" : "Pending"}</span>
        <span style={badgeStyle}>VHC: {workflowSummary.vhcLabel}</span>
        <span style={badgeStyle}>Parts: {workflowSummary.partsLabel}</span>
        <span style={badgeStyle}>Mileage: {workflowSummary.mileageRecorded ? "Recorded" : "Missing"}</span>
        <span style={badgeStyle}>Invoice: {workflowSummary.invoiceReady ? "Ready" : "Blocked"}</span>
      </div>

      {Array.isArray(guidance.blockers) && guidance.blockers.length > 0 && (
        <div
          style={{
            borderRadius: "var(--radius-sm)",
            border: "none",
            backgroundColor: "var(--warning-surface)",
            padding: "10px 12px",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--warning-dark)", marginBottom: "6px" }}>
            Current blockers
          </div>
          <ul style={{ margin: 0, paddingLeft: "18px", color: "var(--warning-dark)", fontSize: "13px" }}>
            {guidance.blockers.slice(0, 4).map((blocker) => (
              <li key={blocker} style={{ marginBottom: "4px" }}>
                {blocker}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
