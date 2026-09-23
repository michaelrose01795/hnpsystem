// file location: src/components/page-ui/job-cards/jobSettings/DangerZoneSection.js
//
// Job Card Settings → Danger zone. The destructive and workflow-breaking
// actions, kept apart from everything else and each behind a confirmation:
//
//   Reopen   invoiced / released → In Progress. Manager / admin, with a reason.
//            The same change_status override the Workflow section makes.
//   Cancel   → Cancelled, with a cancellation reason and notes. Cancels the
//            appointment too (cancelJobAppointment) when there is one.
//   Archive  the existing archive (POST /api/jobcards/archive/create via the
//            page's handleArchiveJob) once the job is Released or Cancelled.
//   Restore  not offered: the archive system has no restore (see below).

import React, { useState } from "react";
import Button from "@/components/ui/Button";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { useConfirmation } from "@/context/ConfirmationContext";
import {
  JOB_CANCELLATION_REASONS,
  isReasonValid,
} from "@/features/jobCards/workflow/jobSettings";
import { STATUSES as JOB_STATUSES } from "@/lib/status/catalog/job";
import {
  LockedNotice,
  ReasonField,
  SettingsCard,
  SettingsField,
  useActionFeedback,
} from "@/components/page-ui/job-cards/jobSettings/settingsParts";

function ReopenCard({ ctx }) {
  const { jobData, permissions, statusLabel, settings, onChanged } = ctx;
  const { confirm } = useConfirmation();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const feedback = useActionFeedback();

  const main = permissions.mainStatusForEditLock;
  const reopenable = main === JOB_STATUSES.INVOICED || main === JOB_STATUSES.RELEASED;
  const unavailable = !reopenable
    ? "Only invoiced or released jobs are reopened. This job is not locked by invoicing."
    : !permissions.canReopenJob
    ? "Reopening an invoiced or released job needs a manager or admin."
    : null;

  const submit = async () => {
    const confirmed = await confirm({
      title: null,
      message: `Reopen job ${jobData.jobNumber}?`,
      description:
        "The job moves back to In Progress and every tab unlocks for editing. The existing invoice is kept; move the job back to Invoiced from Workflow once the corrections are done.",
      details: [
        { label: "Current", value: statusLabel, tone: "info" },
        { label: "New", value: "In Progress", tone: "warning" },
        { label: "Reason", value: reason.trim(), tone: "accent" },
      ],
      confirmLabel: "Reopen job",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;
    setBusy(true);
    feedback.clear();
    try {
      const result = await settings.runAction("change_status", {
        targetStatus: JOB_STATUSES.IN_PROGRESS,
        reason: reason.trim(),
      });
      feedback.show(result, "Job reopened.");
      if (result.success) {
        setReason("");
        await onChanged();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard sectionKey="jobcard-settings-danger-reopen" title="Reopen job">
      {feedback.feedback}
      {unavailable ? (
        <LockedNotice tone="info">{unavailable}</LockedNotice>
      ) : (
        <>
          <p className="app-record-note">
            Moves this {statusLabel} job back to In Progress so it can be corrected.
          </p>
          <ReasonField id="job-settings-reopen-reason" label="Reason for reopening" value={reason} onChange={setReason} disabled={busy} />
          <div className="app-record-actions">
            <Button type="button" variant="danger" busy={busy} disabled={busy || !isReasonValid(reason)} onClick={submit}>
              Reopen job
            </Button>
          </div>
        </>
      )}
    </SettingsCard>
  );
}

function CancelCard({ ctx }) {
  const { jobData, permissions, statusLabel, isArchiveMode, settings, onChanged } = ctx;
  const { confirm } = useConfirmation();
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const feedback = useActionFeedback();

  const isCancelled = permissions.mainStatusForEditLock === JOB_STATUSES.CANCELLED;
  const clockedOn = settings.activeClocking.map((entry) => entry.name);
  const unavailable = isArchiveMode
    ? "Archived job cards cannot be cancelled."
    : isCancelled
    ? "This job is already cancelled."
    : permissions.isInvoiceOrBeyondReadOnly
    ? `A ${statusLabel} job cannot be cancelled. Reopen it first.`
    : !permissions.canCancelJob
    ? "Your role cannot cancel job cards."
    : clockedOn.length
    ? `${clockedOn.join(", ")} ${clockedOn.length === 1 ? "is" : "are"} clocked on. Clock off before cancelling.`
    : null;

  const submit = async () => {
    const confirmed = await confirm({
      title: null,
      message: `Cancel job ${jobData.jobNumber}?`,
      description:
        "The job becomes Cancelled and read-only, and any appointment is cancelled. It is not archived — archive it from here afterwards once you're sure.",
      details: [
        { label: "Customer", value: jobData.customer || "N/A", tone: "info" },
        { label: "Vehicle", value: jobData.reg || "N/A", tone: "warning" },
        { label: "Reason", value: category, tone: "accent" },
      ],
      confirmLabel: "Cancel job",
      cancelLabel: "Keep job",
    });
    if (!confirmed) return;
    setBusy(true);
    feedback.clear();
    try {
      const result = await settings.runAction("cancel_job", { reasonCategory: category, notes: notes.trim() });
      feedback.show(result, "Job cancelled.");
      if (result.success) {
        setCategory("");
        setNotes("");
        await onChanged();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard sectionKey="jobcard-settings-danger-cancel" title="Cancel job">
      {feedback.feedback}
      {unavailable ? (
        <LockedNotice tone="info">{unavailable}</LockedNotice>
      ) : (
        <>
          <SettingsField id="job-settings-cancel-reason" label="Cancellation reason">
            <DropdownField
              id="job-settings-cancel-reason"
              options={JOB_CANCELLATION_REASONS.map((value) => ({ value, label: value }))}
              value={category}
              onValueChange={setCategory}
              placeholder="Select a reason"
              disabled={busy}
            />
          </SettingsField>
          <ReasonField
            id="job-settings-cancel-notes"
            label="Cancellation notes"
            value={notes}
            onChange={setNotes}
            disabled={busy}
            placeholder="What happened, and anything the next person needs to know"
          />
          <div className="app-record-actions">
            <Button
              type="button"
              variant="danger"
              busy={busy}
              disabled={busy || !category || !isReasonValid(notes)}
              onClick={submit}
            >
              Cancel job
            </Button>
          </div>
        </>
      )}
    </SettingsCard>
  );
}

function ArchiveCard({ ctx }) {
  const { permissions, isArchiveMode, handlers } = ctx;
  const [busy, setBusy] = useState(false);
  const feedback = useActionFeedback();

  const unavailable = isArchiveMode
    ? "This job card is already archived."
    : !permissions.canArchiveJob
    ? permissions.canEditBase
      ? "Archiving becomes available once the job is Released or Cancelled."
      : "Your role cannot archive job cards."
    : null;

  const submit = async () => {
    setBusy(true);
    feedback.clear();
    try {
      // The page's archive handler owns the confirmation and, on success,
      // leaves the job card for the newsfeed.
      const result = await handlers.onArchiveJob();
      if (result && !result.success && !result.cancelled) {
        feedback.show({ success: false, error: result.error || "The job could not be archived." });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard sectionKey="jobcard-settings-danger-archive" title="Archive job">
      {feedback.feedback}
      {unavailable ? (
        <LockedNotice tone="info">{unavailable}</LockedNotice>
      ) : (
        <>
          <p className="app-record-note">
            Moves the job card, its VHC, parts, notes, documents and history into the archive and removes the live
            records. The archived copy stays readable from Archive.
          </p>
          <div className="app-record-actions">
            <Button type="button" variant="danger" busy={busy} disabled={busy} onClick={submit}>
              Archive job
            </Button>
          </div>
        </>
      )}
      <LockedNotice tone="info">
        Restoring from the archive is not available. Archiving moves the job&apos;s live records into a snapshot
        and deletes them, and the archive system has no restore that can rebuild them safely — ask an
        administrator if an archived job has to come back.
      </LockedNotice>
    </SettingsCard>
  );
}

export default function DangerZoneSection({ ctx }) {
  return (
    <>
      <LockedNotice tone="danger">
        These actions break or end the normal workflow. Each one asks for confirmation and is recorded in the audit
        history with your name.
      </LockedNotice>
      <ReopenCard ctx={ctx} />
      <CancelCard ctx={ctx} />
      <ArchiveCard ctx={ctx} />
    </>
  );
}
