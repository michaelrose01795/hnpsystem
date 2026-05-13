// file location: src/features/customerPortal/components/sections/OwnershipDashboardCard.js
// Per-vehicle ownership snapshot for /website/profile using live vehicle data.
// Third-party health integrations are noted as pending instead of showing
// example values.
import React from "react";
import SectionShell from "./SectionShell";
import { Stack, Tile, Field, FieldGrid, SubHeader, Badge, Empty } from "./_websiteParts";

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const vehicleTitle = (vehicle) =>
  vehicle.make_model ||
  vehicle.makeModel ||
  [vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
  "Vehicle";

const vehicleReg = (vehicle) =>
  vehicle.reg_number || vehicle.reg || vehicle.registration || "Registration TBC";

const getHealthScore = (vehicle) => {
  let score = 100;
  const motDue = vehicle.mot_due || vehicle.motDue;
  if (motDue) {
    const days = Math.ceil((new Date(motDue).getTime() - Date.now()) / 86400000);
    if (Number.isFinite(days) && days < 0) score -= 35;
    else if (Number.isFinite(days) && days <= 30) score -= 20;
    else if (Number.isFinite(days) && days <= 60) score -= 10;
  }
  if (!vehicle.mileage) score -= 5;
  if (!vehicle.service_history && !vehicle.service_plan_type) score -= 8;
  return Math.max(0, Math.min(100, score));
};

function ScoreRing({ score = 0 }) {
  const tone = score >= 80 ? "#58c790" : score >= 60 ? "#f7b955" : "#e85a5a";
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
  return (
    <SectionShell
      id="ownership"
      eyebrow="Ownership hub"
      title="Vehicle health overview"
      count={`${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"}`}
      todo={{
        label: "Recall API, tyre status and battery telemetry not linked yet",
        detail:
          "MOT, warranty, service plan and mileage are live. Recall, tyre and battery connections still require third-party APIs.",
      }}
    >
      <Stack gap={12}>
        {vehicles.length === 0 ? <Empty>No vehicles are linked to this account yet.</Empty> : null}
        {vehicles.map((vehicle) => (
          <Tile key={vehicle.vehicle_id || vehicle.id || vehicleReg(vehicle)} padding={16}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <ScoreRing score={getHealthScore(vehicle)} />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "var(--txt-bright)" }}>
                  {vehicleTitle(vehicle)}
                </span>
                <Badge>{vehicleReg(vehicle)}</Badge>
              </div>
            </div>
            <FieldGrid>
              <Field label="MOT due" value={formatDate(vehicle.mot_due || vehicle.motDue)} />
              <Field
                label="Warranty"
                value={[vehicle.warranty_type, formatDate(vehicle.warranty_expiry)].filter(Boolean).join(" - ")}
              />
              <Field
                label="Service plan"
                value={[vehicle.service_plan_supplier, vehicle.service_plan_type, formatDate(vehicle.service_plan_expiry)]
                  .filter(Boolean)
                  .join(" - ")}
              />
              <Field label="Fuel / gearbox" value={[vehicle.fuel_type, vehicle.transmission].filter(Boolean).join(" - ")} />
              <Field label="Mileage" value={vehicle.mileage ? `${vehicle.mileage} miles` : null} />
            </FieldGrid>
            <div>
              <SubHeader>Service notes</SubHeader>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--txt-bright)" }}>
                {vehicle.service_history || "No service-history note has been stored for this vehicle yet."}
              </p>
            </div>
          </Tile>
        ))}
      </Stack>
    </SectionShell>
  );
}
