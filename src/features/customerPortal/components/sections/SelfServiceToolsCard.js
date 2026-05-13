// file location: src/features/customerPortal/components/sections/SelfServiceToolsCard.js
// Customer self-service tools powered by live vehicle service-plan data and
// VHC declined/advisory rows where present.
import React from "react";
import SectionShell from "./SectionShell";
import { Grid, Tile, SubHeader, ItemList, ItemRow, Badge, GhostBtn, Empty } from "./_websiteParts";

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

export default function SelfServiceToolsCard({ vehicles = [], vhcDeclinations = [] }) {
  const servicePlans = vehicles.filter(
    (vehicle) => vehicle.service_plan_supplier || vehicle.service_plan_type || vehicle.service_plan_expiry,
  );

  return (
    <SectionShell
      id="self-service"
      eyebrow="Self service"
      title="Reminders, plans & loyalty"
      todo={{
        label: "Seasonal reminders and loyalty programme not in schema yet",
        detail: "Service-plan fields and VHC advisory reminders are live where records exist. Seasonal reminder automation and loyalty still require tables/workflows.",
      }}
    >
      <Grid min={260}>
        <Tile padding={14}>
          <SubHeader>Seasonal reminders</SubHeader>
          <Empty>Seasonal reminders will appear once reminder rules are connected.</Empty>
        </Tile>

        <Tile padding={14}>
          <SubHeader>Service plans</SubHeader>
          {servicePlans.length === 0 ? (
            <Empty>No service plan is linked to your vehicles.</Empty>
          ) : (
            <ItemList>
              {servicePlans.map((vehicle) => (
                <ItemRow
                  key={vehicle.vehicle_id || vehicle.reg_number}
                  title={[vehicle.service_plan_supplier, vehicle.service_plan_type].filter(Boolean).join(" - ") || "Service plan"}
                  meta={`${vehicle.reg_number || "Vehicle"} - expires ${formatDate(vehicle.service_plan_expiry)}`}
                />
              ))}
            </ItemList>
          )}
        </Tile>

        <Tile padding={14}>
          <SubHeader>Loyalty & referral</SubHeader>
          <Empty>Loyalty points and referral rewards will appear once the programme schema is connected.</Empty>
          <GhostBtn href="#settings" style={{ alignSelf: "flex-start" }}>Refer a friend</GhostBtn>
        </Tile>

        <Tile padding={14}>
          <SubHeader>Advisory reminders</SubHeader>
          {vhcDeclinations.length === 0 ? (
            <Empty>No declined VHC advisories are waiting to be revisited.</Empty>
          ) : (
            <ItemList>
              {vhcDeclinations.slice(0, 5).map((item) => (
                <ItemRow
                  key={item.vhc_id || `${item.job_id}-${item.issue_title}`}
                  title={item.issue_title || item.section || "VHC advisory"}
                  meta={item.issue_description || item.customer_description}
                  right={<Badge tone="open">Revisit</Badge>}
                />
              ))}
            </ItemList>
          )}
        </Tile>
      </Grid>
    </SectionShell>
  );
}
