// file location: src/customers/pages/PartsPage.js
import React from "react";
import CustomerLayout from "../components/CustomerLayout";
import PartsAccessCard from "../components/PartsAccessCard";
import VehicleGarageCard from "../components/VehicleGarageCard";
import { availableParts, customerVehicles } from "../data/placeholders";

export default function CustomerPartsPage() {
  return (
    <CustomerLayout pageTitle="Parts & accessories">
      <div className="grid gap-6 lg:grid-cols-2">
        <PartsAccessCard parts={availableParts} />
        <VehicleGarageCard vehicles={customerVehicles} />
      </div>
    </CustomerLayout>
  );
}
