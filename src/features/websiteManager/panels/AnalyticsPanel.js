// file location: src/features/websiteManager/panels/AnalyticsPanel.js
// Website Analytics / Customer Behaviour panel — the "Analytics" tab of the
// staff-side Website Manager.
//
// This panel is a thin orchestrator: it owns the analytics sub-tab state and
// delegates each area to its own section component under ./analytics. Adding a
// new analytics area = add a section file + one entry in SUB_TABS / SECTIONS.
//
// No fabricated figures are shown. There is no analytics/tracking backend, so
// each data section renders an honest "tracking not connected" empty state
// that names what it will show and the /api/website/analytics/* endpoint that
// will supply it. The Automation Roadmap section shows real planned-work
// content. See analyticsData.js for the full backend wiring plan.
//
// Access: this panel renders only inside /staff/website-manager, which is
// role-gated to Admin / Managers / Sales. Analytics are NEVER exposed on the
// public /website pages.
import React, { useState } from "react";
import Section from "@/components/Section";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import TrafficSection from "./analytics/TrafficSection";
import PagePerformanceSection from "./analytics/PagePerformanceSection";
import CustomerBehaviourSection from "./analytics/CustomerBehaviourSection";
import AccountsSection from "./analytics/AccountsSection";
import EnquiriesSection from "./analytics/EnquiriesSection";
import StockInsightsSection from "./analytics/StockInsightsSection";
import AutomationRoadmapSection from "./analytics/AutomationRoadmapSection";
import ContentAuditSection from "./analytics/ContentAuditSection";

const SUB_TABS = [
  { value: "traffic", label: "Traffic" },
  { value: "pages", label: "Page Performance" },
  { value: "behaviour", label: "Customer Behaviour" },
  { value: "accounts", label: "Accounts & Logins" },
  { value: "enquiries", label: "Enquiries & Leads" },
  { value: "stock", label: "Stock Insights" },
  { value: "roadmap", label: "Automation Roadmap" },
  { value: "audit", label: "Content Audit" },
];

const SECTIONS = {
  traffic: TrafficSection,
  pages: PagePerformanceSection,
  behaviour: CustomerBehaviourSection,
  accounts: AccountsSection,
  enquiries: EnquiriesSection,
  stock: StockInsightsSection,
  roadmap: AutomationRoadmapSection,
  audit: ContentAuditSection,
};

export default function AnalyticsPanel() {
  const [activeSub, setActiveSub] = useState("traffic");
  const ActiveSection = SECTIONS[activeSub] || TrafficSection;

  return (
    <>
      <Section
        title="Website Analytics & Customer Behaviour"
        subtitle="Traffic, page performance, customer behaviour, accounts, leads and stock insights for the public /website. Staff-only — these figures are never shown on the public site."
      >
        <TabGroup
          items={SUB_TABS}
          value={activeSub}
          onChange={(value) => setActiveSub(value)}
          ariaLabel="Website Analytics sections"
          layout="wrap"
        />
      </Section>

      <ActiveSection />
    </>
  );
}
