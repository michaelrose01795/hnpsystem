// file location: src/components/page-ui/job-cards/jobSettings/GeneralSection.js
//
// Job Card Settings → General. Priority, source, division and waiting status,
// plus the metadata corrections the data model safely supports: mileage and
// which of the customer's vehicles the job is for.
//
// Waiting status and the vehicle go through the page's existing booking-flow
// save (the same path as the Scheduling tab, which also keeps the booking
// request in step); mileage goes through the page's mileage save, which
// refuses a reading below the vehicle's last recorded mileage. Priority, source
// and division go through /api/job-cards/[jobNumber]/settings.

import React, { useMemo, useState } from "react";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { RecordFieldGrid } from "@/features/customers/hub/RecordPrimitives";
import { getVehicleRegistration, pickMileageValue } from "@/lib/canonical/fields";
import {
  JOB_DIVISION_OPTIONS,
  JOB_PRIORITY_OPTIONS,
  JOB_SOURCE_OPTIONS,
  JOB_WAITING_STATUS_OPTIONS,
  resolveJobTypeForSource,
} from "@/features/jobCards/workflow/jobSettings";
import {
  LockedNotice,
  SettingsCard,
  SettingsField,
  SettingsFieldGrid,
  formatSettingsDateTime,
  getEditLockMessage,
  useActionFeedback,
  useBaselineForm,
  useSettingsSave,
} from "@/components/page-ui/job-cards/jobSettings/settingsParts";

const toOptions = (values) => values.map((value) => ({ value, label: value }));

const vehicleLabel = (vehicle) => {
  const reg = getVehicleRegistration(vehicle) || "No registration";
  const model = vehicle.make_model || [vehicle.make, vehicle.model].filter(Boolean).join(" ");
  return model ? `${reg} · ${model}` : reg;
};

export default function GeneralSection({ ctx }) {
  const { jobData, permissions, isArchiveMode, statusLabel, settings, registerSave, onChanged, handlers, customerVehicles } = ctx;
  const meta = settings.meta;
  const migrationPending = meta?.migrationPending === true;
  const lockMessage = getEditLockMessage(permissions, { isArchiveMode, statusLabel });
  const canEdit = !lockMessage;
  const warrantyLinked = Boolean(jobData.linkedWarrantyJobId || jobData.warrantyVhcMasterJobId);

  const baseline = useMemo(
    () => ({
      priority: meta?.priority || "normal",
      jobSource: jobData.jobSource || "Retail",
      jobDivision: jobData.jobDivision || "Retail",
      waitingStatus: jobData.waitingStatus || "Neither",
      mileage: (() => {
        const value = pickMileageValue(jobData.mileage, jobData.milage);
        return value === null || value === undefined ? "" : String(value);
      })(),
      vehicleId: jobData.vehicleId ? String(jobData.vehicleId) : "",
    }),
    [meta?.priority, jobData.jobSource, jobData.jobDivision, jobData.waitingStatus, jobData.mileage, jobData.milage, jobData.vehicleId]
  );

  const { form, setField, isDirty } = useBaselineForm(baseline);
  const [busy, setBusy] = useState(false);
  const [mileageError, setMileageError] = useState("");
  const details = useActionFeedback();
  const corrections = useActionFeedback();

  const set = (field) => (value) => {
    setField(field, value);
    if (field === "mileage") setMileageError("");
  };

  const detailsDirty = isDirty(["priority", "jobSource", "jobDivision", "waitingStatus"]);
  const correctionsDirty = isDirty(["mileage", "vehicleId"]);

  const vehicleOptions = useMemo(() => {
    const seen = new Set();
    const rows = [];
    const push = (vehicle) => {
      if (!vehicle?.vehicle_id || seen.has(String(vehicle.vehicle_id))) return;
      seen.add(String(vehicle.vehicle_id));
      rows.push({ value: String(vehicle.vehicle_id), label: vehicleLabel(vehicle) });
    };
    if (jobData.vehicleId) {
      push({ vehicle_id: jobData.vehicleId, registration: jobData.reg, make_model: jobData.makeModel });
    }
    (customerVehicles || []).forEach(push);
    return rows;
  }, [customerVehicles, jobData.vehicleId, jobData.reg, jobData.makeModel]);

  const save = async () => {
    if (!canEdit || busy) return;
    setBusy(true);
    details.clear();
    corrections.clear();
    let changed = false;

    try {
      if (detailsDirty) {
        const payload = {};
        if (form.priority !== baseline.priority) payload.priority = form.priority;
        if (form.jobSource !== baseline.jobSource) payload.jobSource = form.jobSource;
        if (form.jobDivision !== baseline.jobDivision) payload.jobDivision = form.jobDivision;

        let result = { success: true, message: "Saved." };
        if (Object.keys(payload).length) {
          result = await settings.runAction("update_general", payload);
        }
        if (result.success && form.waitingStatus !== baseline.waitingStatus) {
          const waitingResult = await handlers.onBookingFlowSave({
            vehicleId: jobData.vehicleId || null,
            description: jobData.description || "",
            waitingStatus: form.waitingStatus,
          });
          if (waitingResult?.success) {
            handlers.onLogisticsChange?.(form.waitingStatus);
          } else {
            result = { success: false, error: waitingResult?.error?.message || "The waiting status could not be saved." };
          }
        }
        details.show(result);
        changed = changed || result.success;
      }

      if (correctionsDirty) {
        let result = { success: true, message: "Corrections saved." };
        if (form.mileage !== baseline.mileage) {
          const mileageResult = await handlers.onMileageSave({ vehicleId: jobData.vehicleId || null, mileage: form.mileage });
          if (!mileageResult?.success) {
            const message = mileageResult?.error?.message || "The mileage could not be saved.";
            setMileageError(message);
            result = { success: false, error: message };
          }
        }
        if (result.success && form.vehicleId !== baseline.vehicleId) {
          const vehicleResult = await handlers.onBookingFlowSave({
            vehicleId: Number(form.vehicleId),
            description: jobData.description || "",
            waitingStatus: jobData.waitingStatus || "Neither",
          });
          if (!vehicleResult?.success) {
            result = { success: false, error: vehicleResult?.error?.message || "The vehicle could not be changed." };
          }
        }
        corrections.show(result);
        changed = changed || result.success;
      }

      if (changed) await onChanged();
    } finally {
      setBusy(false);
    }
  };

  useSettingsSave(registerSave, { dirty: detailsDirty || correctionsDirty, busy, disabled: !canEdit, onSave: save });

  const disabled = !canEdit || busy;

  return (
    <>
      <LockedNotice>{lockMessage}</LockedNotice>

      <SettingsCard sectionKey="jobcard-settings-general-details" title="Job details">
        {details.feedback}
        <SettingsFieldGrid>
          <SettingsField
            id="job-settings-priority"
            label="Priority"
            hint={migrationPending ? "Available once the job card settings migration has been applied." : undefined}
          >
            <DropdownField
              id="job-settings-priority"
              options={JOB_PRIORITY_OPTIONS.map(({ value, label }) => ({ value, label }))}
              value={form.priority}
              onValueChange={set("priority")}
              disabled={disabled || migrationPending || !meta}
            />
          </SettingsField>
          <SettingsField
            id="job-settings-source"
            label="Job source"
            hint={
              warrantyLinked
                ? "Locked while this job is linked to a warranty job."
                : `Job type follows the source: ${resolveJobTypeForSource(form.jobSource)}.`
            }
          >
            <DropdownField
              id="job-settings-source"
              options={toOptions(JOB_SOURCE_OPTIONS)}
              value={form.jobSource}
              onValueChange={set("jobSource")}
              disabled={disabled || warrantyLinked}
            />
          </SettingsField>
          <SettingsField id="job-settings-division" label="Division">
            <DropdownField
              id="job-settings-division"
              options={toOptions(JOB_DIVISION_OPTIONS)}
              value={form.jobDivision}
              onValueChange={set("jobDivision")}
              disabled={disabled}
            />
          </SettingsField>
          <SettingsField id="job-settings-waiting" label="Customer waiting status">
            <DropdownField
              id="job-settings-waiting"
              options={toOptions(JOB_WAITING_STATUS_OPTIONS)}
              value={form.waitingStatus}
              onValueChange={set("waitingStatus")}
              disabled={disabled}
            />
          </SettingsField>
        </SettingsFieldGrid>
        <RecordFieldGrid
          fields={[
            { label: "Job type", value: jobData.type },
            { label: "Service mode", value: jobData.serviceMode === "mobile" ? "Mobile" : "Workshop" },
            {
              label: "Categories",
              value: Array.isArray(jobData.jobCategories) ? jobData.jobCategories.filter(Boolean).join(", ") : "",
            },
            { label: "Created", value: formatSettingsDateTime(jobData.createdAt) },
            { label: "Last updated", value: formatSettingsDateTime(jobData.updatedAt) },
          ]}
        />
        {jobData.description ? (
          <RecordFieldGrid wide fields={[{ label: "Description", value: jobData.description }]} />
        ) : null}
      </SettingsCard>

      <SettingsCard sectionKey="jobcard-settings-general-corrections" title="Corrections">
        {corrections.feedback}
        <SettingsFieldGrid>
          <SettingsField
            id="job-settings-mileage"
            label="Mileage"
            error={mileageError}
            hint="Cannot be lower than the last mileage recorded for this registration."
          >
            <input
              id="job-settings-mileage"
              className="app-input"
              type="text"
              inputMode="numeric"
              maxLength={7}
              value={form.mileage}
              disabled={disabled || !jobData.vehicleId}
              aria-invalid={mileageError ? "true" : undefined}
              aria-describedby={mileageError ? "job-settings-mileage-error" : undefined}
              onChange={(event) => set("mileage")((event.target.value || "").replace(/\D/g, "").slice(0, 7))}
            />
          </SettingsField>
          <SettingsField
            id="job-settings-vehicle"
            label="Vehicle"
            hint="Only this customer's own vehicles can be chosen."
          >
            <DropdownField
              id="job-settings-vehicle"
              options={vehicleOptions}
              value={form.vehicleId}
              onValueChange={set("vehicleId")}
              placeholder="Select vehicle"
              disabled={disabled || vehicleOptions.length < 2}
            />
          </SettingsField>
        </SettingsFieldGrid>
        <RecordFieldGrid
          fields={[
            { label: "Customer", value: jobData.customer || "Not linked" },
            { label: "Registration", value: jobData.reg },
            { label: "VIN", value: jobData.vin || jobData.chassis },
          ]}
        />
        <p className="app-record-note">
          The customer cannot be changed on an existing job card: invoices, messages, VHC links and service
          history are all keyed to the customer. Raise a new job card for the correct customer instead.
        </p>
      </SettingsCard>
    </>
  );
}
