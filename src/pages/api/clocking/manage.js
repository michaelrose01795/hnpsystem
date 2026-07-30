import { withRoleGuard } from "@/lib/auth/roleGuard";
import {
  hasAnyRole,
  TECHNICIAN_ROLES,
  WORKSHOP_CAPACITY_MANAGER_ROLES,
} from "@/lib/auth/roles";
import { getJobByNumber } from "@/lib/database/jobs";
import {
  clockInToJob,
  clockOutFromJob,
  getUserActiveJobs,
} from "@/lib/database/jobClocking";
import { getUserById } from "@/lib/database/users";
import { getAuditContext } from "@/lib/audit/auditContext";
import { writeAuditLog } from "@/lib/audit/auditLog";

const parsePositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export async function manageClockingHandler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  try {
    const auditContext = await getAuditContext(req, res);
    const action = String(req.body?.action || "").trim().toLowerCase();
    const userId = parsePositiveInteger(req.body?.userId);

    if (!userId || !["clock-in", "clock-out"].includes(action)) {
      return res.status(400).json({ success: false, message: "A valid action and technician are required." });
    }

    const targetUser = await getUserById(userId);
    if (!targetUser || !hasAnyRole([targetUser.role], TECHNICIAN_ROLES)) {
      return res.status(404).json({ success: false, message: "The selected technician could not be found." });
    }

    if (action === "clock-out") {
      const activeResult = await getUserActiveJobs(userId);
      if (!activeResult?.success) {
        throw new Error(activeResult?.error || "Unable to load the technician's active clocking entries.");
      }

      const requestedClockingId = parsePositiveInteger(req.body?.clockingId);
      const activeEntry = requestedClockingId
        ? activeResult.data?.find((entry) => Number(entry.clockingId) === requestedClockingId)
        : activeResult.data?.[0];

      if (!activeEntry) {
        return res.status(409).json({ success: false, message: "This technician is no longer clocked onto that job." });
      }

      const result = await clockOutFromJob({
        userId,
        jobId: activeEntry.jobId,
        clockingId: activeEntry.clockingId,
      });

      if (!result?.success) {
        throw new Error(result?.error || "Unable to clock the technician off.");
      }

      await writeAuditLog({
        ...auditContext,
        action: "job_clocked_off",
        entityType: "job_card",
        entityId: activeEntry.jobNumber || activeEntry.jobId,
        beforeData: {
          clocked_on: true,
          clocking_id: activeEntry.clockingId,
          clock_in: activeEntry.clockIn,
          clock_out: null,
        },
        afterData: {
          clocked_on: false,
          clocking_id: result.data?.clockingId,
          clock_out: result.data?.clockOut,
          hours_worked: result.data?.hoursWorked,
        },
        diff: { target_user_id: userId, source: "clocking_manager" },
      });
      return res.status(200).json({ success: true, data: result.data });
    }

    const jobNumber = String(req.body?.jobNumber || "").trim();
    if (!jobNumber) {
      return res.status(400).json({ success: false, message: "A job number is required." });
    }

    const jobResult = await getJobByNumber(jobNumber, { force: true, noCache: true });
    const job = jobResult?.data?.jobCard;
    if (jobResult?.error || !job?.id) {
      return res.status(404).json({ success: false, message: jobResult?.error?.message || "Job number not found." });
    }

    const result = await clockInToJob({
      userId,
      jobId: job.id,
      jobNumber: job.job_number || jobNumber,
      workType: "manual",
    });

    if (!result?.success) {
      throw new Error(result?.error || "Unable to clock the technician onto the job.");
    }

    await writeAuditLog({
      ...auditContext,
      action: "job_clocked_on",
      entityType: "job_card",
      entityId: job.job_number || jobNumber,
      beforeData: { clocked_on: false },
      afterData: {
        clocked_on: true,
        clocking_id: result.data?.clockingId,
        clock_in: result.data?.clockIn,
        work_type: result.data?.workType,
      },
      diff: { target_user_id: userId, source: "clocking_manager" },
    });
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error("/api/clocking/manage error", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Unable to update technician clocking.",
    });
  }
}

export default withRoleGuard(manageClockingHandler, { allow: WORKSHOP_CAPACITY_MANAGER_ROLES });
