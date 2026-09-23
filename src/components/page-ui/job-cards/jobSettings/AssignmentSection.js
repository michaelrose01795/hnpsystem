// file location: src/components/page-ui/job-cards/jobSettings/AssignmentSection.js
//
// Job Card Settings → Assignment. Service advisor and technician.
//
// The technician list is the same /api/technicians feed the Scheduling tab's
// Technician Assignment uses; the advisor list comes with the settings read.
// Both changes are saved by /api/job-cards/[jobNumber]/settings, which assigns
// through the canonical assignTechnicianToJob / unassignTechnicianFromJob and
// refuses to move the job away from a technician who is still clocked on.

import React, { useEffect, useMemo, useState } from "react";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { RecordFieldGrid } from "@/features/customers/hub/RecordPrimitives";
import {
  LockedNotice,
  SettingsCard,
  SettingsField,
  SettingsFieldGrid,
  getEditLockMessage,
  useActionFeedback,
  useBaselineForm,
  useSettingsSave,
} from "@/components/page-ui/job-cards/jobSettings/settingsParts";

// Keeps the current value selectable even when that person is no longer in
// the list (left the business, changed role).
const withCurrent = (options, currentId, currentName) => {
  if (!currentId || options.some((option) => option.value === String(currentId))) return options;
  return [...options, { value: String(currentId), label: currentName || `User ${currentId}` }];
};

export default function AssignmentSection({ ctx }) {
  const { jobData, permissions, isArchiveMode, statusLabel, settings, registerSave, onChanged } = ctx;
  const meta = settings.meta;
  const migrationPending = meta?.migrationPending === true;
  const lockMessage = getEditLockMessage(permissions, { isArchiveMode, statusLabel });
  const canEdit = !lockMessage;

  const [technicians, setTechnicians] = useState([]);
  const [techniciansLoading, setTechniciansLoading] = useState(true);
  const [techniciansError, setTechniciansError] = useState("");
  const [busy, setBusy] = useState(false);
  const feedback = useActionFeedback();

  useEffect(() => {
    let active = true;
    setTechniciansLoading(true);
    fetch("/api/technicians", { credentials: "include" })
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        if (payload?.success && Array.isArray(payload.technicians)) {
          setTechnicians(payload.technicians);
          setTechniciansError("");
        } else {
          setTechniciansError("The technician list could not be loaded.");
        }
      })
      .catch(() => active && setTechniciansError("The technician list could not be loaded."))
      .finally(() => active && setTechniciansLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const baseline = useMemo(
    () => ({
      serviceAdvisorId: meta?.serviceAdvisorId ? String(meta.serviceAdvisorId) : "",
      technicianId: jobData.assignedTo ? String(jobData.assignedTo) : "",
    }),
    [meta?.serviceAdvisorId, jobData.assignedTo]
  );
  const { form, setField, isDirty } = useBaselineForm(baseline);
  const dirty = isDirty();

  const advisorOptions = useMemo(
    () =>
      withCurrent(
        [{ value: "", label: "Not set" }, ...settings.advisors.map((user) => ({ value: String(user.id), label: user.name, description: user.role }))],
        meta?.serviceAdvisorId,
        meta?.serviceAdvisorName
      ),
    [settings.advisors, meta?.serviceAdvisorId, meta?.serviceAdvisorName]
  );

  const technicianOptions = useMemo(
    () =>
      withCurrent(
        [
          { value: "", label: "Unassigned" },
          ...technicians.map((tech) => ({
            value: String(tech.id),
            label: tech.name,
            description: [tech.role, Number.isFinite(tech.jobsToday) ? `${tech.jobsToday} jobs today` : ""].filter(Boolean).join(" · "),
          })),
        ],
        jobData.assignedTo,
        jobData.technician
      ),
    [technicians, jobData.assignedTo, jobData.technician]
  );

  const clockedOnAssignee = settings.activeClocking.find((entry) => Number(entry.userId) === Number(jobData.assignedTo));

  const save = async () => {
    if (!canEdit || busy || !dirty) return;
    const payload = {};
    if (form.serviceAdvisorId !== baseline.serviceAdvisorId) payload.serviceAdvisorId = form.serviceAdvisorId || null;
    if (form.technicianId !== baseline.technicianId) payload.technicianId = form.technicianId || null;
    setBusy(true);
    feedback.clear();
    try {
      const result = await settings.runAction("update_assignment", payload);
      feedback.show(result);
      if (result.success) await onChanged();
    } finally {
      setBusy(false);
    }
  };

  useSettingsSave(registerSave, { dirty, busy, disabled: !canEdit, onSave: save });

  const disabled = !canEdit || busy;

  return (
    <>
      <LockedNotice>{lockMessage}</LockedNotice>
      <SettingsCard sectionKey="jobcard-settings-assignment" title="People on this job">
        {feedback.feedback}
        <SettingsFieldGrid>
          <SettingsField
            id="job-settings-advisor"
            label="Service advisor"
            hint={migrationPending ? "Available once the job card settings migration has been applied." : undefined}
          >
            <DropdownField
              id="job-settings-advisor"
              options={advisorOptions}
              value={form.serviceAdvisorId}
              onValueChange={(value) => setField("serviceAdvisorId", value)}
              disabled={disabled || migrationPending || !meta}
            />
          </SettingsField>
          <SettingsField
            id="job-settings-technician"
            label="Technician"
            error={techniciansError}
            hint={
              clockedOnAssignee
                ? `${clockedOnAssignee.name} is clocked on — clock them off before changing the technician.`
                : undefined
            }
          >
            <DropdownField
              id="job-settings-technician"
              options={technicianOptions}
              value={form.technicianId}
              onValueChange={(value) => setField("technicianId", value)}
              disabled={disabled || techniciansLoading || Boolean(clockedOnAssignee)}
              placeholder={techniciansLoading ? "Loading technicians…" : "Select technician"}
            />
          </SettingsField>
        </SettingsFieldGrid>
        <RecordFieldGrid
          fields={[
            { label: "Booked by", value: meta?.bookedByName || "" },
            {
              label: "Clocked on now",
              value: settings.activeClocking.map((entry) => entry.name).join(", "),
            },
          ]}
        />
      </SettingsCard>
    </>
  );
}
