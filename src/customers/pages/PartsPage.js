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
    <CustomerLayout>
      {error && (
        <div className="mb-4 rounded-2xl border border-[var(--danger)] bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger-dark)]">
          {error}
        </div>
      )}
      {isLoading ? (
        <div className="mb-4 rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)]">
          Loading compatible parts…
        </div>
      ) : null}
      {activeVehicle && (
        <div className="mb-4 rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--text-secondary)]">
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
