// file location: src/components/dev-platform/sections/SupportOverviewSection.js
//
// Phase 11 — the "Overview" tab of the Support hub. A concise landing that
// describes the grouped support areas and offers one-tap jump tiles into every
// other tab (built from the shared tab model). Borderless LayerSurface tiles,
// token-only colour, 44px targets. Pure UI — the parent hub owns tab state and
// passes onSelectTab.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import { Panel } from "@/components/support/dev/supportDevUi";
import { SUPPORT_SECTION_TABS } from "@/lib/dev-platform/supportSectionTabs";

// Every tab except the overview itself is a jump target.
const JUMP_TABS = SUPPORT_SECTION_TABS.filter((tab) => tab.key !== "overview");

// Reset <button> wrapping a <LayerSurface> — same idiom as /dev/index.js's
// AreaTile (there a <Link> wraps the surface). The button carries the click +
// ARIA; the surface stays borderless per the Border Law.
function JumpTile({ tab, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tab.key)}
      aria-label={`Open ${tab.label}`}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        padding: 0,
        margin: 0,
        border: "none",
        background: "transparent",
        textAlign: "left",
        font: "inherit",
        color: "inherit",
        cursor: "pointer",
      }}
    >
      <LayerSurface style={{ gap: "6px", height: "100%", minHeight: 44 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span aria-hidden style={{ fontSize: "22px", lineHeight: 1 }}>{tab.icon}</span>
          <span style={{ fontWeight: 700, fontSize: "var(--text-h4, 15px)", color: "var(--accentText)" }}>
            {tab.label}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.85 }}>
          {tab.description}
        </p>
      </LayerSurface>
    </button>
  );
}

export default function SupportOverviewSection({ onSelectTab }) {
  const select = typeof onSelectTab === "function" ? onSelectTab : () => {};
  return (
    <Panel
      title="Support hub"
      subtitle="Everything for triaging and investigating Help & Diagnostics reports, grouped into the tabs above."
    >
      <p style={{ margin: 0, fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.85 }}>
        Staff report problems from anywhere using the “?” control in the app toolbar. Those reports land
        here for the developer team: triage them under <strong>Reports</strong>, dig into recurring
        incidents under <strong>Investigations</strong>, watch subsystem status under{" "}
        <strong>Health</strong>, and manage delivery under <strong>Notifications</strong> and{" "}
        <strong>Settings</strong>.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "var(--layout-card-gap, 12px)",
        }}
      >
        {JUMP_TABS.map((tab) => (
          <JumpTile key={tab.key} tab={tab} onSelect={select} />
        ))}
      </div>
    </Panel>
  );
}
