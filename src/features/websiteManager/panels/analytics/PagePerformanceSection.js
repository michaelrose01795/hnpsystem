// file location: src/features/websiteManager/panels/analytics/PagePerformanceSection.js
// Analytics area 2 — Page performance.
//
// No per-page figures are shown: there is no page-view tracking backend, so
// this section renders an honest "not connected" empty state rather than
// fabricated numbers. See analyticsData.js for the wiring plan.
import React from "react";
import Section from "@/components/Section";
import { NotConnectedNotice } from "./analyticsAtoms";

export default function PagePerformanceSection() {
  return (
    <Section
      title="Page Performance"
      subtitle="How each public /website page performs once visitor tracking is live."
    >
      {/* TODO: connect /api/website/analytics/pages — derive from
          website_page_views grouped by route once tracking exists. */}
      <NotConnectedNotice
        lead="Page performance figures will appear here once page-view tracking is recording activity per /website page."
        metrics={[
          "Most viewed and least viewed pages",
          "Average time spent per page",
          "Bounce / quick-exit rate per page",
          "Top entry pages (where sessions start)",
          "Top exit pages (where sessions end)",
        ]}
        endpoint="/api/website/analytics/pages"
      />
    </Section>
  );
}
