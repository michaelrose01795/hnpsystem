// file location: src/pages/api/job-cards/[jobNumber]/settings.js
//
// Job Card Settings control centre (settings popup on /job-cards/[jobNumber]).
//
//   GET  → { success, data: { meta, advisors, activeClocking, archived } }
//   POST { action, jobId, ... } → { success, message } | { success:false, error, code? }
//
// This route is the authority for every settings change that needs a server
// decision: permissions are re-resolved here from the SESSION's roles with the
// same resolveJobCardPermissions the page uses, and each rule comes from
// src/features/jobCards/workflow/jobSettings.js. Every write goes through the
// canonical helpers in src/lib/database/jobs.js, so job_status_history,
// job_activity_events, notifications and tracking movements behave exactly as
// they do for the buttons elsewhere on the job card.
//
// Changes that already have a canonical client path on the job card (appointment
// date/time, mileage, vehicle association, waiting status, key/car locations,
// loan cars, Link Job, archive) are NOT duplicated here — the popup calls those
// existing handlers and APIs directly.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { normalizeRoles } from "@/lib/auth/roles";
import { resolveJobCardPermissions } from "@/features/jobCards/workflow/permissions";
import {
  JOB_CANCELLATION_REASONS,
  JOB_DIVISION_OPTIONS,
  JOB_PRIORITY_OPTIONS,
  JOB_SOURCE_OPTIONS,
  SETTINGS_REASON_MIN_LENGTH,
  getStatusChangeBlocker,
  isReasonValid,
  planStatusChange,
  resolveJobTypeForSource,
} from "@/features/jobCards/workflow/jobSettings";
import { DISPLAY as JOB_DISPLAY, STATUSES as JOB_STATUSES } from "@/lib/status/catalog/job";
import {
  assignTechnicianToJob,
  cancelJobAppointment,
  hasInvoiceForJob,
  setJobNextUpdateDue,
  unassignTechnicianFromJob,
  unlinkJobFromPrimeGroup,
  updateJob,
  updateJobStatus,
} from "@/lib/database/jobs";
import {
  buildJobSettingsMeta,
  getActiveClockingForJob,
  hasOpenAppointment,
  isJobArchived,
  loadJobForSettings,
} from "@/lib/database/jobSettings";
import { getServiceAdvisorUsers } from "@/lib/database/users";
import { logJobActivity } from "@/lib/database/jobActivity";
import { autoSetCheckedInStatus, logJobSubStatus } from "@/lib/services/jobStatusService";

class SettingsError extends Error {
  constructor(message, status = 400, code = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const fail = (message, status = 400, code = null) => {
  throw new SettingsError(message, status, code);
};

const hasKey = (body, key) => Object.prototype.hasOwnProperty.call(body || {}, key);

const toUserId = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
};

const requireMigration = (migrationPending) => {
  if (migrationPending) {
    fail(
      "Priority, service advisor and next-update owner need database migration 20260923120000_job_card_settings_fields.",
      409,
      "migration_pending"
    );
  }
};

const assertWrite = (result, fallback) => {
  if (!result?.success) {
    fail(result?.error?.message || result?.error || fallback, 400);
  }
  return result;
};

/* ------------------------------------------------------------------------ */
/* Actions                                                                   */
/* ------------------------------------------------------------------------ */

async function updateGeneral({ job, body, permissions, migrationPending, actorId }) {
  if (!permissions.canEdit) fail(permissions.generalReadOnlyLockDescription || "This job card is read-only.", 403);

  const updates = {};
  const changed = [];

  if (hasKey(body, "priority")) {
    requireMigration(migrationPending);
    if (!JOB_PRIORITY_OPTIONS.some((option) => option.value === body.priority)) fail("Choose a valid priority.");
    if (body.priority !== (job.priority || "normal")) {
      updates.priority = body.priority;
      changed.push("priority");
    }
  }

  if (hasKey(body, "jobSource")) {
    if (!JOB_SOURCE_OPTIONS.includes(body.jobSource)) fail("Choose a valid job source.");
    if (body.jobSource !== (job.job_source || "Retail")) {
      if (job.warranty_linked_job_id || job.warranty_vhc_master_job_id) {
        fail("The job source cannot change while this job is linked to a warranty job.", 409);
      }
      updates.job_source = body.jobSource;
      updates.type = resolveJobTypeForSource(body.jobSource);
      changed.push("job source");
    }
  }

  if (hasKey(body, "jobDivision")) {
    if (!JOB_DIVISION_OPTIONS.includes(body.jobDivision)) fail("Choose a valid division.");
    if (body.jobDivision !== (job.job_division || "Retail")) {
      updates.job_division = body.jobDivision;
      changed.push("division");
    }
  }

  if (!changed.length) return { message: "No changes to save." };

  assertWrite(await updateJob(job.id, { ...updates, activity_actor_id: actorId }), "Failed to save job details.");
  return { message: `Saved ${changed.join(", ")}.` };
}

async function updateAssignment({ job, body, permissions, migrationPending, actorId, activeClocking }) {
  if (!permissions.canEdit) fail(permissions.generalReadOnlyLockDescription || "This job card is read-only.", 403);
  const changed = [];

  if (hasKey(body, "serviceAdvisorId")) {
    requireMigration(migrationPending);
    const advisorId = toUserId(body.serviceAdvisorId);
    if (Number.isNaN(advisorId)) fail("Choose a valid service advisor.");
    if (advisorId !== (job.service_advisor_id ?? null)) {
      assertWrite(
        await updateJob(job.id, { service_advisor_id: advisorId, activity_actor_id: actorId }),
        "Failed to change the service advisor."
      );
      changed.push("service advisor");
    }
  }

  if (hasKey(body, "technicianId")) {
    const technicianId = toUserId(body.technicianId);
    if (Number.isNaN(technicianId)) fail("Choose a valid technician.");
    if (technicianId !== (job.assigned_to ?? null)) {
      const clockedOnAssignee = activeClocking.find((entry) => Number(entry.userId) === Number(job.assigned_to));
      if (clockedOnAssignee) {
        fail(`${clockedOnAssignee.name} is clocked on to this job. Clock them off before changing the technician.`, 409);
      }
      const result = technicianId
        ? await assignTechnicianToJob(job.id, technicianId, null, { actorId })
        : await unassignTechnicianFromJob(job.id, { actorId });
      assertWrite(result, "Failed to change the technician.");
      changed.push(technicianId ? "technician" : "technician removed");
    }
  }

  return { message: changed.length ? `Saved ${changed.join(", ")}.` : "No changes to save." };
}

async function updateCustomerUpdates({ job, body, permissions, migrationPending, actorId }) {
  if (!permissions.canEdit) fail(permissions.generalReadOnlyLockDescription || "This job card is read-only.", 403);
  const changed = [];

  if (hasKey(body, "nextUpdateDue")) {
    let normalized = null;
    if (body.nextUpdateDue) {
      const parsed = new Date(body.nextUpdateDue);
      if (Number.isNaN(parsed.getTime())) fail("The next update time is not a valid date.");
      normalized = parsed.toISOString();
    }
    const current = job.next_update_due ? new Date(job.next_update_due).toISOString() : null;
    if (normalized !== current) {
      assertWrite(await setJobNextUpdateDue(job.id, normalized, { actorId }), "Failed to set the next update time.");
      changed.push("next update time");
    }
  }

  const ownerChange = hasKey(body, "nextUpdateOwnerId");
  const reminderChange = hasKey(body, "nextUpdateReminderEnabled");
  if (ownerChange || reminderChange) {
    requireMigration(migrationPending);
    const updates = {};
    if (ownerChange) {
      const ownerId = toUserId(body.nextUpdateOwnerId);
      if (Number.isNaN(ownerId)) fail("Choose a valid member of staff.");
      if (ownerId !== (job.next_update_owner_id ?? null)) updates.next_update_owner_id = ownerId;
    }
    if (reminderChange) {
      const enabled = body.nextUpdateReminderEnabled === true;
      if (enabled !== (job.next_update_reminder_enabled === true)) updates.next_update_reminder_enabled = enabled;
    }
    if (Object.keys(updates).length) {
      assertWrite(
        await updateJob(job.id, { ...updates, activity_actor_id: actorId }),
        "Failed to save the customer update settings."
      );
      changed.push("update owner / reminder");
    }
  }

  return { message: changed.length ? `Saved ${changed.join(", ")}.` : "No changes to save." };
}

async function changeStatus({ job, body, permissions, actorId, activeClocking }) {
  const reason = String(body.reason || "").trim();
  const plan = planStatusChange({
    currentStatus: job.status,
    targetStatus: body.targetStatus,
    hasActiveClocking: activeClocking.length > 0,
  });
  const blocker = getStatusChangeBlocker(plan, permissions, { reason });
  if (blocker) fail(blocker, plan.requiresOverride && !permissions.canOverrideWorkflow ? 403 : 409);
  // Invoiced means an invoice exists. The first invoice is raised from the
  // Invoice tab, which moves the job itself; this only returns a reopened job.
  if (plan.toId === JOB_STATUSES.INVOICED && !(await hasInvoiceForJob(job.id))) {
    fail("There is no invoice for this job yet. Create it from the Invoice tab.", 409);
  }

  const auditReason = reason || `Moved to ${plan.toLabel} from job card settings`;
  const result =
    plan.isForward && plan.toId === JOB_STATUSES.CHECKED_IN
      ? await autoSetCheckedInStatus(job.id, actorId) // same path as the header Check In button
      : await updateJobStatus(job.id, JOB_DISPLAY[plan.toId], actorId, auditReason);
  assertWrite(result, `Failed to move the job to ${plan.toLabel}.`);

  if (plan.requiresOverride) {
    await logJobActivity({
      jobId: job.id,
      category: "job",
      action: plan.isReopen ? "reopened" : "workflow_override",
      summary: `${plan.isReopen ? "Job reopened" : "Workflow override"}: ${plan.fromLabel} → ${plan.toLabel}. Reason: ${reason}`,
      payload: { from: plan.fromId, to: plan.toId, reason, source: "job_card_settings" },
      performedBy: actorId,
    });
  }

  return { message: `Job moved to ${plan.toLabel}.` };
}

async function cancelJob({ job, body, permissions, actorId, activeClocking }) {
  if (!permissions.canCancelJob) {
    fail(
      permissions.isInvoiceOrBeyondReadOnly
        ? `A ${job.status} job cannot be cancelled. Reopen it first.`
        : "You do not have permission to cancel this job.",
      403
    );
  }
  if (activeClocking.length) {
    fail(`${activeClocking.map((entry) => entry.name).join(", ")} clocked on. Clock off before cancelling.`, 409);
  }
  const category = String(body.reasonCategory || "").trim();
  const notes = String(body.notes || "").trim();
  if (!JOB_CANCELLATION_REASONS.includes(category)) fail("Choose a cancellation reason.");
  if (!isReasonValid(notes)) fail(`Add cancellation notes of at least ${SETTINGS_REASON_MIN_LENGTH} characters.`);

  const reasonText = `${category}: ${notes}`;
  const result = (await hasOpenAppointment(job.id))
    ? await cancelJobAppointment(job.id, null, actorId, reasonText) // cancels the appointment too
    : await updateJobStatus(job.id, JOB_DISPLAY[JOB_STATUSES.CANCELLED], actorId, reasonText);
  assertWrite(result, "Failed to cancel the job.");

  await logJobActivity({
    jobId: job.id,
    category: "job",
    action: "cancelled",
    summary: `Job cancelled — ${category}. ${notes}`,
    payload: { reason: category, notes, source: "job_card_settings" },
    performedBy: actorId,
  });

  return { message: "Job cancelled." };
}

async function setVhcRequired({ job, body, permissions, actorId }) {
  if (!permissions.canEdit) fail(permissions.generalReadOnlyLockDescription || "This job card is read-only.", 403);
  const required = body.required === true;
  if (required === (job.vhc_required === true)) return { message: "No changes to save." };
  assertWrite(
    await updateJob(job.id, { vhc_required: required, activity_actor_id: actorId }),
    "Failed to update the VHC requirement."
  );
  return { message: required ? "VHC marked as required." : "VHC marked as not required." };
}

async function reopenVhc({ job, body, permissions, actorId }) {
  if (!permissions.canEditPartsWriteUpVhc) {
    fail(permissions.partsWriteUpVhcLockDescription || "The VHC is locked for the current job status.", 403);
  }
  if (!job.vhc_completed_at) fail("The VHC has not been completed, so there is nothing to reopen.", 409);
  const reason = String(body.reason || "").trim();
  if (!isReasonValid(reason)) fail(`Give a reason of at least ${SETTINGS_REASON_MIN_LENGTH} characters.`);

  // The technician page's "Reopen VHC" path: clear the completion stamp and log
  // the VHC Reopened sub-status.
  assertWrite(
    await updateJob(job.id, { vhc_completed_at: null, activity_actor_id: actorId }),
    "Failed to reopen the VHC."
  );
  const subStatus = await logJobSubStatus(job.id, "VHC Reopened", actorId, reason);
  if (!subStatus?.success) fail("The VHC was reopened but its status history could not be written.", 500);
  return { message: "VHC reopened." };
}

async function unlinkJob({ job, body, permissions, actorId }) {
  if (!permissions.canEdit) fail(permissions.generalReadOnlyLockDescription || "This job card is read-only.", 403);
  const targetJobId = Number(body.targetJobId);
  if (!Number.isInteger(targetJobId) || targetJobId <= 0) fail("Choose a job to unlink.");

  const { job: target } = await loadJobForSettings(targetJobId);
  if (!target || !job.prime_job_number || target.prime_job_number !== job.prime_job_number) {
    fail("That job is not in this job's linked group.", 404);
  }

  assertWrite(await unlinkJobFromPrimeGroup(target.id, { actorId }), "Failed to unlink the job.");
  const summary = `Job #${target.job_number} unlinked from the group hosted by #${job.prime_job_number}`;
  await Promise.all(
    Array.from(new Set([job.id, target.id])).map((jobId) =>
      logJobActivity({ jobId, category: "job", action: "unlinked", summary, payload: { targetJobId: target.id }, performedBy: actorId })
    )
  );
  return { message: `Job #${target.job_number} unlinked.` };
}

const ACTIONS = {
  update_general: updateGeneral,
  update_assignment: updateAssignment,
  update_customer_updates: updateCustomerUpdates,
  change_status: changeStatus,
  cancel_job: cancelJob,
  set_vhc_required: setVhcRequired,
  reopen_vhc: reopenVhc,
  unlink_job: unlinkJob,
};

/* ------------------------------------------------------------------------ */
/* Handler                                                                   */
/* ------------------------------------------------------------------------ */

async function handler(req, res, session) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const rawJobNumber = Array.isArray(req.query.jobNumber) ? req.query.jobNumber[0] : req.query.jobNumber;
  if (!rawJobNumber) {
    return res.status(400).json({ success: false, error: "Job number is required" });
  }

  try {
    const { job, migrationPending } = await loadJobForSettings(rawJobNumber);
    if (!job?.id) {
      return res.status(404).json({ success: false, error: "Job card not found" });
    }

    const [archived, activeClocking] = await Promise.all([isJobArchived(job.id), getActiveClockingForJob(job.id)]);
    const roles = normalizeRoles(session?.user?.roles || []);
    const permissions = resolveJobCardPermissions({
      userRoles: roles,
      jobStatus: job.status,
      isArchiveMode: archived,
      vhcRequired: job.vhc_required === true,
    });

    if (req.method === "GET") {
      const [meta, advisors] = await Promise.all([
        buildJobSettingsMeta(job, { migrationPending }),
        getServiceAdvisorUsers().catch(() => []),
      ]);
      return res.status(200).json({
        success: true,
        data: {
          meta,
          archived,
          activeClocking,
          advisors: advisors.map((user) => ({ id: user.id, name: user.name, role: user.role })),
        },
      });
    }

    const body = req.body || {};
    // The page sends the id of the job it is showing; refuse if the route's job
    // number resolved to a different row, rather than act on the wrong job.
    if (body.jobId && Number(body.jobId) !== Number(job.id)) {
      return res.status(409).json({ success: false, error: "This job card changed. Reload it and try again." });
    }
    if (archived) {
      return res.status(403).json({ success: false, error: "Archived job cards are read-only." });
    }

    const action = ACTIONS[body.action];
    if (!action) {
      return res.status(400).json({ success: false, error: "Unknown settings action" });
    }

    const actorId = Number(session?.user?.user_id || session?.user?.id) || null;
    const result = await action({ job, body, permissions, migrationPending, actorId, activeClocking });
    return res.status(200).json({ success: true, message: result?.message || "Saved." });
  } catch (error) {
    if (error instanceof SettingsError) {
      return res.status(error.status).json({ success: false, error: error.message, code: error.code || undefined });
    }
    console.error("❌ /api/job-cards/[jobNumber]/settings error:", error);
    return res.status(500).json({ success: false, error: error?.message || "Server error" });
  }
}

export default withRoleGuard(handler);
