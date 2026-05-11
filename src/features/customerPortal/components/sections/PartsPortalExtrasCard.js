// file location: src/features/customerPortal/components/sections/PartsPortalExtrasCard.js
// VIN lookup, accessory upsells, and order tracking with collection-ready
// statuses. parts_requests exist server-side but the customer-facing VIN→
// fitment lookup and accessory catalogue are TBC.
import React from "react";
import SectionShell from "./SectionShell";
import { Stack, Grid, Tile, SubHeader, ItemList, ItemRow, Badge, GhostBtn } from "./_websiteParts";

const MOCK_UPSELLS = [
  { id: "u1", title: "Genuine boot mat", price: 79, fitTime: "5 mins" },
  { id: "u2", title: "Wireless phone charger cradle", price: 119, fitTime: "20 mins" },
  { id: "u3", title: "All-season floor mat set", price: 64, fitTime: "—" },
];

const MOCK_ORDERS = [
  { id: "o1", part: "Front brake pads (set)", placed: "Mon 12:02", status: "In stock · ready for fit", eta: "Tomorrow" },
  { id: "o2", part: "Rear tyre · 225/45R18", placed: "Mon 12:05", status: "Awaiting supplier", eta: "Wed PM" },
  { id: "o3", part: "Pollen filter", placed: "Fri 09:30", status: "Ready for collection", eta: "Today" },
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

export default function PartsPortalExtrasCard() {
  return (
    <SectionShell
      id="parts-hub"
      eyebrow="Parts"
      title="Parts portal"
      todo={{ label: "VIN-driven parts catalogue and accessory upsell API not wired yet" }}
    >
      <Tile padding={14}>
        <SubHeader>VIN lookup</SubHeader>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="text" placeholder="Enter VIN or registration" style={inputStyle} disabled />
          <GhostBtn>Find parts</GhostBtn>
        </div>
      </Tile>

      <Tile padding={14}>
        <SubHeader>Suggested accessories</SubHeader>
        <Grid min={200}>
          {MOCK_UPSELLS.map((u) => (
            <div
              key={u.id}
              style={{ padding: 12, background: "rgba(255,255,255,0.04)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 6 }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--txt-bright)" }}>{u.title}</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: "var(--accentText)" }}>£{u.price.toFixed(2)}</span>
              <span style={{ fontSize: 11, color: "var(--txt-mute)" }}>Fit time {u.fitTime}</span>
              <GhostBtn style={{ alignSelf: "flex-start" }}>Add to next visit</GhostBtn>
            </div>
          ))}
        </Grid>
      </Tile>

      <Tile padding={14}>
        <SubHeader>Order tracking</SubHeader>
        <ItemList>
          {MOCK_ORDERS.map((o) => {
            const ready = String(o.status).toLowerCase().includes("ready");
            return (
              <ItemRow
                key={o.id}
                title={o.part}
                meta={`Placed ${o.placed} · ETA ${o.eta}`}
                right={<Badge tone={ready ? "ok" : "open"}>{o.status}</Badge>}
              />
            );
          })}
        </ItemList>
      </Tile>
    </SectionShell>
  );
}
