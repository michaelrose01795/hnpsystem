// file location: src/components/page-ui/job-cards/jobSettings/SchedulingSection.js
//
// Job Card Settings → Scheduling. The appointment and the next customer update.
//
// The appointment is saved through the page's existing appointment handler —
// the same one behind the Scheduling tab — so linked jobs follow the host's
// appointment and an Open/New job still moves to Booked exactly as before.
// The next customer update (time, owner, reminder) goes through
// /api/job-cards/[jobNumber]/settings.

import React, { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { CalendarField } from "@/components/ui/calendarAPI";
import { TimePickerField } from "@/components/ui/timePickerAPI";
import { RecordFieldGrid } from "@/features/customers/hub/RecordPrimitives";
import { WORKSHOP_APPOINTMENT_TIME_OPTIONS } from "@/lib/appointments/dateTime";
import {
  LockedNotice,
  SettingsCard,
  SettingsField,
  SettingsFieldGrid,
  formatSettingsDateTime,
  getEditLockMessage,
  splitLocalDateTime,
  useActionFeedback,
  useBaselineForm,
  useSettingsSave,
} from "@/components/page-ui/job-cards/jobSettings/settingsParts";

const APPOINTMENT_KEYS = ["appointmentDate", "appointmentTime", "appointmentNotes"];
const UPDATE_KEYS = ["updateDate", "updateTime", "updateOwnerId", "updateReminder"];

export default function SchedulingSection({ ctx }) {
  const { jobData, permissions, isArchiveMode, statusLabel, settings, registerSave, onChanged, handlers } = ctx;
  const meta = settings.meta;
  const migrationPending = meta?.migrationPending === true;
  const lockMessage = getEditLockMessage(permissions, { isArchiveMode, statusLabel });
  const canEdit = !lockMessage;
  const appointment = jobData.appointment || null;
  const nextUpdate = splitLocalDateTime(jobData.nextUpdateDue);

  const baseline = useMemo(
    () => ({
      appointmentDate: appointment?.date || "",
      appointmentTime: appointment?.time ? String(appointment.time).slice(0, 5) : "",
      appointmentNotes: appointment?.notes || "",
      updateDate: nextUpdate.date,
      updateTime: nextUpdate.time,
      updateOwnerId: meta?.nextUpdateOwnerId ? String(meta.nextUpdateOwnerId) : "",
      updateReminder: meta?.nextUpdateReminderEnabled === true,
    }),
    [appointment?.date, appointment?.time, appointment?.notes, nextUpdate.date, nextUpdate.time, meta?.nextUpdateOwnerId, meta?.nextUpdateReminderEnabled]
  );
  const { form, setField, isDirty } = useBaselineForm(baseline);
  const [busy, setBusy] = useState(false);
  const [appointmentError, setAppointmentError] = useState("");
  const [updateError, setUpdateError] = useState("");
  const appointmentFeedback = useActionFeedback();
  const updateFeedback = useActionFeedback();

  const appointmentDirty = isDirty(APPOINTMENT_KEYS);
  const updateDirty = isDirty(UPDATE_KEYS);

  const timeOptions = useMemo(() => {
    const options = WORKSHOP_APPOINTMENT_TIME_OPTIONS.map(({ value, label }) => ({ value, label }));
    if (form.appointmentTime && !options.some((option) => option.value === form.appointmentTime)) {
      options.unshift({ value: form.appointmentTime, label: form.appointmentTime });
    }
    return options;
  }, [form.appointmentTime]);

  const ownerOptions = useMemo(() => {
    const options = [{ value: "", label: "Not set" }, ...settings.advisors.map((user) => ({ value: String(user.id), label: user.name, description: user.role }))];
    if (meta?.nextUpdateOwnerId && !options.some((option) => option.value === String(meta.nextUpdateOwnerId))) {
      options.push({ value: String(meta.nextUpdateOwnerId), label: meta.nextUpdateOwnerName || `User ${meta.nextUpdateOwnerId}` });
    }
    return options;
  }, [settings.advisors, meta?.nextUpdateOwnerId, meta?.nextUpdateOwnerName]);

  const save = async () => {
    if (!canEdit || busy) return;
    setAppointmentError("");
    setUpdateError("");

    // Validate both before writing either.
    if (appointmentDirty && (!form.appointmentDate || !form.appointmentTime)) {
      setAppointmentError("An appointment needs both a date and a time.");
      return;
    }
    if (updateDirty && Boolean(form.updateDate) !== Boolean(form.updateTime)) {
      setUpdateError("Give the next update both a date and a time, or clear both.");
      return;
    }

    setBusy(true);
    appointmentFeedback.clear();
    updateFeedback.clear();
    let changed = false;
    try {
      if (appointmentDirty) {
        const result = await handlers.onAppointmentSave({
          date: form.appointmentDate,
          time: form.appointmentTime,
          status: appointment?.status || "booked",
          notes: form.appointmentNotes,
        });
        appointmentFeedback.show(
          result?.success
            ? { success: true, message: "Appointment saved." }
            : { success: false, error: result?.error?.message || "The appointment could not be saved." }
        );
        changed = changed || Boolean(result?.success);
      }

      if (updateDirty) {
        const payload = {};
        if (form.updateDate !== baseline.updateDate || form.updateTime !== baseline.updateTime) {
          payload.nextUpdateDue =
            form.updateDate && form.updateTime ? new Date(`${form.updateDate}T${form.updateTime}`).toISOString() : null;
        }
        if (form.updateOwnerId !== baseline.updateOwnerId) payload.nextUpdateOwnerId = form.updateOwnerId || null;
        if (form.updateReminder !== baseline.updateReminder) payload.nextUpdateReminderEnabled = form.updateReminder;
        const result = await settings.runAction("update_customer_updates", payload);
        updateFeedback.show(result);
        changed = changed || result.success;
      }

      if (changed) await onChanged();
    } finally {
      setBusy(false);
    }
  };

  useSettingsSave(registerSave, { dirty: appointmentDirty || updateDirty, busy, disabled: !canEdit, onSave: save });

  const disabled = !canEdit || busy;
  const updateOverdue = jobData.nextUpdateDue && new Date(jobData.nextUpdateDue).getTime() < Date.now();

  return (
    <>
      <LockedNotice>{lockMessage}</LockedNotice>

      <SettingsCard sectionKey="jobcard-settings-scheduling-appointment" title="Appointment">
        {appointmentFeedback.feedback}
        <SettingsFieldGrid>
          <CalendarField
            id="job-settings-appointment-date"
            label="Date"
            value={form.appointmentDate}
            onChange={(event) => setField("appointmentDate", event.target.value)}
            disabled={disabled}
          />
          <DropdownField
            id="job-settings-appointment-time"
            label="Time"
            options={timeOptions}
            value={form.appointmentTime}
            onValueChange={(value) => setField("appointmentTime", value)}
            placeholder="Select time"
            disabled={disabled}
          />
        </SettingsFieldGrid>
        <SettingsField id="job-settings-appointment-notes" label="Appointment notes" error={appointmentError}>
          <textarea
            id="job-settings-appointment-notes"
            className="app-input app-input--textarea"
            rows={2}
            value={form.appointmentNotes}
            disabled={disabled}
            onChange={(event) => setField("appointmentNotes", event.target.value)}
          />
        </SettingsField>
        <RecordFieldGrid
          fields={[
            { label: "Appointment status", value: appointment?.status ? String(appointment.status).replace(/_/g, " ") : "Not booked" },
            { label: "Checked in", value: formatSettingsDateTime(jobData.checkedInAt) },
            { label: "Workshop started", value: formatSettingsDateTime(jobData.workshopStartedAt) },
          ]}
        />
        {jobData.isPrimeJob && Array.isArray(jobData.subJobs) && jobData.subJobs.length ? (
          <p className="app-record-note">
            This job hosts {jobData.subJobs.length} linked job{jobData.subJobs.length === 1 ? "" : "s"}; saving the
            appointment moves theirs too.
          </p>
        ) : null}
      </SettingsCard>

      <SettingsCard sectionKey="jobcard-settings-scheduling-updates" title="Next customer update">
        {updateFeedback.feedback}
        {updateOverdue ? <LockedNotice tone="warning">The next customer update is overdue.</LockedNotice> : null}
        <SettingsFieldGrid>
          <CalendarField
            id="job-settings-update-date"
            label="Date"
            value={form.updateDate}
            onChange={(event) => setField("updateDate", event.target.value)}
            disabled={disabled}
          />
          <TimePickerField
            id="job-settings-update-time"
            label="Time"
            value={form.updateTime}
            onChange={(event) => setField("updateTime", event.target.value)}
            disabled={disabled}
          />
          <SettingsField
            id="job-settings-update-owner"
            label="Responsible"
            error={updateError}
            hint={migrationPending ? "Available once the job card settings migration has been applied." : undefined}
          >
            <DropdownField
              id="job-settings-update-owner"
              options={ownerOptions}
              value={form.updateOwnerId}
              onValueChange={(value) => setField("updateOwnerId", value)}
              disabled={disabled || migrationPending || !meta}
            />
          </SettingsField>
        </SettingsFieldGrid>
        <label className="app-toggle-field">
          <input
            className="app-toggle app-toggle--checkbox"
            type="checkbox"
            checked={form.updateReminder}
            disabled={disabled || migrationPending || !meta}
            onChange={(event) => setField("updateReminder", event.target.checked)}
          />
          <span>Flag as a reminder for the responsible member of staff</span>
        </label>
        {form.updateDate || form.updateTime ? (
          <div className="app-record-actions">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setField("updateDate", "");
                setField("updateTime", "");
              }}
            >
              Clear next update
            </Button>
          </div>
        ) : null}
      </SettingsCard>
    </>
  );
}
