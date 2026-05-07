// ✅ Imports converted to use absolute alias "@/"
// file location: src/features/customerPortal/pages/VhcPage.js
import React from "react";
import CustomerLayout from "@/features/customerPortal/components/CustomerLayout";
import VHCSummaryList from "@/features/customerPortal/components/VHCSummaryList";
import MessagingHub from "@/features/customerPortal/components/MessagingHub";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { useCustomerPortalData } from "@/features/customerPortal/hooks/useCustomerPortalData";

export default function CustomerVhcPage() {
  const { vhcSummaries, contacts, vehicles, error } = useCustomerPortalData();

  return (
    <CustomerLayout>
      {error && (
        <div className="rounded-2xl bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger-dark)]">
          {error}
        </div>
      )}
      <DevLayoutSection
        sectionKey="customer-vhc-grid"
        parentKey="customer-portal-page-stack"
        sectionType="section-shell"
        backgroundToken="customer-vhc-grid"
        style={{
          display: "grid",
          gap: "var(--page-stack-gap)",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          width: "100%",
        }}
      >
        <VHCSummaryList summaries={vhcSummaries} vehicles={vehicles} />
        <MessagingHub contacts={contacts} />
      </DevLayoutSection>
    </CustomerLayout>
  );
}
