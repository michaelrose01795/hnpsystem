// file location: src/features/websiteManager/panels/analytics/TrafficSection.js
// Analytics area 1 — Website traffic overview.
//
// No traffic figures are shown: there is no page-view / session tracking
// backend, so this section renders an honest "not connected" empty state
// rather than fabricated numbers. See analyticsData.js for the wiring plan.
import React from "react";
import Section from "@/components/Section";
import { NotConnectedNotice } from "./analyticsAtoms";

export default function TrafficSection() {
  return (
    <Section
      title="Website Traffic Overview"
      subtitle="How much traffic the public /website is receiving — visitors, peak times and most active days."
    >
      {/* TODO: connect /api/website/analytics/traffic — derive from the
          website_page_views and website_sessions tables once they exist. */}
      <NotConnectedNotice
        lead="Traffic figures will appear here once visitor tracking is recording page views and sessions on the public /website."
        metrics={[
          "Total /website views, plus views today, this week and this month",
          "Unique visitors, and the returning vs new visitor split",
          "Peak visit times by hour of day",
          "Most active days of the week",
        ]}
        endpoint="/api/website/analytics/traffic"
      />
    </Section>
  );
}
