// file location: src/features/customerPortal/components/sections/PartsPortalExtrasCard.js
// Parts portal using live job parts, requests and customer order cards.
import React from "react";
import SectionShell from "./SectionShell";
import { Grid, Tile, SubHeader, ItemList, ItemRow, Badge, GhostBtn, Empty } from "./_websiteParts";

const formatDate = (value) => {
  if (!value) return "TBC";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBC";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const partTitle = (item) =>
  item.part_name_snapshot ||
  item.row_description ||
  item.description ||
  item.part?.name ||
  item.part?.part_number ||
  "Part";

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

export default function PartsPortalExtrasCard({
  partsJobItems = [],
  partsRequests = [],
  partsOrderCards = [],
}) {
  return (
    <SectionShell
      id="parts-hub"
      eyebrow="Parts"
      title="Parts portal"
      todo={{
        label: "VIN-driven parts catalogue and accessory upsell API not wired yet",
        detail: "Job parts, parts requests and order cards are live where records exist. VIN fitment and accessory recommendations still require a catalogue API.",
      }}
    >
      <Tile padding={14}>
        <SubHeader>VIN lookup</SubHeader>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="text" placeholder="Enter VIN or registration" style={inputStyle} disabled />
          <GhostBtn>Find parts</GhostBtn>
        </div>
      </Tile>

      <Grid min={260}>
        <Tile padding={14}>
          <SubHeader>Job parts</SubHeader>
          {partsJobItems.length === 0 ? (
            <Empty>No job parts are currently linked to this account.</Empty>
          ) : (
            <ItemList>
              {partsJobItems.slice(0, 8).map((item) => (
                <ItemRow
                  key={item.id}
                  title={partTitle(item)}
                  meta={`Qty ${item.quantity_requested || 1} - ETA ${formatDate(item.eta_date)}`}
                  right={<Badge tone={String(item.status).includes("fitted") ? "ok" : "open"}>{item.status || "Pending"}</Badge>}
                />
              ))}
            </ItemList>
          )}
        </Tile>

        <Tile padding={14}>
          <SubHeader>Parts requests</SubHeader>
          {partsRequests.length === 0 ? (
            <Empty>No parts requests are awaiting action.</Empty>
          ) : (
            <ItemList>
              {partsRequests.slice(0, 8).map((request) => (
                <ItemRow
                  key={request.request_id}
                  title={partTitle(request)}
                  meta={`Qty ${request.quantity || 1} - ${formatDate(request.updated_at || request.created_at)}`}
                  right={<Badge tone={String(request.status).includes("approved") ? "ok" : "open"}>{request.status || "Pending"}</Badge>}
                />
              ))}
            </ItemList>
          )}
        </Tile>
      </Grid>

      <Tile padding={14}>
        <SubHeader>Order tracking</SubHeader>
        {partsOrderCards.length === 0 ? (
          <Empty>No customer parts orders are linked to this account.</Empty>
        ) : (
          <ItemList>
            {partsOrderCards.slice(0, 8).map((order) => (
              <ItemRow
                key={order.id}
                title={order.order_number || "Parts order"}
                meta={`${order.vehicle_reg || "Vehicle TBC"} - ETA ${formatDate(order.delivery_eta)}${order.delivery_window ? ` - ${order.delivery_window}` : ""}`}
                right={<Badge tone={String(order.delivery_status).includes("delivered") ? "ok" : "open"}>{order.delivery_status || order.status}</Badge>}
              />
            ))}
          </ItemList>
        )}
      </Tile>
    </SectionShell>
  );
}
