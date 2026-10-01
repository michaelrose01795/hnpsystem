// file location: src/features/customers/hub/CustomerOverviewTab.js
//
// The Overview tab: a dashboard of the customer's current position, then the
// four things staff work from — vehicles, schedule, files, and the contact log.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import EmptyState from "@/components/ui/EmptyState";
import CustomerVehiclesSection from "./CustomerVehiclesSection";
import CustomerScheduleSection from "./CustomerScheduleSection";
import CustomerFilesSection from "./CustomerFilesSection";
import CustomerContactLog from "./CustomerContactLog";
import { RecordFieldGrid, RecordHeading, StatusBadge, LinkButton } from "./RecordPrimitives";
import {
  daysBetween,
  describeJobWork,
  describeVehicle,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatRelativeDay,
  staffName,
} from "@/lib/customers/customerHubModel";

function SnapshotCard({ title, children }) {
  return (
    // Snapshot card: a small titled box holding one group of at-a-glance customer facts.
    <LayerSurface as="div" sectionKey={`customer-profile-snapshot-${title}`} parentKey="customer-profile-snapshot">
      <RecordHeading>{title}</RecordHeading>
      {children}
    </LayerSurface>
  );
}

function OpenJobRow({ job }) {
  return (
    // Open job row: the job number, vehicle and status of one job currently in progress, with a link to open it.
    <LayerTheme as="div" sectionKey={`customer-profile-open-job-${job.id}`} parentKey="customer-profile-snapshot">
      <div className="app-page-header">
        <div className="app-page-header__text">
          <h4 className="app-record-heading">{`Job ${job.job_number}`}</h4>
          <p className="app-record-note">
            {[job.vehicle_reg, job.vehicle_make_model].filter(Boolean).join(" · ") || "Vehicle not set"}
          </p>
        </div>
        <div className="app-page-header__actions">
          <StatusBadge tone="accent-soft">{job.status}</StatusBadge>
        </div>
      </div>
      {describeJobWork(job) && <p className="app-record-note">{describeJobWork(job)}</p>}
      <RecordFieldGrid
        fields={[
          { label: "Advisor", value: staffName(job.advisor) },
          { label: "Technician", value: staffName(job.technician) },
          { label: "Booked in", value: job.checked_in_at ? formatDate(job.checked_in_at) : null },
        ]}
      />
      <div className="app-record-actions">
        <LinkButton href={`/job-cards/${encodeURIComponent(job.job_number)}`}>Open job card</LinkButton>
      </div>
    </LayerTheme>
  );
}

export default function CustomerOverviewTab({
  customer,
  summary,
  vehicles = [],
  jobs = [],
  appointments = [],
  files = [],
  activityEvents = [],
  access,
  onVehicleAdded,
  onOpenHistory,
  onAddLogEntry,
}) {
  const openJobs = summary?.openJobList || [];

  // The vehicle whose MOT runs out first — the single most useful fleet fact.
  const nextMot = vehicles
    .map(describeVehicle)
    .filter((vehicle) => vehicle.motDue)
    .sort((a, b) => new Date(a.motDue) - new Date(b.motDue))[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--page-stack-gap)", minWidth: 0 }}>
      {/* Snapshot: at-a-glance cards covering work in progress, the next booking, the customer's vehicles and money owed. */}
      <LayerTheme as="section" sectionKey="customer-profile-snapshot" parentKey="customer-profile-tab-overview">
        <RecordHeading>Snapshot</RecordHeading>

        <div className="app-card-grid" style={{ "--app-card-grid-min": "280px" }}>
          {/* Work in progress: the customer's live jobs, or a message when there are none. */}
          <SnapshotCard title="Work in progress">
            {openJobs.length === 0 ? (
              <EmptyState
                variant="bare"
                title="No live jobs"
                description={
                  summary?.totalJobs
                    ? `${summary.totalJobs} completed job(s) on record.`
                    : "This customer has never had work booked in."
                }
              />
            ) : (
              openJobs.slice(0, 3).map((job) => <OpenJobRow key={job.id} job={job} />)
            )}
            {openJobs.length > 3 && (
              <p className="app-record-note">{`+ ${openJobs.length - 3} more open job(s) in History.`}</p>
            )}
          </SnapshotCard>

          {/* Next in: when the customer is next booked in, which vehicle, the work requested, the advisor and any courtesy car. */}
          <SnapshotCard title="Next in">
            {summary?.nextBooking ? (
              <RecordFieldGrid
                keepEmpty
                fields={[
                  { label: "When", value: formatDateTime(summary.nextBooking.scheduledTime) },
                  { label: "Which", value: formatRelativeDay(summary.nextBooking.scheduledTime) },
                  { label: "Vehicle", value: summary.nextBooking.vehicle },
                  { label: "Work", value: summary.nextBooking.workRequested },
                  { label: "Advisor", value: summary.nextBooking.advisor },
                  { label: "Courtesy car", value: summary.nextBooking.courtesyCar },
                ]}
              />
            ) : (
              <EmptyState variant="bare" title="Nothing booked" description="No future appointment on the record." />
            )}
          </SnapshotCard>

          {/* Fleet: how many vehicles the customer has, the next MOT due, MOT status and their last visit. */}
          <SnapshotCard title="Fleet">
            <RecordFieldGrid
              keepEmpty
              fields={[
                { label: "Vehicles", value: String(summary?.vehicleCount ?? 0) },
                { label: "Next MOT", value: nextMot ? `${nextMot.registration} · ${formatDate(nextMot.motDue)}` : null },
                {
                  label: "MOT status",
                  value: nextMot
                    ? daysBetween(nextMot.motDue) < 0
                      ? "Expired"
                      : formatRelativeDay(nextMot.motDue)
                    : null,
                },
                { label: "Last visit", value: summary?.lastVisit ? formatDate(summary.lastVisit) : null },
              ]}
            />
          </SnapshotCard>

          {access?.canViewFinancials && (
            // Money: outstanding balance, overdue invoices, lifetime spend, total invoiced and account status. Only shown to staff who can view financials.
            <SnapshotCard title="Money">
              <RecordFieldGrid
                keepEmpty
                fields={[
                  { label: "Outstanding", value: formatCurrency(summary?.outstandingBalance) },
                  { label: "Overdue invoices", value: String(summary?.overdueCount ?? 0) },
                  { label: "Lifetime spend", value: formatCurrency(summary?.lifetimeSpend) },
                  { label: "Total invoiced", value: formatCurrency(summary?.invoicedTotal) },
                  {
                    label: "Account",
                    value: summary?.accountNumbers?.length
                      ? `${summary.accountNumbers.join(", ")} · ${formatCurrency(summary.accountBalance)}`
                      : null,
                  },
                ]}
              />
            </SnapshotCard>
          )}
        </div>
      </LayerTheme>

      {/* Vehicles: the customer's vehicles, with options to add one or open its history. */}
      <CustomerVehiclesSection
        vehicles={vehicles}
        customerId={customer?.id}
        access={access}
        onVehicleAdded={onVehicleAdded}
        onOpenHistory={onOpenHistory}
      />

      {/* Schedule: the customer's upcoming and past appointments. */}
      <CustomerScheduleSection appointments={appointments} access={access} customerId={customer?.id} />

      {/* Files: documents stored against the customer. */}
      <CustomerFilesSection files={files} />

      {/* Contact log: a history of calls, messages and activity with the customer, with a way to add a new entry. */}
      <CustomerContactLog
        activityEvents={activityEvents}
        jobs={jobs}
        access={access}
        onAddEntry={onAddLogEntry}
        compact
      />
    </div>
  );
}
