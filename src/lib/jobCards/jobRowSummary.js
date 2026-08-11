import { getJobRequests } from "@/lib/canonical/fields";
import { getVhcSummary } from "@/features/vhc/vhcStatusEngine";
import {
  getCustomerRequestEffectiveStatus,
  getCustomerRequestWorkflowStatus,
  getWriteUpChecklistTasks,
  getWriteUpCompletionState,
  isCustomerRequestCompleteInWriteUp,
} from "@/features/jobCards/workflow/selectors";
import { summarizePartsPipeline } from "@/lib/parts/pipeline";
import { isNextJobsTechnicianPanelJob } from "@/lib/jobCards/utils";

const TERMINAL_STATUS_WORDS = ["complete", "completed", "collected", "released", "invoiced", "cancelled"];
const HOUR_MS = 60 * 60 * 1000;

const asDate = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isTerminalJob = (job) => {
  const status = String(job?.status || "").trim().toLowerCase();
  return TERMINAL_STATUS_WORDS.includes(status);
};

export const formatOperationalDuration = (from, to = new Date()) => {
  const start = asDate(from);
  const end = asDate(to);
  if (!start || !end || end < start) return "";

  const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
  if (totalMinutes < 1) return "Just now";
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
};

export const formatOperationalAge = (from, to = new Date()) => {
  const start = asDate(from);
  const end = asDate(to);
  if (!start || !end || end < start) return "";

  const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
  if (totalMinutes < 1) return "Just now";

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return [
    days ? `${days}d` : "",
    hours ? `${hours}h` : "",
    minutes ? `${minutes}m` : "",
  ].filter(Boolean).join(" ");
};

export const getJobBookedHours = (job) => getJobRequests(job).reduce((total, request) => {
  const hours = Number(request?.hours ?? request?.time);
  return total + (Number.isFinite(hours) && hours > 0 ? hours : 0);
}, 0);

const normalizeTechnicianName = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

export const findNextJobsTechnician = (job, technicians = []) => {
  if (!isNextJobsTechnicianPanelJob(job)) return null;
  const assignedId = job?.assignedTech?.id ?? job?.assignedTo;
  const assignedName = normalizeTechnicianName(
    job?.assignedTech?.name || job?.assignedTech?.fullName || job?.technician
  );

  return (Array.isArray(technicians) ? technicians : []).find((technician) => {
    const technicianId = technician?.id ?? technician?.user_id;
    if (assignedId !== null && assignedId !== undefined && technicianId !== null && technicianId !== undefined) {
      if (String(assignedId) === String(technicianId)) return true;
    }
    const technicianName = normalizeTechnicianName(
      technician?.name || technician?.displayName || technician?.fullName
    );
    return Boolean(assignedName && technicianName && assignedName === technicianName);
  }) || null;
};

export const buildTechnicianWorkloadMap = (jobs = [], technicians = []) => {
  return (Array.isArray(jobs) ? jobs : []).reduce((workloads, job) => {
    if (!isNextJobsTechnicianPanelJob(job)) return workloads;
    const technician = findNextJobsTechnician(job, technicians);
    const technicianId = technician?.id ?? technician?.user_id;
    if (technicianId === null || technicianId === undefined) return workloads;
    const key = String(technicianId);
    const workload = workloads[key] || { activeJobs: 0, bookedHours: 0 };
    workload.activeJobs += 1;
    workload.bookedHours += getJobBookedHours(job);
    workloads[key] = workload;
    return workloads;
  }, {});
};

const includesStatusPhrase = (job, phrases) => {
  const status = String(job?.rawStatus || job?.status || "").trim().toLowerCase().replace(/[_-]+/g, " ");
  return phrases.some((phrase) => status.includes(phrase));
};

export const buildJobOperationalStatusCounts = (jobs = [], { now = new Date() } = {}) => {
  const reference = asDate(now) || new Date();
  const counts = {
    arrived: 0,
    waiting: 0,
    inWorkshop: 0,
    awaitingParts: 0,
    awaitingAuthorisation: 0,
    ready: 0,
    overdue: 0,
    carryOvers: 0,
  };

  (Array.isArray(jobs) ? jobs : []).forEach((job) => {
    if (isTerminalJob(job)) return;
    const checkedIn = Boolean(job?.checkedInAt) || includesStatusPhrase(job, ["checked in", "customer arrived"]);
    const inWorkshop = Boolean(job?.workshopStartedAt || job?.clockingStartedAt || job?.hasClockingActivity) || includesStatusPhrase(job, ["in progress", "technician started", "additional work being carried out"]);
    const waiting = checkedIn && !inWorkshop;
    const parts = getPartsOperationalStatus(job);
    const vhc = getVhcOperationalStatus(job);
    const jobDate = getAppointmentDate(job) || asDate(job?.createdAt);

    if (checkedIn) counts.arrived += 1;
    if (waiting || String(job?.waitingStatus || "").trim().toLowerCase().includes("wait")) counts.waiting += 1;
    if (inWorkshop) counts.inWorkshop += 1;
    if (parts?.tone === "warning" || includesStatusPhrase(job, ["waiting for parts", "parts on order"])) counts.awaitingParts += 1;
    if (vhc?.label === "VHC awaiting customer" || includesStatusPhrase(job, ["awaiting authorisation", "awaiting authorization", "additional work required", "sent to customer"])) counts.awaitingAuthorisation += 1;
    if (includesStatusPhrase(job, ["ready for", "work complete", "technician work completed", "tech complete", "valet complete", "parts arrived"])) counts.ready += 1;
    if (getAttentionSignals(job, reference).some((signal) => signal.tone === "danger")) counts.overdue += 1;
    if (jobDate && jobDate < reference && jobDate.toDateString() !== reference.toDateString()) counts.carryOvers += 1;
  });

  return counts;
};

const formatClock = (value) => {
  const date = asDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

const formatDateTime = (value, now = new Date()) => {
  const date = asDate(value);
  if (!date) return "";
  const reference = asDate(now) || new Date();
  const sameDay = date.toDateString() === reference.toDateString();
  if (sameDay) return formatClock(date);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

const formatStoredStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "_");
  if (normalized === "inprogress") return "In Progress";
  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const getAppointmentDate = (job) => {
  const date = job?.appointment?.date;
  if (!date) return null;
  const time = job?.appointment?.time || "00:00";
  return asDate(`${date}T${time}:00`);
};

const getBookedWorkDueDate = (job) => {
  const appointmentAt = getAppointmentDate(job);
  if (!appointmentAt) return null;
  return new Date(appointmentAt.getTime() + getJobBookedHours(job) * HOUR_MS);
};

const getPresenceLabel = (job, now) => {
  const workshopStartedAt = job?.workshopStartedAt || job?.clockingStartedAt;
  if (workshopStartedAt && !isTerminalJob(job)) {
    const duration = formatOperationalDuration(workshopStartedAt, now);
    return duration ? `In workshop ${duration}` : "";
  }
  if (job?.checkedInAt && !isTerminalJob(job)) {
    const duration = formatOperationalDuration(job.checkedInAt, now);
    return duration ? `Waiting ${duration}` : "";
  }

  return "";
};

const getScheduleTiming = (job, now) => {
  if (isTerminalJob(job)) return { label: "", state: "" };

  const appointmentAt = getAppointmentDate(job);
  const dueAt = getBookedWorkDueDate(job);
  const reference = asDate(now) || new Date();
  if (!appointmentAt || !dueAt) return { label: "", state: "" };

  const target = reference < appointmentAt ? appointmentAt : dueAt;
  if (target.getTime() === reference.getTime()) return { label: "Due now", state: "due" };

  if (target > reference) {
    const duration = formatOperationalDuration(reference, target);
    return duration ? { label: `Due +${duration}`, state: "due" } : { label: "Due now", state: "due" };
  }

  const duration = formatOperationalDuration(target, reference);
  return duration
    ? { label: `Overdue -${duration}`, state: "overdue" }
    : { label: "Due now", state: "due" };
};

const getVhcOperationalStatus = (job) => {
  if (!job?.vhcRequired) {
    return { label: "No VHC", tone: "neutral", detail: "" };
  }
  if (job?.vhcCompletedAt) {
    return { label: "VHC complete", tone: "success", detail: "" };
  }

  const checks = Array.isArray(job?.vhcChecks) ? job.vhcChecks : [];
  if (checks.length === 0) {
    return { label: "VHC pending", tone: "warning", detail: "" };
  }

  const summary = getVhcSummary(checks, {
    partsJobItems: job?.partsAllocations || [],
    job,
  });
  const { byCondition, byWorkflow } = summary.counts;
  const detail = [
    byCondition.red ? `${byCondition.red} red` : "",
    byCondition.amber ? `${byCondition.amber} amber` : "",
  ].filter(Boolean).join(" · ");

  if (byWorkflow.awaiting_customer > 0) {
    return { label: "VHC awaiting customer", tone: "warning", detail };
  }
  if (byWorkflow.in_progress > 0 || byWorkflow.approved > 0) {
    return { label: "VHC in progress", tone: "accent", detail };
  }
  if (byWorkflow.completed === summary.counts.total) {
    return { label: "VHC complete", tone: "success", detail };
  }
  return { label: "VHC recorded", tone: detail ? "warning" : "neutral", detail };
};

const getPartsOperationalStatus = (job) => {
  const source = [
    ...(Array.isArray(job?.partsAllocations) ? job.partsAllocations : []),
    ...(Array.isArray(job?.partsRequests) ? job.partsRequests : []),
  ];
  if (source.length === 0) return { label: "No parts status", tone: "neutral", detail: "" };

  const activeParts = source.filter((part) => !["cancelled", "canceled", "removed"].includes(String(part?.status || "").trim().toLowerCase()));
  if (activeParts.length === 0) return { label: "No parts status", tone: "neutral", detail: "" };
  const pipelineParts = activeParts.map((part) => {
    const rawStatus = String(part?.status || "").trim().toLowerCase();
    const status = ({
      fulfilled: "stock",
      reserved: "pre_picked",
      loaded: "picked",
      booked: "pending",
      priced: "pending",
      unavailable: "awaiting_stock",
    })[rawStatus] || rawStatus;
    return { ...part, status };
  });
  const pipeline = summarizePartsPipeline(pipelineParts);
  const stageCounts = pipeline.stageMap;
  const detail = `${activeParts.length} item${activeParts.length === 1 ? "" : "s"}`;
  if (stageCounts.on_order?.count > 0) {
    return { label: "Parts on order", tone: "warning", detail };
  }
  if ((stageCounts.waiting_authorisation?.count || 0) + (stageCounts.waiting_to_order?.count || 0) > 0) {
    return { label: "Parts pending", tone: "warning", detail };
  }
  if (stageCounts.pre_picked?.count > 0) {
    return { label: "Parts preparing", tone: "accent", detail };
  }
  return { label: "Parts available", tone: "success", detail };
};

const getAttentionSignals = (job, now) => {
  if (isTerminalJob(job)) return [];
  const reference = asDate(now) || new Date();
  const signals = [];
  const promisedAt = asDate(job?.bookingRequest?.estimatedCompletion);
  const nextUpdateAt = asDate(job?.nextUpdateDue);
  const appointmentAt = getAppointmentDate(job);

  if (promisedAt && promisedAt < reference) {
    signals.push({ label: "Collection overdue", tone: "danger" });
  } else if (promisedAt && promisedAt.getTime() - reference.getTime() <= HOUR_MS) {
    signals.push({ label: "Collection at risk", tone: "warning" });
  }
  if (nextUpdateAt && nextUpdateAt < reference) {
    signals.push({ label: "Customer update overdue", tone: "danger" });
  }
  if (appointmentAt && appointmentAt.toDateString() !== reference.toDateString() && appointmentAt < reference) {
    signals.push({ label: "Carry over", tone: "warning" });
  }
  if (job?.checkedInAt && !job?.assignedTech && !job?.assignedTo) {
    signals.push({ label: "Technician needed", tone: "warning" });
  }
  return signals;
};

export const buildJobRowSummary = (job, { now = new Date(), technicianLoad = null } = {}) => {
  const checklistTasks = getWriteUpChecklistTasks(job?.writeUp?.task_checklist ?? job?.writeUp?.taskChecklist);
  const customerRequests = getJobRequests(job)
    .filter((request) => String(request?.requestSource ?? request?.request_source ?? "customer_request").trim().toLowerCase() === "customer_request");
  const writeUpCompletion = getWriteUpCompletionState({
    completionStatus: job?.writeUp?.completion_status ?? job?.writeUp?.completionStatus ?? job?.completionStatus,
    checklistTasks,
    requestRows: customerRequests,
  });
  const requestWorkflowStatus = getCustomerRequestWorkflowStatus({
    jobStatus: job?.status,
    writeUpComplete: writeUpCompletion.isCompleteInstant,
  });
  const requests = customerRequests
    .map((request, index) => ({
      text: String(request?.description || request?.text || request || "").trim(),
      hours: Number(request?.hours ?? request?.time),
      status: formatStoredStatus(getCustomerRequestEffectiveStatus({
        requestStatus: request?.status,
        completedInWriteUp: isCustomerRequestCompleteInWriteUp({
          request,
          requestIndex: index,
          checklistTasks,
        }),
        workflowStatus: requestWorkflowStatus,
      })),
    }))
    .filter((request) => request.text);
  const appointmentAt = getAppointmentDate(job);
  const statusDuration = formatOperationalAge(job?.statusUpdatedAt, now);
  const promisedAt = job?.bookingRequest?.estimatedCompletion;
  const signals = getAttentionSignals(job, now);
  const promisedSignal = signals.find((signal) => signal.label === "Collection overdue" || signal.label === "Collection at risk");
  const scheduleTiming = getScheduleTiming(job, now);

  return {
    statusLabel: job?.status || "",
    appointmentTime: appointmentAt ? formatClock(appointmentAt) : "",
    appointmentDate: appointmentAt
      ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short" }).format(appointmentAt)
      : "",
    scheduleLabel: scheduleTiming.label,
    scheduleState: scheduleTiming.state,
    presenceLabel: getPresenceLabel(job, now),
    statusDuration: statusDuration ? `${statusDuration} since last update` : "",
    promisedLabel: promisedAt ? formatDateTime(promisedAt, now) : "",
    promisedState: promisedAt && !isTerminalJob(job)
      ? promisedSignal
        ? { label: promisedSignal.label === "Collection overdue" ? "Late" : "At risk", tone: promisedSignal.tone }
        : { label: "On track", tone: "success" }
      : null,
    requests,
    vhc: getVhcOperationalStatus(job),
    parts: getPartsOperationalStatus(job),
    signals,
    technicianLoad: technicianLoad
      ? [
          Number.isFinite(technicianLoad.activeJobs) ? `${technicianLoad.activeJobs} active job${technicianLoad.activeJobs === 1 ? "" : "s"}` : "",
          Number.isFinite(technicianLoad.bookedHours) && technicianLoad.bookedHours > 0
            ? `${Math.round(technicianLoad.bookedHours * 10) / 10}h booked`
            : "",
        ].filter(Boolean).join(" · ")
      : "",
  };
};
