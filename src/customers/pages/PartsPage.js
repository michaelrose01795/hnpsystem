// ✅ Imports converted to use absolute alias "@/"
// file location: src/customers/pages/PartsPage.js
import React from "react";
import CustomerLayout from "@/customers/components/CustomerLayout";
import PartsAccessCard from "@/customers/components/PartsAccessCard";
import VehicleGarageCard from "@/customers/components/VehicleGarageCard";
import { availableParts, customerVehicles } from "@/customers/data/placeholders";

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
