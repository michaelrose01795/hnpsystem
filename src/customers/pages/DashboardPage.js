// ✅ Imports converted to use absolute alias "@/"
// file location: src/customers/pages/DashboardPage.js
import React, { useMemo } from "react";
import dayjs from "dayjs";
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
    jobs,
    parts,
    contacts,
    timeline,
    customer,
    isLoading,
    error,
    refreshPortalData,
  } = useCustomerPortalData();

  const lastUpdated = useMemo(() => {
    const timestamps = [];
    (jobs || []).forEach((job) => {
      if (job.updated_at) timestamps.push(new Date(job.updated_at));
      else if (job.created_at) timestamps.push(new Date(job.created_at));
    });
    (vhcSummaries || []).forEach((summary) => {
      if (summary.createdAtRaw) timestamps.push(new Date(summary.createdAtRaw));
    });
    if (!timestamps.length) return null;
    const latest = new Date(Math.max(...timestamps.map((date) => date.getTime())));
    return dayjs(latest).format("DD MMM · HH:mm");
  }, [jobs, vhcSummaries]);

  const nextVisit = useMemo(() => {
    const dated = (vehicles || [])
      .map((vehicle) => vehicle.nextService)
      .filter(Boolean)
      .find((value) => value !== "TBC" && value !== "—");
    return dated || null;
  }, [vehicles]);

  return (
    <CustomerLayout>
      {error && (
        <div className="rounded-2xl border border-[var(--danger)] bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger-dark)] mb-4">
          {error}
        </div>
      )}
      {isLoading ? (
        <div className="rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)]">
          Loading your live workshop data…
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
        <div className="flex flex-col gap-6">
          <CustomerHero nextVisit={nextVisit} lastUpdated={lastUpdated} />
          <CustomerBookingCalendar />
          <VHCSummaryList summaries={vhcSummaries} vehicles={vehicles} />
          <AppointmentTimeline events={timeline} />
        </div>
        <div className="flex flex-col gap-6">
          <CustomerDetailsCard customer={customer} onDetailsSaved={refreshPortalData} />
          <VehicleGarageCard vehicles={vehicles} />
          <PartsAccessCard parts={parts} />
          <MessagingHub contacts={contacts} />
        </div>
      </div>
    </CustomerLayout>
  );
}
