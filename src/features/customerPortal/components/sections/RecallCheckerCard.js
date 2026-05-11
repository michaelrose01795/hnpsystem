// file location: src/features/customerPortal/components/sections/RecallCheckerCard.js
// Manufacturer / DVSA recall checker. No real endpoint exists yet so this
// renders a "no recalls" template per vehicle plus a mock recall on DEMO456.
import React from "react";
import SectionShell from "./SectionShell";
import { Stack, Tile, Badge, Empty } from "./_websiteParts";

const MOCK_RECALLS_BY_REG = {
  DEMO456: [
    {
      id: "r1",
      reference: "R/2025/142",
      title: "Front passenger airbag inflator inspection",
      issued: "18 Feb 2025",
      severity: "High",
      summary:
        "Manufacturer requires an inspection of the passenger airbag inflator. No charge to the customer.",
    },
  ],
};

export default function RecallCheckerCard({ vehicles = [] }) {
  const list = vehicles.length ? vehicles : [{ reg: "DEMO123", makeModel: "Example Vehicle" }];
  return (
    <SectionShell
      id="recalls"
      eyebrow="Manufacturer alerts"
      title="Recall checker"
      todo={{ label: "Manufacturer / DVSA recall API not linked yet" }}
    >
      <Stack gap={12}>
        {list.map((v) => {
          const recalls = MOCK_RECALLS_BY_REG[v.reg] || [];
          return (
            <Tile key={v.reg} padding={14}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "var(--txt-bright)" }}>
                  {v.makeModel || "Vehicle"}
                </span>
                <Badge>{v.reg}</Badge>
                {v.vin ? (
                  <span style={{ fontSize: 11, color: "var(--txt-mute)" }}>VIN {v.vin}</span>
                ) : null}
              </div>
              {recalls.length === 0 ? (
                <Empty>No outstanding recalls reported for this VIN.</Empty>
              ) : (
                recalls.map((r) => (
                  <div
                    key={r.id}
                    style={{ padding: 12, background: "rgba(255,255,255,0.04)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--txt-bright)" }}>{r.title}</span>
                      <Badge tone="open">{r.severity}</Badge>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--txt-mute)" }}>
                      Ref {r.reference} · Issued {r.issued}
                    </span>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--txt-soft)" }}>{r.summary}</p>
                  </div>
                ))
              )}
            </Tile>
          );
        })}
      </Stack>
    </SectionShell>
  );
}
