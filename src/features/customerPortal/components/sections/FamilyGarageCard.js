// file location: src/features/customerPortal/components/sections/FamilyGarageCard.js
// Family / shared garage: multiple vehicles under one household with shared
// account access invitations. No shared-account schema exists yet.
import React from "react";
import SectionShell from "./SectionShell";
import { Tile, SubHeader, ItemList, ItemRow, Badge, GhostBtn } from "./_websiteParts";

const MOCK_MEMBERS = [
  { id: "m1", name: "David Rose", email: "david@example.com", role: "Owner", vehicles: 2 },
  { id: "m2", name: "Sarah Rose", email: "sarah@example.com", role: "Driver", vehicles: 1 },
  { id: "m3", name: "James Rose", email: "james@example.com", role: "Pending invite", vehicles: 0 },
];

export default function FamilyGarageCard({ vehicles = [] }) {
  return (
    <SectionShell
      id="family"
      eyebrow="Household"
      title="Family & shared garage"
      action={<GhostBtn>Invite a family member</GhostBtn>}
      todo={{ label: "Shared accounts / household schema not built yet" }}
    >
      <Tile padding={14}>
        <SubHeader>Members</SubHeader>
        <ItemList>
          {MOCK_MEMBERS.map((m) => (
            <ItemRow
              key={m.id}
              title={m.name}
              meta={`${m.email} · ${m.vehicles} vehicle${m.vehicles === 1 ? "" : "s"}`}
              right={<Badge tone={m.role === "Owner" ? "ok" : "neutral"}>{m.role}</Badge>}
            />
          ))}
        </ItemList>
      </Tile>

      <Tile padding={14}>
        <SubHeader>Shared vehicles</SubHeader>
        <p style={{ margin: 0, fontSize: 13, color: "var(--txt-bright)" }}>
          {vehicles.length || 2} vehicle{(vehicles.length || 2) === 1 ? "" : "s"} visible to your household.
        </p>
      </Tile>
    </SectionShell>
  );
}
