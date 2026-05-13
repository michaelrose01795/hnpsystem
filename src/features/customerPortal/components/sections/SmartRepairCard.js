// file location: src/features/customerPortal/components/sections/SmartRepairCard.js
// SMART repair / bodyshop shell with live bodyshop-related customer requests.
import React from "react";
import SectionShell from "./SectionShell";
import { Grid, Tile, SubHeader, ItemList, ItemRow, GhostBtn, Empty, Badge } from "./_websiteParts";

const isBodyshopRequest = (request) =>
  /body|smart|paint|scratch|dent|repair/i.test(
    `${request.description || ""} ${request.confirmation_notes || ""}`,
  );

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

export default function SmartRepairCard({ bookingRequests = [] }) {
  const requests = bookingRequests.filter(isBodyshopRequest);

  return (
    <SectionShell
      id="bodyshop"
      eyebrow="Bodyshop"
      title="SMART repair & estimates"
      todo={{ label: "Bodyshop estimate workflow and before/after media bucket not wired yet" }}
    >
      <Tile padding={16}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--txt-soft)" }}>
          Send us photos of scuffs, scratches or dents and we'll respond from the workshop workflow.
        </p>
        <Grid min={140}>
          <Placeholder label="Upload connection required" />
          <Placeholder label="Upload connection required" />
          <Placeholder label="Upload connection required" />
        </Grid>
        <GhostBtn href="#messages" style={{ alignSelf: "flex-start" }}>Request estimate</GhostBtn>
      </Tile>

      <Tile padding={14}>
        <SubHeader>Repair requests</SubHeader>
        {requests.length === 0 ? (
          <Empty>No bodyshop or SMART repair requests are currently linked to this account.</Empty>
        ) : (
          <ItemList>
            {requests.map((request) => (
              <ItemRow
                key={request.request_id}
                title={request.description || "Repair request"}
                meta={formatDate(request.submitted_at)}
                right={<Badge tone="open">{request.status || "Pending"}</Badge>}
              />
            ))}
          </ItemList>
        )}
      </Tile>
    </SectionShell>
  );
}
