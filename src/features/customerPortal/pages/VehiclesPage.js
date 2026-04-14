// ✅ Imports converted to use absolute alias "@/"
// file location: src/features/customerPortal/pages/VehiclesPage.js
import React from "react";
import CustomerLayout from "@/features/customerPortal/components/CustomerLayout";
import VehicleGarageCard from "@/features/customerPortal/components/VehicleGarageCard";
import AppointmentTimeline from "@/features/customerPortal/components/AppointmentTimeline";
import { useCustomerPortalData } from "@/features/customerPortal/hooks/useCustomerPortalData";

export default function CustomerVehiclesPage() {
  const { vehicles, timeline, isLoading, error } = useCustomerPortalData();

  return (
    <CustomerLayout>
      {error && (
        <div className="mb-4 rounded-2xl border border-[var(--danger)] bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger-dark)]">
          {error}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <VehicleGarageCard vehicles={vehicles} />
        <AppointmentTimeline events={timeline} />
      </div>
    </CustomerLayout>
  );
}
