// file location: src/features/customerPortal/components/sections/SalesShowroomCard.js
// Sales hub: saved cars, price alerts, reservations, part-exchange offers,
// in-progress vehicle orders with delivery countdown. No customer-side
// sales schema exists yet — fully mock.
import React from "react";
import SectionShell from "./SectionShell";
import { Stack, Grid, Tile, SubHeader, Badge, ProgressBar, MoneyHero } from "./_websiteParts";

const MOCK_SAVED = [
  { id: "s1", title: "2024 BMW 320i M Sport", price: 28950, alert: "Price drop · -£500" },
  { id: "s2", title: "2023 Mercedes A200 AMG Line", price: 25450, alert: null },
];

const MOCK_RESERVED = [
  { id: "r1", title: "2024 Audi A3 35 TFSI · Sapphire Blue", deposit: 500, status: "Reserved · awaiting paperwork" },
];

const MOCK_PX = [
  { id: "p1", reg: "DEMO123", makeModel: "Golf GTI 2021", quoted: 14250, status: "Awaiting your acceptance" },
];

const MOCK_ORDER = {
  vehicle: "2025 Land Rover Discovery Sport",
  stage: "In transit from supplier",
  pct: 72,
  deliveryWindow: "Wed 28 May – Fri 30 May",
  daysToGo: 17,
};

export default function SalesShowroomCard() {
  return (
    <SectionShell
      id="sales-hub"
      eyebrow="Sales"
      title="Showroom & orders"
      todo={{ label: "Customer-side sales tables (watchlist, reservations, PX, orders) not built yet" }}
    >
      <Tile padding={14}>
        <SubHeader>Saved cars &amp; price alerts</SubHeader>
        <Grid min={220}>
          {MOCK_SAVED.map((s) => (
            <div
              key={s.id}
              style={{
                padding: 14,
                background: "rgba(255,255,255,0.04)",
                borderRadius: 12,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 800, color: "var(--txt-bright)" }}>{s.title}</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--accentText)" }}>
                £{s.price.toLocaleString()}
              </span>
              {s.alert ? <Badge tone="ok">{s.alert}</Badge> : null}
            </div>
          ))}
        </Grid>
      </Tile>

      <Grid min={260}>
        <Tile padding={14}>
          <SubHeader>Reservations</SubHeader>
          {MOCK_RESERVED.map((r) => (
            <div
              key={r.id}
              style={{ padding: 12, background: "rgba(255,255,255,0.04)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 4 }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--txt-bright)" }}>{r.title}</span>
              <span style={{ fontSize: 11, color: "var(--txt-soft)" }}>
                Deposit £{r.deposit.toFixed(2)} · {r.status}
              </span>
            </div>
          ))}
        </Tile>

        <Tile padding={14}>
          <SubHeader>Part-exchange offers</SubHeader>
          {MOCK_PX.map((p) => (
            <div
              key={p.id}
              style={{ padding: 12, background: "rgba(255,255,255,0.04)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 6 }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--txt-bright)" }}>
                {p.makeModel} · {p.reg}
              </span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--accentText)" }}>
                £{p.quoted.toLocaleString()}
              </span>
              <Badge tone="open">{p.status}</Badge>
            </div>
          ))}
        </Tile>
      </Grid>

      <Tile padding={16}>
        <SubHeader>Order in progress</SubHeader>
        <MoneyHero label={MOCK_ORDER.vehicle} value={`${MOCK_ORDER.daysToGo} days to delivery`} />
        <ProgressBar pct={MOCK_ORDER.pct} />
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--txt-soft)" }}>{MOCK_ORDER.stage}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accentText)" }}>
            {MOCK_ORDER.deliveryWindow}
          </span>
        </div>
      </Tile>
    </SectionShell>
  );
}
