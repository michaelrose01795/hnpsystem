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
import {
  customerVehicles,
  vhcSummaries,
  availableParts,
  messageContacts,
  appointmentTimeline,
} from "@/customers/data/placeholders";

export default function CustomerDashboardPage() {
  return (
    <CustomerLayout pageTitle="Customer overview">
      <CustomerHero nextVisit="24 June · 08:30" lastUpdated="2 minutes ago" />
      <div className="grid gap-6 lg:grid-cols-2">
        <VehicleGarageCard vehicles={customerVehicles} />
        <VHCSummaryList summaries={vhcSummaries} />
        <PartsAccessCard parts={availableParts} />
        <MessagingHub contacts={messageContacts} />
        <AppointmentTimeline events={appointmentTimeline} />
      </div>
    </CustomerLayout>
  );
}
