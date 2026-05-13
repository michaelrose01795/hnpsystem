// file location: src/features/customerPortal/components/sections/ValetDetailingCard.js
// Valet / detailing shell with live valet-related customer requests.
import React from "react";
import SectionShell from "./SectionShell";
import { Tile, SubHeader, Badge, GhostBtn, ItemList, ItemRow, Empty } from "./_websiteParts";

const isValetRequest = (request) =>
  /valet|detail|clean|wash/i.test(`${request.description || ""} ${request.confirmation_notes || ""}`);

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function ValetDetailingCard({ bookingRequests = [] }) {
  const requests = bookingRequests.filter(isValetRequest);
  return (
    <SectionShell
      id="valet"
      eyebrow="Valeting"
      title="Valet & detailing"
      todo={{ label: "Valet packages and subscription model not in schema yet" }}
    >
      <Tile padding={14}>
        <SubHeader>Your subscription</SubHeader>
        <Empty>No valet subscription is linked to this account.</Empty>
      </Tile>

      <Tile padding={14}>
        <SubHeader>Valet requests</SubHeader>
        {requests.length === 0 ? (
          <Empty>No valet or detailing requests are currently linked to this account.</Empty>
        ) : (
          <ItemList>
            {requests.map((request) => (
              <ItemRow
                key={request.request_id}
                title={request.description || "Valet request"}
                meta={formatDate(request.submitted_at)}
                right={<Badge tone="open">{request.status || "Pending"}</Badge>}
              />
            ))}
          </ItemList>
        )}
        <GhostBtn href="#messages" style={{ alignSelf: "flex-start" }}>Ask about valet options</GhostBtn>
      </Tile>
    </SectionShell>
  );
}
