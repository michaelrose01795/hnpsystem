// file location: src/features/customers/hub/CustomerScheduleSection.js
//
// Upcoming and previous appointments for the customer, with the detail the
// service desk needs to answer "when are they in, what for, and who has it?".
//
// Rows are merged from public.appointments (both the customer-level rows and
// the ones embedded on each job) by buildAppointments; courtesy car comes from
// job_booking_requests.loan_car_details and the collection/delivery line from
// jobs.service_mode / delivery_stops. No new tables.

import React, { useMemo, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { RecordFieldGrid, RecordHeading, StatusBadge, LinkButton } from "./RecordPrimitives";
import {
  formatCurrency,
  formatDate,
  formatRelativeDay,
  formatTime,
  splitAppointments,
} from "@/lib/customers/customerHubModel";

const statusTone = (status) => {
  const value = String(status || "").toLowerCase();
  if (/cancel|no.?show/.test(value)) return "danger";
  if (/complete|attended|done/.test(value)) return "success";
  if (/confirm|book/.test(value)) return "accent-soft";
  return "neutral";
};

function AppointmentCard({ appointment, access, customerId, past }) {
  return (
    <LayerSurface
      as="article"
      sectionKey={`customer-profile-appointment-${appointment.id}`}
      parentKey="customer-profile-schedule"
    >
      <div className="app-page-header">
        <div className="app-page-header__text">
          <h3 className="app-record-heading">
            {`${formatDate(appointment.scheduledTime)} · ${formatTime(appointment.scheduledTime)}`}
          </h3>
          <p className="app-record-note">
            {[
              appointment.vehicle,
              appointment.jobNumber ? `Job ${appointment.jobNumber}` : null,
              past ? null : formatRelativeDay(appointment.scheduledTime),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="app-page-header__actions">
          <StatusBadge tone={statusTone(appointment.status)}>{appointment.status}</StatusBadge>
          {appointment.jobType && <StatusBadge tone="neutral">{appointment.jobType}</StatusBadge>}
        </div>
      </div>

      <RecordFieldGrid
        keepEmpty
        fields={[
          { label: "Work requested", value: appointment.workRequested || appointment.notes },
          { label: "Advisor", value: appointment.advisor || appointment.bookedBy },
          { label: "Technician", value: appointment.technician },
          { label: "Courtesy car", value: appointment.courtesyCar },
          { label: "Collection / delivery", value: appointment.collectionDelivery },
          {
            label: "Estimate",
            value: appointment.estimate != null ? formatCurrency(appointment.estimate) : null,
          },
        ]}
      />

      {appointment.notes && appointment.notes !== appointment.workRequested && (
        <p className="app-record-note">{appointment.notes}</p>
      )}

      <div className="app-record-actions">
        {appointment.jobNumber && (
          <LinkButton href={`/job-cards/${encodeURIComponent(appointment.jobNumber)}`}>
            Open job card
          </LinkButton>
        )}
        {access?.canBookAppointment && (
          <LinkButton
            href={`/appointments?customerId=${encodeURIComponent(customerId || "")}${
              appointment.jobNumber ? `&jobNumber=${encodeURIComponent(appointment.jobNumber)}` : ""
            }`}
            variant="ghost"
          >
            {past ? "Rebook" : "Reschedule"}
          </LinkButton>
        )}
      </div>
    </LayerSurface>
  );
}

const PREVIOUS_PAGE_SIZE = 5;

export default function CustomerScheduleSection({ appointments = [], access, customerId }) {
  const [showAllPrevious, setShowAllPrevious] = useState(false);
  const { upcoming, previous } = useMemo(() => splitAppointments(appointments), [appointments]);
  const visiblePrevious = showAllPrevious ? previous : previous.slice(0, PREVIOUS_PAGE_SIZE);

  return (
    <LayerTheme as="section" sectionKey="customer-profile-schedule" parentKey="customer-profile-tab-overview">
      <RecordHeading
        actions={
          access?.canBookAppointment ? (
            <LinkButton
              href={`/appointments?customerId=${encodeURIComponent(customerId || "")}`}
              variant="primary"
            >
              Book appointment
            </LinkButton>
          ) : null
        }
      >
        {`Schedule (${upcoming.length} upcoming)`}
      </RecordHeading>

      {upcoming.length === 0 ? (
        <EmptyState
          variant="bare"
          icon="📅"
          title="Nothing booked in"
          description="This customer has no upcoming appointments."
          action={
            access?.canBookAppointment ? (
              <LinkButton
                href={`/appointments?customerId=${encodeURIComponent(customerId || "")}`}
                variant="primary"
              >
                Book appointment
              </LinkButton>
            ) : null
          }
        />
      ) : (
        upcoming.map((appointment) => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            access={access}
            customerId={customerId}
          />
        ))
      )}

      {previous.length > 0 && (
        <>
          <div className="app-record-rule" aria-hidden="true" />
          <RecordHeading
            actions={
              previous.length > PREVIOUS_PAGE_SIZE ? (
                <Button variant="ghost" size="sm" onClick={() => setShowAllPrevious((value) => !value)}>
                  {showAllPrevious ? "Show recent only" : `Show all ${previous.length}`}
                </Button>
              ) : null
            }
          >
            {`Previous appointments (${previous.length})`}
          </RecordHeading>
          {visiblePrevious.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              access={access}
              customerId={customerId}
              past
            />
          ))}
        </>
      )}
    </LayerTheme>
  );
}
