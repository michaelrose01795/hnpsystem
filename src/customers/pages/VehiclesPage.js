// file location: src/customers/pages/VehiclesPage.js
import React from "react";
import CustomerLayout from "../components/CustomerLayout";
import VehicleGarageCard from "../components/VehicleGarageCard";
import AppointmentTimeline from "../components/AppointmentTimeline";
import { customerVehicles, appointmentTimeline } from "../data/placeholders";

export default function CustomerVehiclesPage() {
  return (
    <CustomerLayout pageTitle="My vehicles">
      <div className="grid gap-6 lg:grid-cols-2">
        <VehicleGarageCard vehicles={customerVehicles} />
        <AppointmentTimeline events={appointmentTimeline} />
      </div>
    </CustomerLayout>
  );
}
