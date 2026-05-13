// file location: src/features/customerPortal/components/sections/RecallCheckerCard.js
// Recall checker shell. No recall API is connected yet, so the card avoids
// presenting guessed recall status.
import React from "react";
import SectionShell from "./SectionShell";
import { Stack, Tile, Badge, Empty } from "./_websiteParts";

export default function RecallCheckerCard({ vehicles = [] }) {
  return (
    <SectionShell
      id="recalls"
      eyebrow="Manufacturer alerts"
      title="Recall checker"
      todo={{ label: "Manufacturer / DVSA recall API not linked yet" }}
    >
      <Stack gap={12}>
        {vehicles.length === 0 ? <Empty>No vehicles are linked to this account yet.</Empty> : null}
        {vehicles.map((vehicle) => (
          <Tile key={vehicle.vehicle_id || vehicle.reg_number} padding={14}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "var(--txt-bright)" }}>
                {vehicle.make_model || [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle"}
              </span>
              <Badge>{vehicle.reg_number || vehicle.registration || "Reg TBC"}</Badge>
              {vehicle.vin ? (
                <span style={{ fontSize: 11, color: "var(--txt-mute)" }}>VIN {vehicle.vin}</span>
              ) : null}
            </div>
            <Empty>Recall status will appear here once the manufacturer / DVSA API connection is in place.</Empty>
          </Tile>
        ))}
      </Stack>
    </SectionShell>
  );
}
