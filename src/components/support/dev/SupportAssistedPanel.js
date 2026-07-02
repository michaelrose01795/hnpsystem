// file location: src/components/support/dev/SupportAssistedPanel.js
//
// Phase 10 — the "AI-assisted investigation" panel (no external/paid AI). Renders
// the deterministic assistant (src/lib/dev-platform/assistedInvestigation.js)
// over the report's dev-only investigation: a summary, a probable fix, affected
// systems, implementation suggestions, regression warnings and a verification
// checklist. CLAUDE.md: Panel is a theme layer; affected systems + warnings are
// tinted chips/rows (never a surface border); a copyable markdown export.

import React, { useMemo } from "react";
import {
  buildAssistedInvestigation,
  assistedInvestigationMarkdown,
} from "@/lib/dev-platform/assistedInvestigation";
import { Panel, Pill, ConfidenceBar, CopyButton, SourceRef, SubSurface, DashboardGrid } from "@/components/support/dev/supportDevUi";

const TYPE_TONE = { module: "accentText", file: "text-1", component: "text-1", api: "warning-base", table: "success-base" };

export default function SupportAssistedPanel({ report }) {
  const investigation = report?.diagnostics?.investigation || null;
  const assisted = useMemo(
    () => (investigation ? buildAssistedInvestigation(investigation, { report }) : null),
    [investigation, report]
  );

  if (!assisted || !assisted.generated) {
    return (
      <Panel title="Assisted investigation" subtitle="Deterministic — generated from captured diagnostics, no external AI.">
        <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.7 }}>
          No investigation was captured for this report, so there is nothing to assist with yet.
        </div>
      </Panel>
    );
  }

  const markdown = assistedInvestigationMarkdown(assisted);

  return (
    <Panel
      title="Assisted investigation"
      subtitle="Deterministic — generated from captured diagnostics, no external AI."
      actions={<CopyButton text={() => markdown} label="Copy write-up" />}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" }}>
        <strong style={{ color: "var(--accentText)", fontSize: "var(--text-body)" }}>{assisted.headline}</strong>
      </div>
      <div style={{ maxWidth: "60ch" }}>
        <ConfidenceBar value={assisted.confidence} label={`Confidence (${assisted.confidenceLabel})`} />
      </div>

      <p style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", margin: 0 }}>{assisted.summary}</p>

      <SubSurface>
        <div style={{ fontWeight: 700, fontSize: "var(--text-body-sm)", color: "var(--accentText)" }}>Probable fix</div>
        <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)" }}>{assisted.probableFix}</div>
      </SubSurface>

      {assisted.affectedSystems.length > 0 && (
        <div>
          <div style={{ fontSize: "var(--text-body-xs)", textTransform: "uppercase", letterSpacing: "0.03em", opacity: 0.7, color: "var(--text-1)", marginBottom: "6px" }}>
            Affected systems
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {assisted.affectedSystems.map((s, i) =>
              s.type === "file" && s.ref ? (
                <SourceRef key={`${s.type}-${i}`} file={s.ref.file} line={s.ref.line} />
              ) : (
                <Pill key={`${s.type}-${i}`} label={`${s.type}: ${s.value}`} tone={TYPE_TONE[s.type] || "text-1"} />
              )
            )}
          </div>
        </div>
      )}

      {assisted.regressionWarnings.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {assisted.regressionWarnings.map((w, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: "8px",
                padding: "8px 10px",
                borderRadius: "var(--radius-md)",
                background: "color-mix(in srgb, var(--warning-base) 12%, transparent)",
                fontSize: "var(--text-body-sm)",
                color: "var(--text-1)",
              }}
            >
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {(assisted.implementationSuggestions.length > 0 || assisted.verificationChecklist.length > 0) && (
        <DashboardGrid min={320}>
          {assisted.implementationSuggestions.length > 0 && (
            <div>
              <div style={{ fontSize: "var(--text-body-xs)", textTransform: "uppercase", letterSpacing: "0.03em", opacity: 0.7, color: "var(--text-1)", marginBottom: "6px" }}>
                Implementation suggestions
              </div>
              <ol style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "4px" }}>
                {assisted.implementationSuggestions.map((s, i) => (
                  <li key={i} style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)" }}>{s}</li>
                ))}
              </ol>
            </div>
          )}

          {assisted.verificationChecklist.length > 0 && (
            <div>
              <div style={{ fontSize: "var(--text-body-xs)", textTransform: "uppercase", letterSpacing: "0.03em", opacity: 0.7, color: "var(--text-1)", marginBottom: "6px" }}>
                Verification checklist
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {assisted.verificationChecklist.map((c, i) => (
                  <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "var(--text-body-sm)", color: "var(--text-1)", cursor: "default" }}>
                    <input type="checkbox" style={{ marginTop: "3px" }} aria-label={c.text} />
                    <span>{c.text} <Pill label={c.kind} tone={c.kind === "regression" ? "warning-base" : "text-1"} /></span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </DashboardGrid>
      )}
    </Panel>
  );
}
