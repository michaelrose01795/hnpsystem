// file location: src/components/reporting/ProvenanceFooter.js
//
// Renders the provenance line (source / as-of / live-vs-snapshot / formula
// version) and any warnings the reporting envelope returned. Every reported
// figure in the app shows where it came from (Principle 10) — this is the single
// component that does it so no screen hand-rolls a provenance string.

import React from "react";

export default function ProvenanceFooter({ meta, warnings = [], compact = false }) {
  const hasWarnings = Array.isArray(warnings) && warnings.length > 0;
  if (!meta && !hasWarnings) return null;

  const bits = [];
  if (meta?.source && meta.source !== "none") {
    bits.push(meta.live ? `live (${meta.source})` : meta.source);
  }
  if (meta?.asOf) {
    const d = new Date(meta.asOf);
    if (!Number.isNaN(d.getTime())) bits.push(`as of ${d.toLocaleString("en-GB")}`);
  }
  if (meta?.formulaVersion) bits.push(meta.formulaVersion);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: compact ? 4 : 8 }}>
      {bits.length > 0 && (
        <div style={{ fontSize: "0.72rem", color: "var(--surfaceTextMuted)" }}>{bits.join(" · ")}</div>
      )}
      {hasWarnings &&
        warnings.map((w, i) => (
          <div key={i} style={{ fontSize: "0.72rem", color: "var(--warning-base)" }}>
            ⚠ {w}
          </div>
        ))}
    </div>
  );
}
