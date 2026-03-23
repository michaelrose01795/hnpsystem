// file location: src/features/vhc-assistant/components/VhcAssistantPanel.js

import React, { useMemo } from "react";
import { buildVhcAssistantMessages } from "@/features/vhc-assistant/buildVhcAssistantMessages";

const scoreTone = (score = 0) => {
  if (score >= 85) return { fg: "var(--success-dark)", bg: "var(--success-surface)", border: "var(--success)" };
  if (score >= 60) return { fg: "var(--warning-dark)", bg: "var(--warning-surface)", border: "var(--warning)" };
  return { fg: "var(--danger-dark)", bg: "var(--danger-surface)", border: "var(--danger)" };
};

export default function VhcAssistantPanel({
  state,
  title = "VHC Assistant",
  compact = false,
  showWhy = true,
}) {
  const messages = useMemo(() => buildVhcAssistantMessages(state), [state]);
  const tone = scoreTone(state?.readinessScore || 0);

  return (
    <section
      style={{
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border)",
        backgroundColor: "var(--surface)",
        padding: compact ? "12px" : "14px 16px",
        display: "grid",
        gap: compact ? "8px" : "10px",
      }}
      data-dev-section="1"
      data-dev-section-type="content-card"
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--primary)" }}>{title}</h3>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: tone.fg,
            backgroundColor: tone.bg,
            border: `1px solid ${tone.border}`,
            borderRadius: "999px",
            padding: "4px 10px",
            letterSpacing: "0.02em",
          }}
        >
          Readiness {Math.round(state?.readinessScore || 0)}%
        </span>
      </div>

      <p style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>
        {state?.stageLabel || "VHC status"}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        <span style={{ fontSize: "11px", color: "var(--danger-dark)", backgroundColor: "var(--danger-surface)", borderRadius: "999px", padding: "2px 8px" }}>
          Red {state?.counters?.red || 0}
        </span>
        <span style={{ fontSize: "11px", color: "var(--warning-dark)", backgroundColor: "var(--warning-surface)", borderRadius: "999px", padding: "2px 8px" }}>
          Amber {state?.counters?.amber || 0}
        </span>
        <span style={{ fontSize: "11px", color: "var(--success-dark)", backgroundColor: "var(--success-surface)", borderRadius: "999px", padding: "2px 8px" }}>
          Authorised {state?.counters?.authorized || 0}
        </span>
        <span style={{ fontSize: "11px", color: "var(--text-secondary)", backgroundColor: "var(--surface-light)", borderRadius: "999px", padding: "2px 8px" }}>
          Awaiting decision {state?.counters?.awaitingCustomerDecision || 0}
        </span>
      </div>

      <div style={{ display: "grid", gap: "4px" }}>
        {messages.summary.slice(0, compact ? 2 : 4).map((row) => (
          <p key={row} style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)" }}>• {row}</p>
        ))}
      </div>

      <div style={{
        borderRadius: "var(--radius-xs)",
        border: "1px solid var(--surface-light)",
        backgroundColor: "var(--layer-section-level-1)",
        padding: "10px",
      }}>
        <p style={{ margin: "0 0 4px 0", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--grey-accent)", fontWeight: 700 }}>
          Next best action
        </p>
        <p style={{ margin: 0, fontSize: "12px", color: "var(--text-primary)", fontWeight: 600 }}>
          {messages.nextActions[0] || "Continue with the current VHC workflow."}
        </p>
      </div>

      {Array.isArray(state?.blockers) && state.blockers.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: "18px", display: "grid", gap: "4px" }}>
          {state.blockers.slice(0, compact ? 2 : 5).map((blocker) => (
            <li key={blocker} style={{ fontSize: "12px", color: "var(--warning-dark)" }}>{blocker}</li>
          ))}
        </ul>
      )}

      {showWhy && (
        <details>
          <summary style={{ cursor: "pointer", fontSize: "12px", color: "var(--text-secondary)" }}>Why this status?</summary>
          <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>{messages.stageExplainer}</p>
        </details>
      )}
    </section>
  );
}
