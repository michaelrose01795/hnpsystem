// file location: src/features/customerPortal/components/sections/SalesShowroomCard.js
// Sales hub shell. Customer-side watchlist/reservation/order tables are not
// present yet, so this card intentionally avoids example sales rows.
import React from "react";
import SectionShell from "./SectionShell";
import { Grid, Tile, SubHeader, Empty, GhostBtn } from "./_websiteParts";

export default function SalesShowroomCard() {
  return (
    <SectionShell
      id="sales-hub"
      eyebrow="Sales"
      title="Showroom & orders"
      todo={{ label: "Customer-side sales tables for watchlists, reservations, PX and orders not built yet" }}
    >
      <Grid min={260}>
        <Tile padding={14}>
          <SubHeader>Saved cars & price alerts</SubHeader>
          <Empty>Saved cars will appear here once the customer watchlist table is connected.</Empty>
          <GhostBtn href="/website#cars" style={{ alignSelf: "flex-start" }}>Browse cars</GhostBtn>
        </Tile>
        <Tile padding={14}>
          <SubHeader>Reservations and orders</SubHeader>
          <Empty>Reservations, vehicle orders and delivery countdowns will appear once customer sales records are available.</Empty>
        </Tile>
        <Tile padding={14}>
          <SubHeader>Part-exchange offers</SubHeader>
          <Empty>Part-exchange valuations will appear once the sales enquiry workflow is linked to the portal.</Empty>
        </Tile>
      </Grid>
    </SectionShell>
  );
}
