// file location: src/features/websiteManager/panels/analytics/AutomationRoadmapSection.js
// Analytics area 7 — Content management improvements: a "Coming Soon / TODO"
// roadmap of future automation features for the Website Manager.
//
// Everything here is intentionally informational — none of these features are
// built. They are surfaced so staff can see what is planned.
import React from "react";
import Section from "@/components/Section";
import LayerTheme from "@/components/ui/LayerTheme";
import { AUTOMATION_ROADMAP } from "../../analyticsData";
import { Pill } from "./analyticsAtoms";

// Roadmap stage → badge tone.
const STAGE_TONE = {
  planned: "accent",
  "in design": "success",
  exploring: "warning",
  later: "neutral",
};

export default function AutomationRoadmapSection() {
  return (
    <Section
      title="Content Automation — Coming Soon"
      subtitle="Planned automation for the Website Manager. None of these are live yet — this is the roadmap, not a control panel."
    >
      {/* TODO: each card below represents future work. When a feature is
          built, wire it to its real handler/API and move it out of this
          roadmap list. */}
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
      >
        {AUTOMATION_ROADMAP.map((item) => (
          <LayerTheme key={item.id} padding="14px" gap="8px">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <span style={{ fontWeight: 700, color: "var(--accentText)" }}>
                {item.title}
              </span>
              <Pill tone={STAGE_TONE[item.status] || "neutral"} uppercase>
                {item.status}
              </Pill>
            </div>
            <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--text-1)" }}>
              {item.detail}
            </p>
          </LayerTheme>
        ))}
      </div>
    </Section>
  );
}
