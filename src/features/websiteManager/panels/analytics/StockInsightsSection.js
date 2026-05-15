// file location: src/features/websiteManager/panels/analytics/StockInsightsSection.js
// Analytics area 6 — Vehicle stock insights.
//
// No stock figures are shown: advert view / enquiry tracking does not exist,
// so this section renders an honest "not connected" empty state rather than
// fabricated numbers. See analyticsData.js for the wiring plan.
import React from "react";
import Section from "@/components/Section";
import { NotConnectedNotice } from "./analyticsAtoms";

export default function StockInsightsSection() {
  return (
    <Section
      title="Vehicle Stock Insights"
      subtitle="How the vehicle adverts on /website perform once advert tracking is live."
    >
      {/* TODO: connect /api/website/analytics/stock — join the Vehicle/Sale
          tables (prisma/schema.prisma) with advert view + enquiry counts once
          tracking exists. */}
      <NotConnectedNotice
        lead="Vehicle stock insights will appear here once advert views and enquiries are being tracked per vehicle."
        metrics={[
          "Most viewed vehicles",
          "Vehicles with views but no enquiries",
          "Vehicles with enquiries but low views",
          "Average views before an enquiry",
          "Days listed online",
          "Price change history",
          "Stock performance score per advert",
        ]}
        endpoint="/api/website/analytics/stock"
      />
    </Section>
  );
}
