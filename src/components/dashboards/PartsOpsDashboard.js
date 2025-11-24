import React from "react";
import PartsDashboardGrid from "@/components/Parts/PartsDashboardGrid";

const emptyState = {
  summaryCards: [],
  workload: [],
  focusItems: [],
  inventoryAlerts: [],
  deliveries: [],
  teamAvailability: [],
};

export default function PartsOpsDashboard({
  title = "Parts Operations Dashboard",
  subtitle = "Live look at the pick queue, inbound deliveries and daily focus so the parts counter stays ahead of workshop demand.",
  data,
}) {
  const content = data || emptyState;
  return (
    <PartsDashboardGrid
      title={title}
      subtitle={subtitle}
      summaryCards={content.summaryCards}
      workload={content.workload}
      focusItems={content.focusItems}
      inventoryAlerts={content.inventoryAlerts}
      deliveries={content.deliveries}
      teamAvailability={content.teamAvailability}
    />
  );
}
