// ✅ Imports converted to use absolute alias "@/"
// file location: src/features/customerPortal/pages/VehiclesPage.js
import React from "react";
import CustomerLayout from "@/features/customerPortal/components/CustomerLayout";
import VehicleGarageCard from "@/features/customerPortal/components/VehicleGarageCard";
import AppointmentTimeline from "@/features/customerPortal/components/AppointmentTimeline";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { useCustomerPortalData } from "@/features/customerPortal/hooks/useCustomerPortalData";

export default function CustomerVehiclesPage() {
  const { vehicles, timeline, error } = useCustomerPortalData();

  return (
    <CustomerLayout>
      {error && (
        <div className="rounded-2xl bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger-dark)]">
          {error}
        </div>
      )}
      <DevLayoutSection
        sectionKey="customer-vehicles-grid"
        parentKey="customer-portal-page-stack"
        sectionType="section-shell"
        backgroundToken="customer-vehicles-grid"
        style={{
          display: "grid",
          gap: "var(--page-stack-gap)",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          width: "100%",
        }}
      >
        <VehicleGarageCard vehicles={vehicles} />
        <AppointmentTimeline events={timeline} />
      </DevLayoutSection>
    </CustomerLayout>
  );
}
