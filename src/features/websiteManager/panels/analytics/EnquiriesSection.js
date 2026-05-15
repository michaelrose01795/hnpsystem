// file location: src/features/websiteManager/panels/analytics/EnquiriesSection.js
// Analytics area 5 — Enquiry & lead data.
//
// No enquiry figures are shown: there is no website_enquiries backend, so this
// section renders an honest "not connected" empty state rather than
// fabricated numbers. See analyticsData.js for the wiring plan.
import React from "react";
import Section from "@/components/Section";
import { NotConnectedNotice } from "./analyticsAtoms";

export default function EnquiriesSection() {
  return (
    <Section
      title="Enquiry & Lead Data"
      subtitle="Enquiries submitted through the public /website and the pages they came from."
    >
      {/* TODO: connect /api/website/analytics/enquiries — derive from a
          website_enquiries table that captures every enquiry submission and
          its source page. */}
      <NotConnectedNotice
        lead="Enquiry and lead data will appear here once /website enquiry form submissions are being captured."
        metrics={[
          "Enquiries submitted (all types)",
          "Finance enquiries",
          "Part exchange enquiries",
          "Test drive requests",
          "Service booking interest",
          "Contact form submissions",
          "Lead source page — the car or page each lead came from",
        ]}
        endpoint="/api/website/analytics/enquiries"
      />
    </Section>
  );
}
