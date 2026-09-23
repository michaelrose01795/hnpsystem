// file location: src/components/page-ui/job-cards/jobSettings/TrackingSection.js
//
// Job Card Settings → Tracking. Key and car location, and the job's loan car.
//
// Locations are written through the page's existing tracker save
// (/api/tracking/next-action, action "location_update") with the canonical
// option lists from src/lib/jobCards/locations.js — the same path as the
// location card on the job card. They stay editable after invoicing, exactly as
// on the card, until the job is archived.
//
// The loan car is the loan-car tracker's own booking popup
// (LoanCarBookingDrawer): assign opens New loan booking pre-filled from this
// job, and an existing booking opens with every action the user's loan-car
// capabilities allow (edit, change car, hand over, return, remove).

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Button from "@/components/ui/Button";
import DataTableShell from "@/components/ui/DataTableShell";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { InlineLoading } from "@/components/ui/LoadingSkeleton";
import { RecordFieldGrid, StatusBadge } from "@/features/customers/hub/RecordPrimitives";
import {
  CAR_LOCATION_OPTIONS,
  KEY_LOCATION_OPTIONS,
  ensureDropdownOption,
  normalizeKeyLocationLabel,
} from "@/lib/jobCards/locations";
import { formatVehicleLocation, toVehicleLocationFormValue } from "@/lib/tracking/vehicleLocations";
import { useLoanCarSchedule } from "@/hooks/useLoanCarSchedule";
import { buildJobDraft } from "@/components/LoanCars/LoanCarSchedulePanel";
import {
  BOOKING_STATE_META,
  addDays,
  formatBookingWindow,
  nowStamp,
  resolveBookingState,
} from "@/features/loanCars/loanCarModel";
import {
  LockedNotice,
  SettingsCard,
  SettingsField,
  SettingsFieldGrid,
  formatSettingsDateTime,
  useActionFeedback,
  useBaselineForm,
  useSettingsSave,
} from "@/components/page-ui/job-cards/jobSettings/settingsParts";

const LoanCarBookingDrawer = dynamic(() => import("@/components/LoanCars/LoanCarBookingDrawer"), { ssr: false });

// Loan-car state tones → badge family variants (as in the booking popup).
const BOOKING_TONE = {
  warning: "warning",
  accent: "accent-strong",
  "warning-strong": "warning-strong",
  danger: "danger-strong",
  neutral: "neutral",
};

function JobLoanCarCard({ jobData, canEditJob, onPopupChange }) {
  // The schedule API caps a read at 62 days; a fortnight back and six weeks
  // ahead covers every booking a live job realistically has.
  const [todayKey] = useState(() => nowStamp().slice(0, 10));
  const schedule = useLoanCarSchedule({
    startDate: addDays(todayKey, -14),
    endDate: addDays(todayKey, 47),
    todayKey,
  });
  const [drawer, setDrawer] = useState(null);

  const jobBookings = useMemo(() => {
    const jobNumber = String(jobData.jobNumber || "").trim().toLowerCase();
    return schedule.bookings
      .filter(
        (booking) =>
          (booking.jobId && Number(booking.jobId) === Number(jobData.id)) ||
          (jobNumber && String(booking.jobNumber || "").trim().toLowerCase() === jobNumber)
      )
      .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  }, [schedule.bookings, jobData.id, jobData.jobNumber]);

  const carById = useMemo(
    () => new Map(schedule.allCars.map((car) => [car.loanCarId, car])),
    [schedule.allCars]
  );

  const capabilities = schedule.capabilities;
  const canBook = Boolean(capabilities?.book) && canEditJob;
  const jobDraft = useMemo(() => buildJobDraft(jobData), [jobData]);

  const openDrawer = (next) => {
    setDrawer(next);
    onPopupChange?.(true);
  };
  const closeDrawer = () => {
    setDrawer(null);
    onPopupChange?.(false);
  };

  const unavailable = schedule.error
    ? "Loan cars are not available to your role, or the loan car tracker could not be reached."
    : capabilities && !capabilities.view
    ? "Your role cannot view loan cars."
    : "";

  return (
    <SettingsCard
      sectionKey="jobcard-settings-tracking-loan-car"
      title="Loan car"
      actions={
        canBook ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => openDrawer({ mode: "create", variant: "full", draft: jobDraft })}
          >
            Assign loan car
          </Button>
        ) : null
      }
    >
      {schedule.loading ? <InlineLoading label="Loading loan cars…" /> : null}
      <LockedNotice tone="info">{unavailable}</LockedNotice>
      {!schedule.loading && !unavailable ? (
        jobBookings.length ? (
          <DataTableShell visibleRows={4}>
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Loan car</th>
                  <th>When</th>
                  <th>State</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {jobBookings.map((booking) => {
                  const car = carById.get(booking.loanCarId);
                  const stateMeta = BOOKING_STATE_META[resolveBookingState(booking, schedule.now)] || {};
                  return (
                    <tr key={booking.bookingId}>
                      <td data-table-cell="nowrap">
                        <strong>{car?.reg || "Loan car"}</strong>
                        {car?.makeModel ? <span className="app-record-note"> · {car.makeModel}</span> : null}
                      </td>
                      <td>{formatBookingWindow(booking)}</td>
                      <td>
                        <StatusBadge tone={BOOKING_TONE[stateMeta.tone] || "neutral"}>{stateMeta.label || "Booked"}</StatusBadge>
                      </td>
                      <td data-table-cell="nowrap">
                        <Button type="button" variant="secondary" size="sm" onClick={() => openDrawer({ mode: "view", booking })}>
                          Open
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTableShell>
        ) : (
          <p className="app-record-note">
            No loan car is booked against this job{canBook ? "." : " — booking one needs a loan-car desk or manager role."}
          </p>
        )
      ) : null}
      {jobBookings.length && canBook ? (
        <p className="app-record-note">
          Open a booking to change its car or dates, hand it over, record its return or remove it.
        </p>
      ) : null}

      {drawer ? (
        <LoanCarBookingDrawer
          open
          mode={drawer.mode}
          booking={drawer.booking || null}
          initialDraft={drawer.draft || null}
          variant={drawer.variant || "quick"}
          cars={schedule.cars}
          allCars={schedule.allCars}
          bookings={schedule.bookings}
          periods={schedule.periods}
          now={schedule.now}
          capabilities={capabilities}
          migrationPending={schedule.migrationPending}
          onClose={closeDrawer}
          onChanged={schedule.refresh}
        />
      ) : null}
    </SettingsCard>
  );
}

export default function TrackingSection({ ctx }) {
  const { jobData, permissions, isArchiveMode, registerSave, onChanged, handlers, trackerEntry, canEditTrackingLocations, onChildPopupChange } = ctx;
  const canEditLocations = Boolean(canEditTrackingLocations) && !isArchiveMode;

  const baseline = useMemo(
    () => ({
      keyLocation: normalizeKeyLocationLabel(trackerEntry?.keyLocation) || "",
      vehicleLocation: toVehicleLocationFormValue(trackerEntry?.vehicleLocation) || "",
    }),
    [trackerEntry?.keyLocation, trackerEntry?.vehicleLocation]
  );
  const { form, setField, isDirty } = useBaselineForm(baseline);
  const [busy, setBusy] = useState(false);
  const feedback = useActionFeedback();
  const dirty = isDirty();

  const keyOptions = useMemo(() => ensureDropdownOption(KEY_LOCATION_OPTIONS, form.keyLocation), [form.keyLocation]);

  const save = async () => {
    if (!canEditLocations || busy || !dirty) return;
    setBusy(true);
    feedback.clear();
    try {
      const result = await handlers.onTrackerSave({
        actionType: "location_update",
        context: "update",
        // An unchanged side is left unaddressed rather than rewritten.
        keyLocation: form.keyLocation !== baseline.keyLocation ? form.keyLocation : undefined,
        vehicleLocation: form.vehicleLocation !== baseline.vehicleLocation ? form.vehicleLocation || undefined : undefined,
      });
      feedback.show(
        result?.success
          ? { success: true, message: "Locations updated." }
          : { success: false, error: result?.error || "The locations could not be updated." }
      );
      if (result?.success) await onChanged();
    } finally {
      setBusy(false);
    }
  };

  useSettingsSave(registerSave, { dirty, busy, disabled: !canEditLocations, onSave: save });

  return (
    <>
      <SettingsCard sectionKey="jobcard-settings-tracking-locations" title="Key and car location">
        <LockedNotice>
          {canEditLocations ? null : "Locations are read-only once the job has been archived."}
        </LockedNotice>
        {feedback.feedback}
        <SettingsFieldGrid>
          <SettingsField id="job-settings-key-location" label="Key location">
            <DropdownField
              id="job-settings-key-location"
              options={keyOptions}
              value={form.keyLocation}
              onValueChange={(value) => setField("keyLocation", value)}
              placeholder="Select key location"
              disabled={!canEditLocations || busy}
            />
          </SettingsField>
          <SettingsField id="job-settings-car-location" label="Car location">
            <DropdownField
              id="job-settings-car-location"
              options={CAR_LOCATION_OPTIONS}
              value={form.vehicleLocation}
              onValueChange={(value) => setField("vehicleLocation", value)}
              placeholder="Select car location"
              disabled={!canEditLocations || busy}
            />
          </SettingsField>
        </SettingsFieldGrid>
        <RecordFieldGrid
          fields={[
            { label: "Current key location", value: normalizeKeyLocationLabel(trackerEntry?.keyLocation) || "Not recorded" },
            { label: "Current car location", value: formatVehicleLocation(trackerEntry?.vehicleLocation) || "Not recorded" },
            { label: "Vehicle status", value: trackerEntry?.status || "" },
            { label: "Last movement", value: formatSettingsDateTime(trackerEntry?.updatedAt) },
          ]}
        />
      </SettingsCard>

      <JobLoanCarCard
        jobData={jobData}
        canEditJob={!isArchiveMode && Boolean(permissions.canEditBase)}
        onPopupChange={onChildPopupChange}
      />
    </>
  );
}
