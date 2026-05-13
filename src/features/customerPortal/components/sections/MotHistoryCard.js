// file location: src/features/customerPortal/components/sections/MotHistoryCard.js
// MOT status from stored vehicle records. Full historic tests require the DVLA
// MOT History API.
import React from "react";
import SectionShell from "./SectionShell";
import { Stack, Tile, ItemList, ItemRow, Badge, Empty } from "./_websiteParts";

const formatDate = (value) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const daysUntil = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
};

export default function MotHistoryCard({ vehicles = [] }) {
  return (
    <SectionShell
      id="mot"
      eyebrow="MOT record"
      title="MOT history"
      todo={{
        label: "DVLA MOT History API not linked yet",
        detail: "Stored MOT due dates are live. Full test history, advisories and failures still require the DVLA MOT History connection.",
      }}
    >
      <Stack gap={12}>
        {vehicles.length === 0 ? <Empty>No vehicles are linked to this account yet.</Empty> : null}
        {vehicles.map((vehicle) => {
          const days = daysUntil(vehicle.mot_due);
          const status = days == null ? "Unknown" : days < 0 ? "Overdue" : days <= 30 ? "Due soon" : "Current";
          return (
            <Tile key={vehicle.vehicle_id || vehicle.reg_number} padding={14}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "var(--txt-bright)" }}>
                  {vehicle.make_model || [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle"}
                </span>
                <Badge>{vehicle.reg_number || vehicle.registration || "Reg TBC"}</Badge>
              </div>
              <ItemList>
                <ItemRow
                  title="Current MOT due date"
                  meta={formatDate(vehicle.mot_due)}
                  right={<Badge tone={status === "Current" ? "ok" : "open"}>{status}</Badge>}
                />
              </ItemList>
            </Tile>
          );
        })}
      </Stack>
    </SectionShell>
  );
}
