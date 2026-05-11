// file location: src/features/customerPortal/components/sections/AiAssistantCard.js
// UI shell for a future ownership AI assistant. Staff-side ai_guide_*
// infrastructure exists; this card establishes the customer-facing placement.
import React, { useState } from "react";
import SectionShell from "./SectionShell";
import { Tile, GhostBtn } from "./_websiteParts";

const SUGGESTIONS = [
  "When is my car next due?",
  "How much did my last service cost?",
  "What were my last VHC advisories?",
  "Book me a valet for Saturday morning.",
];

const inputStyle = {
  flex: "1 1 220px",
  minWidth: 0,
  padding: "10px 14px",
  fontSize: 13,
  background: "rgba(255,255,255,0.05)",
  color: "var(--txt-bright)",
  borderRadius: 999,
  outline: "none",
};

export default function AiAssistantCard() {
  const [draft, setDraft] = useState("");
  return (
    <SectionShell
      id="assistant"
      eyebrow="Help"
      title="Ownership assistant"
      todo={{ label: "Customer-facing AI assistant endpoint not wired yet" }}
    >
      <Tile padding={16}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--txt-soft)" }}>
          Ask anything about your vehicle, history or upcoming visits. The assistant will be wired up to live data soon.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SUGGESTIONS.map((s) => (
            <GhostBtn key={s} onClick={() => setDraft(s)}>
              {s}
            </GhostBtn>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Type a question…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={inputStyle}
          />
          <GhostBtn>Ask</GhostBtn>
        </div>
      </Tile>
    </SectionShell>
  );
}
