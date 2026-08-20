import { getJobCapacityProgress } from "@/lib/capacity/technicianCapacity";
import {
  getDefaultWorkshopAssignment,
  resolveWorkshopAssignment,
  WORKSHOP_ASSIGNMENT_TYPES,
} from "@/lib/clocking/workshopAssignments";
import { generateTechnicianSlug } from "@/utils/technicianSlug";

export const CLOCKING_STATUSES = Object.freeze({
  IN_PROGRESS: "In Progress",
  ON_MOT: "On MOT",
  TEA_BREAK: "Tea Break",
  WAITING: "Waiting for Job",
  NOT_CLOCKED: "Not Clocked In",
});

export const DEFAULT_WAITING_THRESHOLD_MINUTES = 30;

const COMPLETE_REQUEST_STATUSES = new Set(["complete", "completed", "done"]);
const ACTIVE_JOB_STATUS = "IN PROGRESS";

const asTime = (value) => {
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(time) ? time : null;
};

const roundHours = (value) => Math.round((Number(value) || 0) * 100) / 100;

const toOptionalHours = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const hours = Number(value);
  return Number.isFinite(hours) && hours >= 0 ? roundHours(hours) : null;
};

const durationHours = (start, end, nowMs) => {
  const startMs = asTime(start);
  const endMs = end ? asTime(end) : nowMs;
  if (startMs === null || endMs === null) return 0;
  return Math.max(0, endMs - startMs) / 3600000;
};

const isBreakRecord = (record) => {
  const notes = String(record?.notes || "").toLowerCase();
  return notes.includes("tea") || notes.includes("break");
};

const isMotJob = (job) => {
  const status = String(job?.status || "").toLowerCase();
  const categories = Array.isArray(job?.job_categories) ? job.job_categories : [];
  return status.includes("mot") || categories.some((category) => String(category || "").toLowerCase().includes("mot"));
};

const getAppointment = (job) => {
  const appointments = Array.isArray(job?.appointments) ? job.appointments : [];
  return [...appointments]
    .filter((appointment) => appointment?.scheduled_time)
    .sort((a, b) => (asTime(a.scheduled_time) || 0) - (asTime(b.scheduled_time) || 0))[0] || null;
};

const buildRequestProgress = (job) => {
  const progress = { totalHours: 0, completedHours: 0 };
  (Array.isArray(job?.job_requests) ? job.job_requests : []).forEach((request) => {
    const source = String(request?.request_source || "").trim().toLowerCase();
    if (request?.vhc_item_id || source.includes("vhc")) return;
    const hours = Math.max(0, Number(request?.hours) || 0);
    progress.totalHours += hours;
    if (COMPLETE_REQUEST_STATUSES.has(String(request?.status || "").trim().toLowerCase())) {
      progress.completedHours += hours;
    }
  });
  return { [String(job?.id)]: progress };
};

const getAllocatedHours = (job, requestId) => {
  if (!job) return { hours: 0, request: null, available: false };
  const requests = Array.isArray(job?.job_requests) ? job.job_requests : [];
  const selectedRequest = requestId == null
    ? null
    : requests.find((request) => String(request.request_id) === String(requestId));
  const selectedHours = toOptionalHours(selectedRequest?.hours);
  if (selectedRequest && selectedHours !== null) {
    return { hours: selectedHours, request: selectedRequest, available: true };
  }

  // VHC-authorised job requests intentionally store `hours` as NULL; their
  // allocation remains on the linked vhc_checks row. Do not coerce NULL to
  // zero or the live card incorrectly reports "No allocation set".
  const selectedVhcId = selectedRequest?.vhc_item_id;
  const selectedVhcCheck = (Array.isArray(job?.vhc_checks) ? job.vhc_checks : []).find((check) =>
    (selectedVhcId != null && String(check?.vhc_id) === String(selectedVhcId)) ||
    (requestId != null && String(check?.request_id) === String(requestId))
  );
  const selectedVhcHours = toOptionalHours(selectedVhcCheck?.labour_hours);
  if (selectedRequest && selectedVhcCheck && selectedVhcHours !== null) {
    return { hours: selectedVhcHours, request: selectedRequest, available: true };
  }

  const normalisedJob = {
    id: job?.id,
    techCompletionStatus: job?.tech_completion_status,
    vhcChecks: Array.isArray(job?.vhc_checks) ? job.vhc_checks : [],
  };
  const progress = getJobCapacityProgress(normalisedJob, buildRequestProgress(job));
  return { hours: progress.plannedHours, request: null, available: true };
};

const jobDescription = (job, request) =>
  request?.description ||
  request?.job_type ||
  job?.description ||
  job?.job_description_snapshot ||
  job?.type ||
  "No description available";

// A job's customer-facing request lines, in board order. VHC-sourced requests
// are excluded to match the allocation maths in buildRequestProgress, and the
// actively-clocked request is hoisted first so the card leads with the work the
// technician is actually on. Falls back to the single job description.
const jobDescriptions = (job, activeRequest) => {
  const requests = (Array.isArray(job?.job_requests) ? job.job_requests : [])
    .filter((request) => {
      const source = String(request?.request_source || "").trim().toLowerCase();
      return !request?.vhc_item_id && !source.includes("vhc");
    })
    .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));

  const activeId = activeRequest?.request_id;
  const ordered = activeId == null
    ? requests
    : [
      ...requests.filter((request) => String(request.request_id) === String(activeId)),
      ...requests.filter((request) => String(request.request_id) !== String(activeId)),
    ];

  const lines = [];
  ordered.forEach((request) => {
    const line = String(request?.description || request?.job_type || "").trim();
    if (line && !lines.includes(line)) lines.push(line);
  });

  if (lines.length) return lines;
  const fallback = jobDescription(job, activeRequest);
  return fallback ? [fallback] : [];
};

const compareQueueJobs = (a, b) => {
  const aPosition = Number.isFinite(Number(a?.queue_position)) ? Number(a.queue_position) : Number.MAX_SAFE_INTEGER;
  const bPosition = Number.isFinite(Number(b?.queue_position)) ? Number(b.queue_position) : Number.MAX_SAFE_INTEGER;
  if (aPosition !== bPosition) return aPosition - bPosition;
  const aTime = asTime(getAppointment(a)?.scheduled_time) || Number.MAX_SAFE_INTEGER;
  const bTime = asTime(getAppointment(b)?.scheduled_time) || Number.MAX_SAFE_INTEGER;
  return aTime - bTime;
};

const getLatest = (rows, field) => [...rows].sort((a, b) => (asTime(b?.[field]) || 0) - (asTime(a?.[field]) || 0))[0] || null;

const clockingPairKey = (row) => {
  const clockIn = asTime(row?.clock_in);
  if (clockIn === null || row?.user_id == null || row?.job_id == null) return null;
  return `${row.user_id}:${row.job_id}:${clockIn}`;
};

// Attendance auto-close historically closed the paired time_records row but
// could leave job_clocking open. Reconcile the read model from the exact
// user/job/clock-in pair so stale rows cannot accrue time indefinitely.
export const reconcileJobClockingsWithTimeRecords = (jobClockings = [], timeRecords = []) => {
  const closedTimeRecords = new Map();
  timeRecords.forEach((record) => {
    if (!record?.clock_out) return;
    const key = clockingPairKey(record);
    if (key) closedTimeRecords.set(key, record.clock_out);
  });

  return jobClockings.map((clocking) => {
    if (clocking?.clock_out) return clocking;
    const key = clockingPairKey(clocking);
    const reconciledClockOut = key ? closedTimeRecords.get(key) : null;
    return reconciledClockOut
      ? { ...clocking, clock_out: reconciledClockOut, reconciledFromTimeRecord: true }
      : clocking;
  });
};

export function buildWorkshopBoard(snapshot, now = new Date()) {
  const nowMs = now.getTime();
  const users = snapshot?.users || [];
  const timeRecords = snapshot?.timeRecords || [];
  const jobClockings = snapshot?.jobClockings || [];
  const jobs = snapshot?.jobs || [];
  const assignments = snapshot?.assignments || [];
  const jobById = new Map(jobs.map((job) => [String(job.id), job]));
  const assignmentByUserId = new Map(assignments.map((assignment) => [String(assignment.user_id), assignment]));

  const rows = users.map((user) => {
    const userKey = String(user.user_id);
    const userTimeRecords = timeRecords.filter((record) => String(record.user_id) === userKey);
    const userClockings = jobClockings.filter((clocking) => String(clocking.user_id) === userKey);
    const activeClocking = getLatest(userClockings.filter((clocking) => !clocking.clock_out), "clock_in");
    const activeTimeRecord = getLatest(userTimeRecords.filter((record) => !record.clock_out), "clock_in");
    const currentJob = activeClocking ? jobById.get(String(activeClocking.job_id)) || activeClocking.job || null : null;
    const motJob = currentJob ? isMotJob(currentJob) : false;
    const hasClockedToday = userTimeRecords.length > 0;
    const defaultWorkshopAssignment = getDefaultWorkshopAssignment(user.role);
    const workshopAssignment = resolveWorkshopAssignment(
      user.role,
      assignmentByUserId.get(userKey)?.assignment_type
    );

    let status = CLOCKING_STATUSES.NOT_CLOCKED;
    if (activeClocking) status = motJob ? CLOCKING_STATUSES.ON_MOT : CLOCKING_STATUSES.IN_PROGRESS;
    else if (activeTimeRecord && isBreakRecord(activeTimeRecord)) status = CLOCKING_STATUSES.TEA_BREAK;
    else if (activeTimeRecord || hasClockedToday) status = CLOCKING_STATUSES.WAITING;

    const currentJobClockings = activeClocking
      ? userClockings.filter((clocking) => String(clocking.job_id) === String(activeClocking.job_id))
      : [];
    const actualHours = roundHours(currentJobClockings.reduce(
      (sum, clocking) => sum + durationHours(clocking.clock_in, clocking.clock_out, nowMs),
      0
    ));
    const allocation = activeClocking ? getAllocatedHours(currentJob, activeClocking.request_id) : { hours: 0, request: null, available: false };
    const differenceHours = roundHours(actualHours - allocation.hours);
    const allocationProgress = allocation.hours > 0 ? Math.min(100, (actualHours / allocation.hours) * 100) : 0;

    const lastJobClockOut = getLatest(userClockings.filter((clocking) => clocking.clock_out), "clock_out")?.clock_out || null;
    const waitingStartCandidates = [activeTimeRecord?.clock_in, lastJobClockOut]
      .map(asTime)
      .filter((value) => value !== null);
    const waitingSinceMs = waitingStartCandidates.length ? Math.max(...waitingStartCandidates) : null;
    const idleHours = status === CLOCKING_STATUSES.WAITING && waitingSinceMs !== null
      ? roundHours(Math.max(0, nowMs - waitingSinceMs) / 3600000)
      : 0;

    const assignedQueue = jobs
      .filter((job) => String(job.assigned_to) === userKey)
      .filter((job) => String(job.status || "").trim().toUpperCase() === ACTIVE_JOB_STATUS)
      .filter((job) => !activeClocking || String(job.id) !== String(activeClocking.job_id))
      .sort(compareQueueJobs);
    const nextJob = assignedQueue[0] || null;
    const nextAppointment = getAppointment(nextJob);
    const nextAllocation = nextJob ? getAllocatedHours(nextJob, null).hours : 0;
    const nextRequest = Array.isArray(nextJob?.job_requests)
      ? [...nextJob.job_requests].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))[0]
      : null;
    const nextJobView = nextJob ? {
      id: nextJob.id,
      jobNumber: nextJob.job_number,
      description: jobDescription(nextJob, nextRequest),
      descriptions: jobDescriptions(nextJob, nextRequest),
      type: nextRequest?.job_type || nextJob.type || "Service",
      plannedHours: nextAllocation,
      scheduledTime: nextAppointment?.scheduled_time || null,
      queuePosition: nextJob.queue_position,
    } : null;

    return {
      userId: user.user_id,
      name: [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email || `Technician ${user.user_id}`,
      role: user.role || "Technician",
      avatarUrl: user.photo_url || "",
      isMotRole: workshopAssignment === WORKSHOP_ASSIGNMENT_TYPES.MOT,
      workshopAssignment,
      defaultWorkshopAssignment,
      slug: generateTechnicianSlug(user.first_name, user.last_name, user.user_id) || String(user.user_id),
      status,
      hasClockedToday,
      currentJobId: currentJob?.id || activeClocking?.job_id || null,
      currentJobNumber: activeClocking?.job_number || currentJob?.job_number || null,
      currentDescription: activeClocking ? jobDescription(currentJob, allocation.request) : null,
      currentDescriptions: activeClocking ? jobDescriptions(currentJob, allocation.request) : [],
      clockingId: activeClocking?.id || null,
      activityStartedAt: activeClocking?.clock_in || activeTimeRecord?.clock_in || null,
      activityHours: activeClocking ? durationHours(activeClocking.clock_in, null, nowMs) : activeTimeRecord ? durationHours(activeTimeRecord.clock_in, null, nowMs) : 0,
      actualHours,
      allocatedHours: allocation.hours,
      allocationAvailable: allocation.available,
      differenceHours,
      allocationProgress: roundHours(allocationProgress),
      isOverAllocated: Boolean(activeClocking && allocation.available && actualHours > allocation.hours),
      idleHours,
      waitingSince: waitingSinceMs ? new Date(waitingSinceMs).toISOString() : null,
      breakNotes: status === CLOCKING_STATUSES.TEA_BREAK ? activeTimeRecord?.notes || "Tea break" : null,
      recordedBreakMinutes: userTimeRecords.reduce((sum, record) => sum + (Number(record.break_minutes) || 0), 0),
      nextJob: nextJobView,
      dueQueuedJob: assignedQueue.find((job) => {
        const scheduled = asTime(getAppointment(job)?.scheduled_time);
        return scheduled !== null && scheduled <= nowMs;
      }) || null,
      workshopOrder: nextJobView?.queuePosition ?? Number.MAX_SAFE_INTEGER,
    };
  });

  return {
    technicians: rows,
    summary: {
      total: rows.length,
      inProgress: rows.filter((row) => row.status === CLOCKING_STATUSES.IN_PROGRESS).length,
      onMot: rows.filter((row) => row.status === CLOCKING_STATUSES.ON_MOT).length,
      teaBreak: rows.filter((row) => row.status === CLOCKING_STATUSES.TEA_BREAK).length,
      waiting: rows.filter((row) => row.status === CLOCKING_STATUSES.WAITING).length,
      notClocked: rows.filter((row) => row.status === CLOCKING_STATUSES.NOT_CLOCKED).length,
      working: rows.filter((row) => row.status !== CLOCKING_STATUSES.NOT_CLOCKED).length,
    },
    activity: buildWorkshopActivity({ users, timeRecords, jobClockings }, now),
    performance: buildWorkshopPerformance({ timeRecords, jobClockings }, now),
  };
}

export function buildWorkshopActivity({ users = [], timeRecords = [], jobClockings = [] }, now = new Date()) {
  const userNames = new Map(users.map((user) => [String(user.user_id), [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email || `Technician ${user.user_id}`]));
  const events = [];

  jobClockings.forEach((clocking) => {
    const name = userNames.get(String(clocking.user_id)) || "Technician";
    if (clocking.clock_in) events.push({
      id: `job-in-${clocking.id}`,
      at: clocking.clock_in,
      type: "job-in",
      message: `${name} clocked onto ${clocking.job_number || "a job"}`,
      jobNumber: clocking.job_number || null,
    });
    if (clocking.clock_out) events.push({
      id: `job-out-${clocking.id}`,
      at: clocking.clock_out,
      type: "job-out",
      message: `${name} clocked off ${clocking.job_number || "a job"}`,
      jobNumber: clocking.job_number || null,
    });
  });

  timeRecords.forEach((record) => {
    const name = userNames.get(String(record.user_id)) || "Technician";
    if (isBreakRecord(record)) {
      events.push({ id: `break-in-${record.id}`, at: record.clock_in, type: "break-in", message: `${name} entered break` });
      if (record.clock_out) events.push({ id: `break-out-${record.id}`, at: record.clock_out, type: "break-out", message: `${name} returned from break` });
    } else if (record.clock_in && !record.job_number) {
      events.push({ id: `waiting-${record.id}`, at: record.clock_in, type: "waiting", message: `${name} moved to waiting` });
    }
  });

  const nowMs = now.getTime();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayStartMs = dayStart.getTime();
  return events
    .filter((event) => {
      const eventMs = asTime(event.at);
      return eventMs !== null && eventMs >= dayStartMs && eventMs <= nowMs;
    })
    .sort((a, b) => (asTime(b.at) || 0) - (asTime(a.at) || 0))
    .slice(0, 12);
}

export function buildWorkshopPerformance({ timeRecords = [], jobClockings = [] }, now = new Date()) {
  const nowMs = now.getTime();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayStartMs = dayStart.getTime();
  const productiveHours = jobClockings.reduce(
    (sum, row) => {
      const clockIn = asTime(row.clock_in);
      const clockOut = row.clock_out ? asTime(row.clock_out) : nowMs;
      if (clockIn === null || clockOut === null) return sum;
      return sum + Math.max(0, clockOut - Math.max(clockIn, dayStartMs)) / 3600000;
    },
    0
  );
  const attendedHours = timeRecords.reduce((sum, row) => {
    const persisted = Number(row.hours_worked);
    return sum + (row.clock_out && Number.isFinite(persisted)
      ? Math.max(0, persisted)
      : durationHours(row.clock_in, row.clock_out, nowMs));
  }, 0);
  const breakHoursFromRecords = timeRecords
    .filter(isBreakRecord)
    .reduce((sum, row) => sum + durationHours(row.clock_in, row.clock_out, nowMs), 0);
  const recordedBreakHours = timeRecords.reduce((sum, row) => sum + (Number(row.break_minutes) || 0) / 60, 0);
  const breakHours = Math.max(breakHoursFromRecords, recordedBreakHours);
  return {
    productiveHours: roundHours(productiveHours),
    attendedHours: roundHours(attendedHours),
    breakHours: roundHours(breakHours),
    idleHours: roundHours(Math.max(0, attendedHours - productiveHours - breakHours)),
  };
}

export function buildCapacitySummary(board, capacityDay) {
  const capacityHours = Math.max(0, Number(capacityDay?.totalHours) || 0);
  const productiveHours = Math.max(0, Number(board?.performance?.productiveHours) || 0);
  return {
    working: board?.summary?.working || 0,
    total: board?.summary?.total || 0,
    productiveHours: roundHours(productiveHours),
    capacityHours: roundHours(capacityHours),
    remainingHours: roundHours(Math.max(0, capacityHours - productiveHours)),
    utilisationPct: capacityHours > 0 ? roundHours((productiveHours / capacityHours) * 100) : 0,
  };
}

export function buildWorkshopAttention(technicians, capacityDay, waitingThresholdMinutes = DEFAULT_WAITING_THRESHOLD_MINUTES) {
  const expectedByUser = new Map((capacityDay?.technicians || []).map((technician) => [String(technician.userId), technician]));
  const thresholdHours = Math.max(0, Number(waitingThresholdMinutes) || 0) / 60;
  const attention = [];

  technicians.forEach((technician) => {
    const expected = expectedByUser.get(String(technician.userId));
    if (technician.status === CLOCKING_STATUSES.WAITING && technician.idleHours >= thresholdHours) {
      attention.push({
        id: `waiting-${technician.userId}`,
        tone: "warning",
        technician,
        title: `${technician.name} has been waiting ${technician.idleHours.toFixed(2)}h`,
        detail: `Waiting threshold is ${waitingThresholdMinutes} minutes.`,
      });
    }
    if (technician.isOverAllocated) {
      attention.push({
        id: `allocation-${technician.userId}-${technician.currentJobId}`,
        tone: "danger",
        technician,
        title: `${technician.currentJobNumber || "Active job"} is ${technician.differenceHours.toFixed(2)}h over allocation`,
        detail: `${technician.name} has clocked ${technician.actualHours.toFixed(2)}h against ${technician.allocatedHours.toFixed(2)}h.`,
      });
    }
    if (expected && Number(expected.effectiveHours) > 0 && !technician.hasClockedToday) {
      attention.push({
        id: `not-clocked-${technician.userId}`,
        tone: "danger",
        technician,
        title: `${technician.name} is expected today but not clocked in`,
        detail: `${Number(expected.effectiveHours).toFixed(2)} workshop hours are scheduled.`,
      });
    }
    if (!technician.currentJobId && technician.dueQueuedJob) {
      attention.push({
        id: `due-${technician.userId}-${technician.dueQueuedJob.id}`,
        tone: "warning",
        technician,
        title: `${technician.dueQueuedJob.job_number || "Queued job"} is due to have started`,
        detail: `${technician.name} is not clocked onto the job and its scheduled start has passed.`,
      });
    }
  });

  return attention;
}
