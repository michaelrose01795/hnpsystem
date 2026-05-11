// file location: src/features/customerPortal/components/sections/OwnershipDashboardCard.js
// Per-vehicle ownership snapshot for /website/profile: MOT due, service due,
// warranty, recalls, tyre status, battery, mileage, plus a health score and
// upcoming recommended work. Mileage / MOT / service prefer live data
// returned by /api/website/profile; the rest is mock until each integration
// is wired (recall API, tyre status, battery telemetry).
import React from "react";
import SectionShell from "./SectionShell";
import { Stack, Grid, Tile, Field, FieldGrid, SubHeader, Badge } from "./_websiteParts";

const MOCK = {
  warrantyExpiry: "31 Dec 2027",
  recalls: 0,
  tyreStatus: "All 4 within tolerance",
  batteryHealth: "Healthy · 12.6V",
  upcomingWork: "Brake fluid flush recommended at next service",
  healthScore: 86,
};

function ScoreRing({ score = 0 }) {
  const tone =
    score >= 80 ? "#58c790" : score >= 60 ? "#f7b955" : "#e85a5a";
  return (
    <div
      style={{
        width: 78,
        height: 78,
        borderRadius: "50%",
        background: `conic-gradient(${tone} ${score * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 62,
          height: 62,
          borderRadius: "50%",
          background: "rgba(20, 20, 26, 0.92)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 800, color: "var(--txt-bright)" }}>
          {score}
        </span>
        <span style={{ fontSize: 9, color: "var(--txt-mute)", letterSpacing: "0.4px", textTransform: "uppercase" }}>
          health
        </span>
      </div>
    </div>
  );
}

export default function OwnershipDashboardCard({ vehicles = [] }) {
  const list = vehicles.length ? vehicles : [{ reg: "DEMO123", makeModel: "Example Vehicle" }];
  return (
    <SectionShell
      id="ownership"
      eyebrow="Ownership hub"
      title="Vehicle health overview"
      count={`${list.length} vehicle${list.length === 1 ? "" : "s"}`}
      todo={{
        label: "Recall API, tyre status & battery telemetry not linked yet",
        detail:
          "MOT / service / mileage use live data when available. Recall, tyre and battery values shown below are mock until those integrations are wired.",
      }}
    >
      <Stack gap={12}>
        {list.map((v) => (
          <Tile key={v.id || v.reg} padding={16}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <ScoreRing score={MOCK.healthScore} />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "var(--txt-bright)" }}>
                  {v.makeModel || "Vehicle"}
                </span>
                <Badge>{v.reg}</Badge>
              </div>
            </div>
            <FieldGrid>
              <Field label="MOT due" value={v.motDue} />
              <Field label="Service due" value={v.nextService} />
              <Field label="Warranty" value={v.warrantyExpiry || MOCK.warrantyExpiry} />
              <Field
                label="Recalls"
                value={MOCK.recalls === 0 ? "None outstanding" : `${MOCK.recalls} open`}
              />
              <Field label="Tyre status" value={MOCK.tyreStatus} />
              <Field label="Battery" value={MOCK.batteryHealth} />
              <Field label="Mileage" value={v.mileage ? `${v.mileage} miles` : "—"} />
            </FieldGrid>
            <div>
              <SubHeader>Upcoming recommended work</SubHeader>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--txt-bright)" }}>
                {MOCK.upcomingWork}
              </p>
            </div>
          </Tile>
        ))}
      </Stack>
    </SectionShell>
  );
}
