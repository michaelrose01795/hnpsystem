// file location: src/features/customerPortal/components/sections/SmartRepairCard.js
// SMART repair / bodyshop: image uploads, estimate requests, repair timeline,
// before/after gallery. No bodyshop schema is wired for customer-side yet.
import React from "react";
import SectionShell from "./SectionShell";
import { Grid, Tile, SubHeader, ItemList, ItemRow, GhostBtn } from "./_websiteParts";

const MOCK_TIMELINE = [
  { id: "t1", label: "Damage uploaded", at: "Sun 18:42" },
  { id: "t2", label: "Estimate prepared", at: "Mon 09:10" },
  { id: "t3", label: "Booking confirmed", at: "Mon 14:00" },
  { id: "t4", label: "Repair in progress", at: "Wed 08:30" },
];

const MOCK_GALLERY = [
  { id: "g1", label: "Before · driver door scuff" },
  { id: "g2", label: "Before · rear bumper scrape" },
  { id: "g3", label: "After · driver door blended" },
  { id: "g4", label: "After · rear bumper refinished" },
];

function Placeholder({ label }) {
  return (
    <div
      style={{
        height: 110,
        background: "rgba(255,255,255,0.04)",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "0 8px",
        fontSize: 11,
        color: "var(--txt-mute)",
      }}
    >
      {label}
    </div>
  );
}

export default function SmartRepairCard() {
  return (
    <SectionShell
      id="bodyshop"
      eyebrow="Bodyshop"
      title="SMART repair & estimates"
      todo={{ label: "Bodyshop estimate workflow & before/after media bucket not wired yet" }}
    >
      <Tile padding={16}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--txt-soft)" }}>
          Upload photos of any scuffs, scratches or dents and we'll send an instant ballpark estimate before booking you in.
        </p>
        <Grid min={140}>
          <Placeholder label="Tap to upload" />
          <Placeholder label="Tap to upload" />
          <Placeholder label="Tap to upload" />
        </Grid>
        <GhostBtn style={{ alignSelf: "flex-start" }}>Request estimate</GhostBtn>
      </Tile>

      <Tile padding={14}>
        <SubHeader>Repair timeline</SubHeader>
        <ItemList>
          {MOCK_TIMELINE.map((t) => (
            <ItemRow key={t.id} title={t.label} meta={t.at} />
          ))}
        </ItemList>
      </Tile>

      <Tile padding={14}>
        <SubHeader>Before / after gallery</SubHeader>
        <Grid min={140}>
          {MOCK_GALLERY.map((g) => <Placeholder key={g.id} label={g.label} />)}
        </Grid>
      </Tile>
    </SectionShell>
  );
}
