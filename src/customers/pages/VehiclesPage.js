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
    <CustomerLayout pageTitle="My vehicles">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}
      {isLoading ? (
        <div className="rounded-2xl border border-[#ffe0e0] bg-white p-5 text-sm text-slate-500 shadow mb-4">
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
