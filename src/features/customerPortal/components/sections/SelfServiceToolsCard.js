// file location: src/features/customerPortal/components/sections/SelfServiceToolsCard.js
// Customer self-service tools: seasonal reminders, service plan summary,
// loyalty / referral, intelligent advisory reminders. Mileage self-update and
// "add another vehicle" live in the existing /website sections above.
import React from "react";
import SectionShell from "./SectionShell";
import { Grid, Tile, SubHeader, ItemList, ItemRow, Badge, GhostBtn, MoneyHero } from "./_websiteParts";

const MOCK_REMINDERS = [
  { id: "r1", label: "Winter tyre swap", when: "Late October" },
  { id: "r2", label: "Pollen filter (hay-fever season)", when: "Early April" },
  { id: "r3", label: "Cabin re-charge (air-con)", when: "May" },
];

const MOCK_PLAN = {
  plan: "Service & MOT plan",
  monthly: 24.99,
  nextPayment: "01 Jun 2026",
  coverage: ["Annual service", "MOT", "Up to 4 free advisories per visit"],
};

const MOCK_LOYALTY = {
  points: 1240,
  tier: "Silver",
  nextTier: "Gold (1,800 pts)",
};

const MOCK_ADVISORIES = [
  "Rear pads flagged amber at last visit — likely due in ~4,000 miles.",
  "Brake fluid last replaced 2 years ago — recommended next visit.",
];

export default function SelfServiceToolsCard() {
  return (
    <SectionShell
      id="self-service"
      eyebrow="Self service"
      title="Reminders, plans & loyalty"
      todo={{ label: "Seasonal reminders, service plans and loyalty programme not in schema yet" }}
    >
      <Grid min={260}>
        <Tile padding={14}>
          <SubHeader>Seasonal reminders</SubHeader>
          <ItemList>
            {MOCK_REMINDERS.map((r) => (
              <ItemRow key={r.id} title={r.label} meta={r.when} />
            ))}
          </ItemList>
        </Tile>

        <Tile padding={14}>
          <SubHeader>Service plan</SubHeader>
          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--txt-bright)" }}>
            {MOCK_PLAN.plan} · £{MOCK_PLAN.monthly.toFixed(2)} / mo
          </span>
          <span style={{ fontSize: 12, color: "var(--txt-soft)" }}>
            Next payment {MOCK_PLAN.nextPayment}
          </span>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 3 }}>
            {MOCK_PLAN.coverage.map((c, i) => (
              <li key={i} style={{ fontSize: 12, color: "var(--txt-soft)" }}>· {c}</li>
            ))}
          </ul>
        </Tile>

        <Tile padding={14}>
          <SubHeader>Loyalty &amp; referral</SubHeader>
          <MoneyHero label={`${MOCK_LOYALTY.tier} · ${MOCK_LOYALTY.nextTier}`} value={`${MOCK_LOYALTY.points} pts`} />
          <GhostBtn style={{ alignSelf: "flex-start" }}>Refer a friend</GhostBtn>
        </Tile>

        <Tile padding={14}>
          <SubHeader>Intelligent advisory reminders</SubHeader>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {MOCK_ADVISORIES.map((a, i) => (
              <li
                key={i}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 10,
                  padding: "8px 10px",
                  fontSize: 12,
                  color: "var(--txt-soft)",
                }}
              >
                {a}
              </li>
            ))}
          </ul>
        </Tile>
      </Grid>
    </SectionShell>
  );
}
