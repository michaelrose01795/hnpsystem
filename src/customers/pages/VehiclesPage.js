// ✅ Imports converted to use absolute alias "@/"
// file location: src/customers/pages/VehiclesPage.js
import React from "react";
import CustomerLayout from "@/customers/components/CustomerLayout";
import VehicleGarageCard from "@/customers/components/VehicleGarageCard";
import AppointmentTimeline from "@/customers/components/AppointmentTimeline";
import { useCustomerPortalData } from "@/customers/hooks/useCustomerPortalData";

export default function CustomerVehiclesPage() {
  const { vehicles, timeline, isLoading, error } = useCustomerPortalData();

  return (
    <CustomerLayout>
      {error && (
        <div className="mb-4 rounded-2xl border border-[var(--danger)] bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger-dark)]">
          {error}
        </div>
      )}
      {isLoading ? (
        <div className="mb-4 rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)]">
          Loading your vehicles…
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <VehicleGarageCard vehicles={vehicles} />
        <AppointmentTimeline events={timeline} />
      </div>
    </CustomerLayout>
  );
}
