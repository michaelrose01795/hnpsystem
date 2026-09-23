// file location: src/components/page-ui/job-cards/jobSettings/WorkflowSection.js
//
// Job Card Settings → Workflow. The overall status, the locks the status puts
// on the card, the VHC controls and the linked job group.
//
// Status rules are the canonical flow (statusFlow.isValidTransition) as
// classified by planStatusChange: a forward move follows the same rules as the
// buttons that normally make it; anything else is a manager / admin override
// with a mandatory reason. /api/job-cards/[jobNumber]/settings re-checks all
// of it against the session before writing through updateJobStatus, so
// job_status_history, notifications and tracking movements all still fire.

import React, { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import DataTableShell from "@/components/ui/DataTableShell";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { useConfirmation } from "@/context/ConfirmationContext";
import { RecordFieldGrid, StatusBadge } from "@/features/customers/hub/RecordPrimitives";
import {
  MANUAL_STATUS_OPTIONS,
  SETTINGS_REASON_MIN_LENGTH,
  describeWorkflowLocks,
  getStatusChangeBlocker,
  isReasonValid,
  planStatusChange,
} from "@/features/jobCards/workflow/jobSettings";
import {
  LockedNotice,
  ReasonField,
  SettingsCard,
  SettingsField,
  formatSettingsDateTime,
  getEditLockMessage,
  useActionFeedback,
} from "@/components/page-ui/job-cards/jobSettings/settingsParts";

export const jobStatusTone = (status) => {
  const value = String(status || "").toLowerCase();
  if (value.includes("cancel") || value.includes("failed")) return "danger";
  if (value.includes("waiting") || value.includes("hold") || value.includes("pending")) return "warning";
  if (value.includes("complete") || value.includes("released") || value.includes("invoiced")) return "success";
  return "accent-soft";
};

function StatusCard({ ctx }) {
  const { jobData, permissions, statusLabel, settings, onChanged } = ctx;
  const { confirm } = useConfirmation();
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const feedback = useActionFeedback();

  const hasActiveClocking = settings.activeClocking.length > 0;
  // The persisted status, as the server sees it — not the clocking-aware label
  // the header shows — so this plan and the server's always agree.
  const persistedStatus = jobData.rawStatus || jobData.status;
  const plan = useMemo(
    () => planStatusChange({ currentStatus: persistedStatus, targetStatus: target, hasActiveClocking }),
    [persistedStatus, target, hasActiveClocking]
  );
  const blocker = target ? getStatusChangeBlocker(plan, permissions, { reason }) : null;
  // The reason has its own field and hint, so the notice only carries the
  // other blockers (permissions, clocking, same status).
  const noticeBlocker = target
    ? getStatusChangeBlocker(plan, permissions, { reason: "x".repeat(SETTINGS_REASON_MIN_LENGTH) })
    : null;
  const options = MANUAL_STATUS_OPTIONS.filter((option) => option.value !== plan.fromId);

  const submit = async () => {
    if (!target || blocker || busy) return;
    const confirmed = await confirm({
      title: null,
      message: plan.requiresOverride
        ? `Override the workflow and move job ${jobData.jobNumber} to ${plan.toLabel}?`
        : `Move job ${jobData.jobNumber} to ${plan.toLabel}?`,
      description: plan.isReopen
        ? "The job card unlocks for editing. Any existing invoice is kept — move the job back to Invoiced once the corrections are done."
        : plan.requiresOverride
        ? "This skips or reverses the normal workflow. Your reason is saved to the job's audit history."
        : undefined,
      details: [
        { label: "Current", value: plan.fromLabel, tone: "info" },
        { label: "New", value: plan.toLabel, tone: plan.requiresOverride ? "warning" : "success" },
        ...(reason.trim() ? [{ label: "Reason", value: reason.trim(), tone: "accent" }] : []),
      ],
      confirmLabel: plan.requiresOverride ? "Override status" : "Change status",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;

    setBusy(true);
    feedback.clear();
    try {
      const result = await settings.runAction("change_status", { targetStatus: plan.toId, reason: reason.trim() });
      feedback.show(result);
      if (result.success) {
        setTarget("");
        setReason("");
        await onChanged();
      }
    } finally {
      setBusy(false);
    }
  };

  const canChangeAnything = permissions.canEdit || permissions.canOverrideWorkflow || permissions.canUseReleaseAction;

  return (
    <SettingsCard sectionKey="jobcard-settings-workflow-status" title="Job status">
      {feedback.feedback}
      <RecordFieldGrid
        fields={[
          { label: "Current status", value: <StatusBadge tone={jobStatusTone(statusLabel)}>{statusLabel || "Unknown"}</StatusBadge> },
          { label: "Status updated", value: formatSettingsDateTime(jobData.statusUpdatedAt) },
          { label: "Clocked on now", value: settings.activeClocking.map((entry) => entry.name).join(", ") },
        ]}
      />
      {canChangeAnything ? (
        <>
          <SettingsField
            id="job-settings-status-target"
            label="Move job to"
            hint="Cancelling a job is in Danger zone, with its own reason."
          >
            <DropdownField
              id="job-settings-status-target"
              options={options}
              value={target}
              onValueChange={(value) => {
                setTarget(value);
                feedback.clear();
              }}
              placeholder="Select a status"
              disabled={busy}
            />
          </SettingsField>
          {target && plan.requiresOverride ? (
            <LockedNotice tone="warning">
              {plan.fromLabel} → {plan.toLabel} is not a normal workflow step
              {plan.isBackward ? " (it moves the job backwards)" : ""}. It needs a manager or admin and a reason.
            </LockedNotice>
          ) : null}
          {target && plan.requiresOverride && permissions.canOverrideWorkflow ? (
            <ReasonField
              id="job-settings-status-reason"
              label="Reason for the override"
              value={reason}
              onChange={setReason}
              disabled={busy}
              placeholder="e.g. Customer returned the same day with an unresolved fault"
            />
          ) : null}
          {noticeBlocker ? <LockedNotice tone="danger">{noticeBlocker}</LockedNotice> : null}
          <div className="app-record-actions">
            <Button
              type="button"
              variant={plan.requiresOverride ? "danger" : "primary"}
              busy={busy}
              disabled={!target || Boolean(blocker) || busy}
              onClick={submit}
            >
              {plan.requiresOverride ? "Override status" : "Change status"}
            </Button>
          </div>
        </>
      ) : (
        <LockedNotice>{getEditLockMessage(permissions, { statusLabel }) || "You cannot change this job's status."}</LockedNotice>
      )}
    </SettingsCard>
  );
}

function LocksCard({ ctx }) {
  const { permissions, isArchiveMode, statusLabel, goToSection } = ctx;
  const locks = describeWorkflowLocks(permissions, { isArchiveMode, statusLabel });

  return (
    <SettingsCard sectionKey="jobcard-settings-workflow-locks" title="Workflow locks">
      {locks.length ? (
        <DataTableShell visibleRows={6}>
          <table className="app-data-table">
            <thead>
              <tr>
                <th>Lock</th>
                <th>What it means</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {locks.map((lock) => (
                <tr key={lock.id}>
                  <td data-table-cell="nowrap">
                    <StatusBadge tone="warning">{lock.label}</StatusBadge>
                  </td>
                  <td>{lock.description}</td>
                  <td data-table-cell="nowrap">
                    {lock.overridable ? (
                      <Button type="button" variant="secondary" size="sm" onClick={() => goToSection("danger")}>
                        {lock.overrideLabel}
                      </Button>
                    ) : (
                      <span className="app-record-note">No override</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>
      ) : (
        <p className="app-record-note">Nothing on this job card is locked for its current status.</p>
      )}
    </SettingsCard>
  );
}

function VhcCard({ ctx }) {
  const { jobData, permissions, isArchiveMode, statusLabel, settings, onChanged } = ctx;
  const { confirm } = useConfirmation();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const feedback = useActionFeedback();
  const lockMessage = getEditLockMessage(permissions, { isArchiveMode, statusLabel });

  const run = async (action, payload, busyKey) => {
    setBusy(busyKey);
    feedback.clear();
    try {
      const result = await settings.runAction(action, payload);
      feedback.show(result);
      if (result.success) {
        setReason("");
        await onChanged();
      }
    } finally {
      setBusy("");
    }
  };

  const toggleRequired = async () => {
    const next = !jobData.vhcRequired;
    if (!next) {
      const confirmed = await confirm({
        title: null,
        message: "Mark the VHC as not required?",
        description: "Technicians see this immediately, and the VHC stops blocking invoicing.",
        confirmLabel: "Mark not required",
        cancelLabel: "Cancel",
      });
      if (!confirmed) return;
    }
    run("set_vhc_required", { required: next }, "required");
  };

  const reopen = async () => {
    const confirmed = await confirm({
      title: null,
      message: "Reopen the completed VHC?",
      description: "The technician can edit the health check again, and the job's VHC stage returns to in progress.",
      details: [{ label: "Reason", value: reason.trim(), tone: "accent" }],
      confirmLabel: "Reopen VHC",
      cancelLabel: "Cancel",
    });
    if (confirmed) run("reopen_vhc", { reason: reason.trim() }, "reopen");
  };

  const vhcLockMessage =
    lockMessage || (!permissions.canEditPartsWriteUpVhc ? permissions.partsWriteUpVhcLockDescription : null);

  return (
    <SettingsCard
      sectionKey="jobcard-settings-workflow-vhc"
      title="Vehicle health check"
      actions={
        lockMessage ? null : (
          <Button type="button" variant="secondary" size="sm" busy={busy === "required"} disabled={Boolean(busy)} onClick={toggleRequired}>
            {jobData.vhcRequired ? "Mark not required" : "Mark required"}
          </Button>
        )
      }
    >
      {feedback.feedback}
      <RecordFieldGrid
        keepEmpty
        fields={[
          { label: "VHC required", value: jobData.vhcRequired ? "Yes" : "No" },
          { label: "Completed", value: formatSettingsDateTime(jobData.vhcCompletedAt) || "Not completed" },
          { label: "Sent to customer", value: formatSettingsDateTime(jobData.vhcSentAt) || "Not sent" },
        ]}
      />
      {jobData.vhcCompletedAt ? (
        vhcLockMessage ? (
          <LockedNotice>{`Reopening the VHC is unavailable: ${vhcLockMessage}`}</LockedNotice>
        ) : (
          <>
            <ReasonField
              id="job-settings-vhc-reason"
              label="Reason for reopening the VHC"
              value={reason}
              onChange={setReason}
              disabled={Boolean(busy)}
            />
            <div className="app-record-actions">
              <Button
                type="button"
                variant="secondary"
                busy={busy === "reopen"}
                disabled={Boolean(busy) || !isReasonValid(reason)}
                onClick={reopen}
              >
                Reopen VHC
              </Button>
            </div>
          </>
        )
      ) : null}
      <p className="app-record-note">
        There is no whole-VHC reset. Individual items are reset or reopened from the VHC tab, where each decision
        keeps its own history.
      </p>
    </SettingsCard>
  );
}

function LinkedJobsCard({ ctx }) {
  const { jobData, permissions, isArchiveMode, statusLabel, settings, onChanged, linking } = ctx;
  const { confirm } = useConfirmation();
  const [busyJobId, setBusyJobId] = useState(null);
  const feedback = useActionFeedback();
  const canLink = !getEditLockMessage(permissions, { isArchiveMode, statusLabel });

  const hostJobNumber = jobData.primeJobNumber || (jobData.isPrimeJob ? jobData.jobNumber : null);
  const groupJobs = linking.relatedJobs.length
    ? [
        { id: jobData.id, jobNumber: jobData.jobNumber, status: statusLabel || jobData.status, type: jobData.type, isCurrent: true },
        ...linking.relatedJobs,
      ].sort((a, b) => (a.jobNumber === hostJobNumber ? 0 : 1) - (b.jobNumber === hostJobNumber ? 0 : 1))
    : [];
  const otherLinkedCount = groupJobs.filter((job) => job.jobNumber !== hostJobNumber).length;

  const unlink = async (job) => {
    const confirmed = await confirm({
      title: null,
      message: `Unlink job #${job.jobNumber} from this group?`,
      description:
        otherLinkedCount <= 1
          ? "It is the last linked job, so the group is dissolved and both jobs become standalone."
          : "It becomes a standalone job card. The rest of the group is unchanged.",
      confirmLabel: "Unlink job",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;
    setBusyJobId(job.id);
    feedback.clear();
    try {
      const result = await settings.runAction("unlink_job", { targetJobId: job.id });
      feedback.show(result);
      if (result.success) await onChanged();
    } finally {
      setBusyJobId(null);
    }
  };

  return (
    <SettingsCard sectionKey="jobcard-settings-linked-jobs" title="Linked jobs">
      {feedback.feedback}
      {linking.relatedJobsLoading ? (
        <p className="app-record-note">Loading linked jobs…</p>
      ) : groupJobs.length ? (
        <DataTableShell visibleRows={6}>
          <table className="app-data-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Role</th>
                <th>Type</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {groupJobs.map((job) => {
                const isHost = job.jobNumber === hostJobNumber;
                // The host is unlinked last: every linked job is keyed to it.
                const canUnlinkRow = canLink && (!isHost || otherLinkedCount === 0);
                return (
                  <tr key={job.id || job.jobNumber}>
                    <td data-table-cell="nowrap">
                      <strong>#{job.jobNumber}</strong>
                    </td>
                    <td>
                      <StatusBadge tone={isHost ? "accent-strong" : "neutral"}>{isHost ? "Host" : "Linked"}</StatusBadge>
                    </td>
                    <td>{job.type || "—"}</td>
                    <td>
                      <StatusBadge tone={jobStatusTone(job.status)}>{job.status || "Unknown"}</StatusBadge>
                    </td>
                    <td data-table-cell="nowrap">
                      <div className="app-record-actions">
                        {job.isCurrent ? (
                          <span className="app-record-note">This job</span>
                        ) : (
                          <Button type="button" variant="secondary" size="sm" onClick={() => linking.onOpenJob?.(job.jobNumber)}>
                            Open
                          </Button>
                        )}
                        {canUnlinkRow && !isHost ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            busy={busyJobId === job.id}
                            disabled={Boolean(busyJobId)}
                            onClick={() => unlink(job)}
                          >
                            Unlink
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTableShell>
      ) : (
        <p className="app-record-note">This job is not linked to any other job cards.</p>
      )}

      {canLink ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "var(--space-sm)" }}>
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <SettingsField id="job-settings-link-input" label="Link another job card">
                <input
                  id="job-settings-link-input"
                  className="app-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 00099"
                  value={linking.linkJobInput}
                  disabled={linking.isLinking}
                  onChange={(event) => linking.onLinkJobInputChange?.(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") linking.onLinkJob?.();
                  }}
                />
              </SettingsField>
            </div>
            <Button type="button" variant="primary" onClick={linking.onLinkJob} busy={linking.isLinking} disabled={linking.isLinking}>
              {linking.isLinking ? "Linking…" : "Link job"}
            </Button>
          </div>
          <p className="app-record-note">
            {hostJobNumber
              ? `Linked jobs join the group hosted by job #${hostJobNumber}.`
              : "This job becomes the host job for the group once another job is linked."}
          </p>
          {linking.linkError ? <LockedNotice tone="danger">{linking.linkError}</LockedNotice> : null}
          {linking.linkSuccess ? <LockedNotice tone="success">{linking.linkSuccess}</LockedNotice> : null}
        </div>
      ) : (
        <LockedNotice>{getEditLockMessage(permissions, { isArchiveMode, statusLabel })}</LockedNotice>
      )}

      <RecordFieldGrid
        fields={[
          {
            label: "Linked warranty job",
            value: jobData.linkedWarrantyJobNumber
              ? `#${jobData.linkedWarrantyJobNumber}${jobData.linkedWarrantyJobStatus ? ` · ${jobData.linkedWarrantyJobStatus}` : ""}`
              : "",
          },
          { label: "VHC master job", value: jobData.warrantyVhcMasterJobNumber ? `#${jobData.warrantyVhcMasterJobNumber}` : "" },
        ]}
      />
    </SettingsCard>
  );
}

export default function WorkflowSection({ ctx }) {
  return (
    <>
      <StatusCard ctx={ctx} />
      <LocksCard ctx={ctx} />
      <VhcCard ctx={ctx} />
      <LinkedJobsCard ctx={ctx} />
    </>
  );
}
