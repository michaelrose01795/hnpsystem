// ✅ Imports converted to use absolute alias "@/"
// file location: src/customers/pages/PartsPage.js
import React, { useMemo } from "react";
import { useRouter } from "next/router";
import CustomerLayout from "@/customers/components/CustomerLayout";
import PartsAccessCard from "@/customers/components/PartsAccessCard";
import VehicleGarageCard from "@/customers/components/VehicleGarageCard";
import { useCustomerPortalData } from "@/customers/hooks/useCustomerPortalData";

export default function CustomerPartsPage() {
  const { parts, vehicles, isLoading, error } = useCustomerPortalData();
  const router = useRouter();
  const vehicleFilter = (router.query.vehicle || "").toString().toUpperCase();
  const filteredParts = useMemo(() => {
    if (!vehicleFilter) return parts;
    return parts.filter((part) =>
      part.appliesTo?.some((reg) => reg.toUpperCase().includes(vehicleFilter))
    );
  }, [parts, vehicleFilter]);
  const activeVehicle = vehicleFilter
    ? vehicles.find((vehicle) => vehicle.reg?.toUpperCase() === vehicleFilter)
    : null;

  return (
    <CustomerLayout pageTitle="Parts & accessories">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}
      {isLoading ? (
        <div className="rounded-2xl border border-[var(--surface-light)] bg-white p-5 text-sm text-slate-500 shadow mb-4">
          Loading compatible parts…
        </div>
      ) : null}
      {activeVehicle && (
        <div className="mb-4 rounded-2xl border border-[var(--surface-light)] bg-[var(--background)] px-4 py-3 text-xs text-slate-600">
          Showing accessories for <strong>{activeVehicle.makeModel}</strong> · {activeVehicle.reg}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <PartsAccessCard parts={filteredParts} />
        <VehicleGarageCard vehicles={vehicles} />
      </div>
    </CustomerLayout>
  );
}
