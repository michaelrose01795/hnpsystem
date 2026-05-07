// ✅ Imports converted to use absolute alias "@/"
// file location: src/features/customerPortal/pages/PartsPage.js
import React, { useMemo } from "react";
import { useRouter } from "next/router";
import CustomerLayout from "@/features/customerPortal/components/CustomerLayout";
import PartsAccessCard from "@/features/customerPortal/components/PartsAccessCard";
import VehicleGarageCard from "@/features/customerPortal/components/VehicleGarageCard";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { useCustomerPortalData } from "@/features/customerPortal/hooks/useCustomerPortalData";

export default function CustomerPartsPage() {
  const { parts, vehicles, error } = useCustomerPortalData();
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
        <div className="rounded-2xl bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger-dark)]">
          {error}
        </div>
      )}
      {activeVehicle && (
        <div className="rounded-2xl bg-[var(--theme)] px-4 py-3 text-xs text-[var(--text-1)]">
          Showing accessories for <strong>{activeVehicle.makeModel}</strong> · {activeVehicle.reg}
        </div>
      )}
      <DevLayoutSection
        sectionKey="customer-parts-grid"
        parentKey="customer-portal-page-stack"
        sectionType="section-shell"
        backgroundToken="customer-parts-grid"
        style={{
          display: "grid",
          gap: "var(--page-stack-gap)",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          width: "100%",
        }}
      >
        <PartsAccessCard parts={filteredParts} />
        <VehicleGarageCard vehicles={vehicles} />
      </DevLayoutSection>
    </CustomerLayout>
  );
}
