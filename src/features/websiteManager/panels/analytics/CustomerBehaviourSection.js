// file location: src/features/websiteManager/panels/analytics/CustomerBehaviourSection.js
// Analytics area 3 — Customer behaviour.
//
// No behaviour figures are shown: there is no vehicle-view / save / search
// event tracking backend, so this section renders an honest "not connected"
// empty state rather than fabricated numbers. See analyticsData.js.
import React from "react";
import Section from "@/components/Section";
import { NotConnectedNotice } from "./analyticsAtoms";

export default function CustomerBehaviourSection() {
  return (
    <Section
      title="Customer Behaviour"
      subtitle="What customers look at, save, search for and do on their way to an enquiry."
    >
      {/* TODO: connect /api/website/analytics/behaviour — derive from
          website_page_views (vehicle detail routes), website_search_events
          and a saved/favourite events table once they exist. */}
      <NotConnectedNotice
        lead="Customer behaviour insights will appear here once vehicle-view, save and search events are being tracked on the public /website."
        metrics={[
          "Cars viewed most",
          "Cars saved / favourited",
          "Cars customers enquire about most",
          "On-site search terms used",
          "Filters used most — price, mileage, fuel, gearbox, make/model",
          "Pages visited immediately before an enquiry",
          "Customer path / timeline through the website",
        ]}
        endpoint="/api/website/analytics/behaviour"
      />
    </Section>
  );
}
