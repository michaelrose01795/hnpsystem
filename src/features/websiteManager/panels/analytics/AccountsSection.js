// file location: src/features/websiteManager/panels/analytics/AccountsSection.js
// Analytics area 4 — Account & login tracking.
//
// Tracks CUSTOMER accounts on the public /website only (no connection to staff
// accounts). No figures are shown: there is no website_account_events backend,
// so this section renders an honest "not connected" empty state rather than
// fabricated numbers. See analyticsData.js for the wiring plan.
import React from "react";
import Section from "@/components/Section";
import { NotConnectedNotice } from "./analyticsAtoms";

export default function AccountsSection() {
  return (
    <Section
      title="Account & Login Tracking"
      subtitle="Customer accounts created and used on the public /website — not staff accounts."
    >
      {/* TODO: connect /api/website/analytics/accounts — derive from a
          website_account_events table (signup / login / failed-login). */}
      <NotConnectedNotice
        lead="Customer account activity will appear here once /website signup and login events are being recorded."
        metrics={[
          "Customer logins through /website",
          "New accounts created",
          "Returning customer logins",
          "Failed login attempts",
          "Last login date per account",
          "Customer activity per account — saved cars, enquiries, login count",
        ]}
        endpoint="/api/website/analytics/accounts"
      />
    </Section>
  );
}
