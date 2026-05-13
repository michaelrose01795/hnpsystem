// file location: src/features/customerPortal/components/sections/FamilyGarageCard.js
// Family / shared garage shell. Current customer and vehicles are live; shared
// access needs a household schema.
import React from "react";
import SectionShell from "./SectionShell";
import { Tile, SubHeader, ItemList, ItemRow, Badge, GhostBtn, Empty } from "./_websiteParts";

export default function FamilyGarageCard({ customer, vehicles = [] }) {
  const customerName =
    [customer?.firstname, customer?.lastname].filter(Boolean).join(" ") ||
    customer?.name ||
    customer?.email ||
    "Account holder";

  return (
    <SectionShell
      id="family"
      eyebrow="Household"
      title="Family & shared garage"
      action={<GhostBtn href="#messages">Request shared access</GhostBtn>}
      todo={{ label: "Shared accounts / household schema not built yet" }}
    >
      <Tile padding={14}>
        <SubHeader>Members</SubHeader>
        <ItemList>
          <ItemRow
            title={customerName}
            meta={`${customer?.email || "No email stored"} - ${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"}`}
            right={<Badge tone="ok">Owner</Badge>}
          />
        </ItemList>
      </Tile>

      <Tile padding={14}>
        <SubHeader>Shared vehicles</SubHeader>
        {vehicles.length === 0 ? (
          <Empty>No vehicles are linked to this account yet.</Empty>
        ) : (
          <ItemList>
            {vehicles.map((vehicle) => (
              <ItemRow
                key={vehicle.vehicle_id || vehicle.reg_number}
                title={vehicle.reg_number || vehicle.registration || "Vehicle"}
                meta={vehicle.make_model || [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle details TBC"}
              />
            ))}
          </ItemList>
        )}
      </Tile>
    </SectionShell>
  );
}
