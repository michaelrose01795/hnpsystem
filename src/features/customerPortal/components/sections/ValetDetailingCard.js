// file location: src/features/customerPortal/components/sections/ValetDetailingCard.js
// Valet / detailing: package selection, subscription tier, before / after
// media. No customer-facing valet booking schema exists yet — full mock.
import React from "react";
import SectionShell from "./SectionShell";
import { Grid, Tile, SubHeader, Badge, GhostBtn } from "./_websiteParts";

const MOCK_PACKAGES = [
  { id: "p1", title: "Mini valet", price: 35, duration: "45 mins", includes: ["Exterior wash", "Interior vacuum"] },
  { id: "p2", title: "Full valet", price: 75, duration: "2 hrs", includes: ["Full wash + wax", "Interior shampoo", "Tyre dressing"], badge: "Most popular" },
  { id: "p3", title: "Premium detail", price: 195, duration: "Half day", includes: ["Machine polish", "Ceramic sealant", "Leather treatment"] },
];

const MOCK_SUB = {
  tier: "Monthly mini",
  nextVisit: "Sat 30 May · 10:00",
  remaining: "2 visits this month",
};

function PackageTile({ pkg }) {
  return (
    <div
      style={{
        padding: 14,
        background: "rgba(255,255,255,0.04)",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--txt-bright)" }}>{pkg.title}</span>
        {pkg.badge ? <Badge tone="ok">{pkg.badge}</Badge> : null}
      </div>
      <span style={{ fontSize: 18, fontWeight: 800, color: "var(--accentText)" }}>£{pkg.price.toFixed(2)}</span>
      <span style={{ fontSize: 11, color: "var(--txt-mute)" }}>{pkg.duration}</span>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 3 }}>
        {pkg.includes.map((inc, i) => (
          <li key={i} style={{ fontSize: 12, color: "var(--txt-soft)" }}>· {inc}</li>
        ))}
      </ul>
      <GhostBtn style={{ alignSelf: "flex-start" }}>Book this package</GhostBtn>
    </div>
  );
}

export default function ValetDetailingCard() {
  return (
    <SectionShell
      id="valet"
      eyebrow="Valeting"
      title="Valet & detailing"
      todo={{ label: "Valet packages & subscription model not in schema yet" }}
    >
      <Tile padding={14}>
        <SubHeader>Your subscription</SubHeader>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--txt-bright)" }}>{MOCK_SUB.tier}</span>
          <Badge tone="ok">{MOCK_SUB.remaining}</Badge>
        </div>
        <span style={{ fontSize: 12, color: "var(--txt-soft)" }}>
          Next visit · {MOCK_SUB.nextVisit}
        </span>
      </Tile>

      <Tile padding={14}>
        <SubHeader>Packages</SubHeader>
        <Grid min={220}>
          {MOCK_PACKAGES.map((p) => <PackageTile key={p.id} pkg={p} />)}
        </Grid>
      </Tile>
    </SectionShell>
  );
}
