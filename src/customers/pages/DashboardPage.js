// ✅ Imports converted to use absolute alias "@/"
// file location: src/customers/pages/DashboardPage.js
import React from "react";
import CustomerLayout from "@/customers/components/CustomerLayout";
import CustomerHero from "@/customers/components/CustomerHero";
import VehicleGarageCard from "@/customers/components/VehicleGarageCard";
import VHCSummaryList from "@/customers/components/VHCSummaryList";
import PartsAccessCard from "@/customers/components/PartsAccessCard";
import MessagingHub from "@/customers/components/MessagingHub";
import AppointmentTimeline from "@/customers/components/AppointmentTimeline";
import CustomerBookingCalendar from "@/customers/components/CustomerBookingCalendar";
import CustomerDetailsCard from "@/customers/components/CustomerDetailsCard";
import { useCustomerPortalData } from "@/customers/hooks/useCustomerPortalData";

export default function CustomerDashboardPage() {
  const {
    vehicles,
    vhcSummaries,
    parts,
    contacts,
    timeline,
    customer,
    isLoading,
    error,
    refreshPortalData,
  } = useCustomerPortalData();

  return (
    <CustomerLayout pageTitle="Customer overview">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}
      <CustomerHero nextVisit="24 June · 08:30" lastUpdated="2 minutes ago" />
      {isLoading ? (
        <div className="rounded-2xl border border-[var(--surface-light)] bg-white p-5 text-sm text-slate-500" >
          Loading your live workshop data…
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <CustomerBookingCalendar />
        </div>
        <CustomerDetailsCard customer={customer} onDetailsSaved={refreshPortalData} />
        <VehicleGarageCard vehicles={vehicles} />
        <VHCSummaryList summaries={vhcSummaries} vehicles={vehicles} />
        <PartsAccessCard parts={parts} />
        <MessagingHub contacts={contacts} />
        <AppointmentTimeline events={timeline} />
      </div>
    </CustomerLayout>
  );
}
