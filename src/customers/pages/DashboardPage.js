// file location: src/customers/pages/DashboardPage.js
import React from "react";
import CustomerLayout from "../components/CustomerLayout";
import CustomerHero from "../components/CustomerHero";
import VehicleGarageCard from "../components/VehicleGarageCard";
import VHCSummaryList from "../components/VHCSummaryList";
import PartsAccessCard from "../components/PartsAccessCard";
import MessagingHub from "../components/MessagingHub";
import AppointmentTimeline from "../components/AppointmentTimeline";
import {
  customerVehicles,
  vhcSummaries,
  availableParts,
  messageContacts,
  appointmentTimeline,
} from "../data/placeholders";

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
