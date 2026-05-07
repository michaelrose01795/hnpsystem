// file location: src/features/customerPortal/pages/DashboardPage.js
// Customer dashboard ("Overview") — a FIXED layout, no widget add/remove/edit.
// Each section renders a canonical card from src/features/customerPortal/components.
import React, { useMemo } from "react";
import dayjs from "dayjs";
import CustomerLayout from "@/features/customerPortal/components/CustomerLayout";
import CustomerHero from "@/features/customerPortal/components/CustomerHero";
import VehicleGarageCard from "@/features/customerPortal/components/VehicleGarageCard";
import VHCSummaryList from "@/features/customerPortal/components/VHCSummaryList";
import PartsAccessCard from "@/features/customerPortal/components/PartsAccessCard";
import MessagingHub from "@/features/customerPortal/components/MessagingHub";
import AppointmentTimeline from "@/features/customerPortal/components/AppointmentTimeline";
import CustomerBookingCalendar from "@/features/customerPortal/components/CustomerBookingCalendar";
import CustomerDetailsCard from "@/features/customerPortal/components/CustomerDetailsCard";
import PaymentPlansCard from "@/features/customerPortal/components/PaymentPlansCard";
import OutstandingInvoicesCard from "@/features/customerPortal/components/OutstandingInvoicesCard";
import PaymentMethodsCard from "@/features/customerPortal/components/PaymentMethodsCard";
import LayerTheme from "@/components/ui/LayerTheme";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { useCustomerPortalData } from "@/features/customerPortal/hooks/useCustomerPortalData";

const DASHBOARD_SECTION_PARENT = "customer-portal-page-stack";

function MetricTile({ label, value, tone = "default" }) {
  const background =
    tone === "accent"
      ? "color-mix(in srgb, var(--primary) 8%, var(--surface))"
      : "var(--theme)";
  return (
    <div
      style={{
        background,
        borderRadius: "var(--radius-md)",
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "11px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          color: "var(--text-1)",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "1.5rem",
          fontWeight: 600,
          color: "var(--text-1)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function ResponsiveGrid({ children, minColumnWidth = 320, sectionKey }) {
  const style = {
    display: "grid",
    gap: "var(--page-stack-gap)",
    gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minColumnWidth}px), 1fr))`,
    width: "100%",
  };
  if (sectionKey) {
    return (
      <DevLayoutSection
        sectionKey={sectionKey}
        parentKey={DASHBOARD_SECTION_PARENT}
        sectionType="section-shell"
        backgroundToken={sectionKey}
        style={style}
      >
        {children}
      </DevLayoutSection>
    );
  }
  return <div style={style}>{children}</div>;
}

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
    paymentMethods,
    paymentPlans,
    outstandingInvoices,
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

  const trackingStats = useMemo(() => {
    const activeJobs = (jobs || []).filter(
      (job) => !["delivered", "closed", "completed"].includes(String(job.status || "").toLowerCase())
    ).length;
    const pendingVhc = (vhcSummaries || []).filter(
      (summary) => String(summary.status || "").toLowerCase() !== "complete"
    ).length;

    return {
      activeJobs,
      pendingVhc,
      vehicleCount: vehicles?.length || 0,
      nextVisit: nextVisit || "TBC",
    };
  }, [jobs, vhcSummaries, vehicles, nextVisit]);

  const financeStats = useMemo(() => {
    const outstandingTotal = (outstandingInvoices || []).reduce(
      (sum, invoice) => sum + Number(invoice.total || 0),
      0
    );
    const planBalance = (paymentPlans || []).reduce(
      (sum, plan) => sum + Number(plan.balanceDue || 0),
      0
    );
    return {
      outstandingCount: outstandingInvoices?.length || 0,
      outstandingTotal,
      planCount: paymentPlans?.length || 0,
      planBalance,
      savedMethods: paymentMethods?.length || 0,
    };
  }, [outstandingInvoices, paymentPlans, paymentMethods]);

  return (
    <CustomerLayout>
      {error ? (
        <div className="mb-4 rounded-2xl bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger-dark)]">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <PageSkeleton />
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--page-stack-gap)",
            width: "100%",
          }}
        >
          <DevLayoutSection
            sectionKey="customer-dashboard-hero"
            parentKey={DASHBOARD_SECTION_PARENT}
            sectionType="content-card"
            backgroundToken="customer-dashboard-hero"
          >
            <CustomerHero nextVisit={nextVisit} lastUpdated={lastUpdated} />
          </DevLayoutSection>

          <LayerTheme
            sectionKey="customer-dashboard-summary"
            parentKey={DASHBOARD_SECTION_PARENT}
            sectionType="content-card"
            radius="var(--section-card-radius)"
            padding="var(--section-card-padding)"
            gap="var(--space-3)"
          >
            <p
              style={{
                margin: 0,
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.22em",
                color: "var(--text-accent)",
              }}
            >
              At a glance
            </p>
            <h2
              style={{
                margin: 0,
                fontSize: "1.25rem",
                fontWeight: 600,
                color: "var(--text-1)",
              }}
            >
              Your service summary
            </h2>
            <div
              style={{
                display: "grid",
                gap: "var(--space-3)",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
              }}
            >
              <MetricTile
                label="Active jobs"
                value={String(trackingStats.activeJobs)}
                tone="accent"
              />
              <MetricTile label="Pending VHC" value={String(trackingStats.pendingVhc)} />
              <MetricTile label="Vehicles" value={String(trackingStats.vehicleCount)} />
              <MetricTile label="Next visit" value={trackingStats.nextVisit} />
              <MetricTile
                label="Outstanding"
                value={`£${financeStats.outstandingTotal.toFixed(2)}`}
              />
              <MetricTile label="Saved cards" value={String(financeStats.savedMethods)} />
            </div>
          </LayerTheme>

          <ResponsiveGrid sectionKey="customer-dashboard-tracking-row">
            <CustomerBookingCalendar />
            <VHCSummaryList summaries={vhcSummaries} vehicles={vehicles} />
          </ResponsiveGrid>

          <ResponsiveGrid sectionKey="customer-dashboard-vehicles-row">
            <AppointmentTimeline events={timeline} />
            <VehicleGarageCard vehicles={vehicles} />
          </ResponsiveGrid>

          <ResponsiveGrid sectionKey="customer-dashboard-shop-row">
            <PartsAccessCard parts={parts} />
            <MessagingHub contacts={contacts} />
          </ResponsiveGrid>

          <ResponsiveGrid sectionKey="customer-dashboard-finance-row">
            <OutstandingInvoicesCard invoices={outstandingInvoices} />
            <PaymentPlansCard paymentPlans={paymentPlans} />
          </ResponsiveGrid>

          <DevLayoutSection
            sectionKey="customer-dashboard-payment-methods"
            parentKey={DASHBOARD_SECTION_PARENT}
            sectionType="content-card"
            backgroundToken="customer-dashboard-payment-methods"
          >
            <PaymentMethodsCard
              paymentMethods={paymentMethods}
              customerId={customer?.id}
              onPaymentMethodSaved={refreshPortalData}
            />
          </DevLayoutSection>

          <DevLayoutSection
            sectionKey="customer-dashboard-details"
            parentKey={DASHBOARD_SECTION_PARENT}
            sectionType="content-card"
            backgroundToken="customer-dashboard-details"
          >
            <CustomerDetailsCard
              customer={customer}
              onDetailsSaved={refreshPortalData}
            />
          </DevLayoutSection>
        </div>
      )}
    </CustomerLayout>
  );
}
