// file location: src/features/vhcAssistant/components/VhcAssistantPanel.js

import React, { useMemo } from "react";
import { buildVhcAssistantMessages } from "@/features/vhcAssistant/buildVhcAssistantMessages";

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
  chromeless = false,
}) {
  const messages = useMemo(() => buildVhcAssistantMessages(state), [state]);
  const tone = scoreTone(state?.readinessScore || 0);

  const hasBlockers = Array.isArray(state?.blockers) && state.blockers.length > 0;

  return (
    <section
      style={{
        borderRadius: chromeless ? 0 : "var(--radius-sm)",
        border: "none",
        backgroundColor: chromeless ? "transparent" : "var(--surface)",
        padding: chromeless ? 0 : compact ? "12px" : "16px 20px",
        display: "grid",
        gap: compact ? "8px" : "14px",
        width: "100%",
      }}
      data-dev-section="1"
      data-dev-section-type="content-card"
    >
      {/* Header row: title + readiness + stage */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--primary)", whiteSpace: "nowrap" }}>{title}</h3>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>
            {state?.stageLabel || "VHC status"}
          </p>
        </div>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: tone.fg,
            backgroundColor: tone.bg,
            border: `1px solid ${tone.border}`,
            borderRadius: "999px",
            padding: "4px 12px",
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          Readiness {Math.round(state?.readinessScore || 0)}%
        </span>
      </div>

      {/* Counters row - spread across full width */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--danger-dark)", backgroundColor: "var(--danger-surface)", borderRadius: "999px", padding: "3px 10px" }}>
          Red {state?.counters?.red || 0}
        </span>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--warning-dark)", backgroundColor: "var(--warning-surface)", borderRadius: "999px", padding: "3px 10px" }}>
          Amber {state?.counters?.amber || 0}
        </span>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--success-dark)", backgroundColor: "var(--success-surface)", borderRadius: "999px", padding: "3px 10px" }}>
          Authorised {state?.counters?.authorized || 0}
        </span>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", backgroundColor: "var(--surface-light)", borderRadius: "999px", padding: "3px 10px" }}>
          Awaiting decision {state?.counters?.awaitingCustomerDecision || 0}
        </span>
      </div>

      {/* Main content: summary + next action side by side on wider screens */}
      <div style={{
        display: "grid",
        gridTemplateColumns: hasBlockers ? "1fr 1fr 1fr" : "1fr 1fr",
        gap: "14px",
      }}>
        {/* Summary column */}
        <div style={{ display: "grid", gap: "4px", alignContent: "start" }}>
          <p style={{ margin: "0 0 4px 0", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--grey-accent)", fontWeight: 700 }}>
            Summary
          </p>
          {messages.summary.slice(0, compact ? 2 : 5).map((row) => (
            <p key={row} style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.4 }}>• {row}</p>
          ))}
        </div>

        {/* Next action column */}
        <div style={{
          borderRadius: "var(--radius-xs)",
          border: "1px solid var(--surface-light)",
          backgroundColor: "var(--layer-section-level-1)",
          padding: "12px",
          alignSelf: "start",
        }}>
          <p style={{ margin: "0 0 6px 0", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--grey-accent)", fontWeight: 700 }}>
            Next best action
          </p>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--text-primary)", fontWeight: 600, lineHeight: 1.4 }}>
            {messages.nextActions[0] || "Continue with the current VHC workflow."}
          </p>
        </div>

        {/* Blockers column */}
        {hasBlockers && (
          <div style={{ alignSelf: "start" }}>
            <p style={{ margin: "0 0 6px 0", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--warning-dark)", fontWeight: 700 }}>
              Blockers
            </p>
            <ul style={{ margin: 0, paddingLeft: "16px", display: "grid", gap: "4px" }}>
              {state.blockers.slice(0, compact ? 2 : 5).map((blocker) => (
                <li key={blocker} style={{ fontSize: "12px", color: "var(--warning-dark)", lineHeight: 1.4 }}>{blocker}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {showWhy && (
        <details>
          <summary style={{ cursor: "pointer", fontSize: "12px", color: "var(--text-secondary)" }}>Why this status?</summary>
          <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.4 }}>{messages.stageExplainer}</p>
        </details>
      )}
    </section>
  );
}
