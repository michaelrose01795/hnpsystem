// file location: src/lib/status/statusFlow.js
// Legacy compatibility layer for job statuses and timeline events.

import { normalizeStatusId as normalizeCatalogStatusId } from "@/lib/status/catalog/utils";
import {
  STATUSES as JOB_STATUSES,
  DISPLAY as JOB_DISPLAY,
  NORMALIZE as NORMALIZE_JOB,
} from "@/lib/status/catalog/job";
import {
  STATUSES as TIMELINE_STATUSES,
  DISPLAY as TIMELINE_DISPLAY,
  NORMALIZE as NORMALIZE_TIMELINE,
} from "@/lib/status/catalog/timeline";

export const MAIN_STATUS_ORDER = [
  JOB_STATUSES.BOOKED,
  JOB_STATUSES.CHECKED_IN,
  JOB_STATUSES.IN_PROGRESS,
  JOB_STATUSES.INVOICED,
  JOB_STATUSES.COMPLETE,
];

export const SERVICE_STATUS_FLOW = {
  BOOKED: {
    id: JOB_STATUSES.BOOKED,
    label: JOB_DISPLAY[JOB_STATUSES.BOOKED],
    color: "var(--info)",
    next: [JOB_STATUSES.CHECKED_IN, JOB_STATUSES.IN_PROGRESS],
    department: "Service Reception",
    canClockOn: false,
    pausesTime: true,
  },

  CHECKED_IN: {
    id: JOB_STATUSES.CHECKED_IN,
    label: JOB_DISPLAY[JOB_STATUSES.CHECKED_IN],
    color: "var(--accent-purple)",
    next: [JOB_STATUSES.IN_PROGRESS],
    department: "Service Reception",
    canClockOn: false,
    pausesTime: true,
  },

  IN_PROGRESS: {
    id: JOB_STATUSES.IN_PROGRESS,
    label: JOB_DISPLAY[JOB_STATUSES.IN_PROGRESS],
    color: "var(--info)",
    next: [JOB_STATUSES.INVOICED],
    department: "Workshop",
    canClockOn: true,
    pausesTime: false,
    autoSetOnClockOn: true,
  },

  INVOICED: {
    id: JOB_STATUSES.INVOICED,
    label: JOB_DISPLAY[JOB_STATUSES.INVOICED],
    color: "var(--info)",
    next: [JOB_STATUSES.COMPLETE],
    department: "Accounts",
    canClockOn: false,
    pausesTime: true,
  },

  COMPLETE: {
    id: JOB_STATUSES.COMPLETE,
    label: JOB_DISPLAY[JOB_STATUSES.COMPLETE],
    color: "var(--success)",
    next: null,
    department: "Accounts",
    canClockOn: false,
    pausesTime: true,
    isFinalStatus: true,
  },
};

export const JOB_SUB_STATUS_FLOW = {
  TECHNICIAN_STARTED: {
    id: TIMELINE_STATUSES.TECHNICIAN_STARTED,
    label: TIMELINE_DISPLAY[TIMELINE_STATUSES.TECHNICIAN_STARTED],
    color: "var(--info)",
    department: "Workshop",
    category: "Workshop",
  },
  TECHNICIAN_WORK_COMPLETED: {
    id: TIMELINE_STATUSES.TECHNICIAN_WORK_COMPLETED,
    label: TIMELINE_DISPLAY[TIMELINE_STATUSES.TECHNICIAN_WORK_COMPLETED],
    color: "var(--success)",
    department: "Workshop",
    category: "Workshop",
  },
  VHC_STARTED: {
    id: TIMELINE_STATUSES.VHC_STARTED,
    label: TIMELINE_DISPLAY[TIMELINE_STATUSES.VHC_STARTED],
    color: "var(--accent-purple)",
    department: "VHC",
    category: "VHC",
  },
  VHC_REOPENED: {
    id: TIMELINE_STATUSES.VHC_REOPENED,
    label: TIMELINE_DISPLAY[TIMELINE_STATUSES.VHC_REOPENED],
    color: "var(--warning)",
    department: "VHC",
    category: "VHC",
  },
  VHC_COMPLETED: {
    id: TIMELINE_STATUSES.VHC_COMPLETED,
    label: TIMELINE_DISPLAY[TIMELINE_STATUSES.VHC_COMPLETED],
    color: "var(--success)",
    department: "VHC",
    category: "VHC",
  },
  WAITING_FOR_PRICING: {
    id: TIMELINE_STATUSES.WAITING_FOR_PRICING,
    label: TIMELINE_DISPLAY[TIMELINE_STATUSES.WAITING_FOR_PRICING],
    color: "var(--warning)",
    department: "VHC",
    category: "VHC",
  },
  PRICING_COMPLETED: {
    id: TIMELINE_STATUSES.PRICING_COMPLETED,
    label: TIMELINE_DISPLAY[TIMELINE_STATUSES.PRICING_COMPLETED],
    color: "var(--info)",
    department: "VHC",
    category: "VHC",
  },
  SENT_TO_CUSTOMER: {
    id: TIMELINE_STATUSES.SENT_TO_CUSTOMER,
    label: TIMELINE_DISPLAY[TIMELINE_STATUSES.SENT_TO_CUSTOMER],
    color: "var(--info)",
    department: "VHC",
    category: "VHC",
  },
  CUSTOMER_AUTHORISED: {
    id: TIMELINE_STATUSES.CUSTOMER_AUTHORISED,
    label: TIMELINE_DISPLAY[TIMELINE_STATUSES.CUSTOMER_AUTHORISED],
    color: "var(--success)",
    department: "VHC",
    category: "VHC",
  },
  CUSTOMER_DECLINED: {
    id: TIMELINE_STATUSES.CUSTOMER_DECLINED,
    label: TIMELINE_DISPLAY[TIMELINE_STATUSES.CUSTOMER_DECLINED],
    color: "var(--danger)",
    department: "VHC",
    category: "VHC",
  },
  WAITING_FOR_PARTS: {
    id: TIMELINE_STATUSES.WAITING_FOR_PARTS,
    label: TIMELINE_DISPLAY[TIMELINE_STATUSES.WAITING_FOR_PARTS],
    color: "var(--danger)",
    department: "Parts",
    category: "Parts",
  },
  PARTS_READY: {
    id: TIMELINE_STATUSES.PARTS_READY,
    label: TIMELINE_DISPLAY[TIMELINE_STATUSES.PARTS_READY],
    color: "var(--success)",
    department: "Parts",
    category: "Parts",
  },
  READY_FOR_INVOICE: {
    id: TIMELINE_STATUSES.READY_FOR_INVOICE,
    label: TIMELINE_DISPLAY[TIMELINE_STATUSES.READY_FOR_INVOICE],
    color: "var(--accent-orange)",
    department: "Admin",
    category: "Admin",
  },
};

export const normalizeStatusId = (status) => normalizeCatalogStatusId(status);

export const resolveMainStatusId = (status) => NORMALIZE_JOB(status);

export const resolveSubStatusId = (status) => NORMALIZE_TIMELINE(status);

export const getMainStatusMetadata = (status) => {
  const mainId = resolveMainStatusId(status);
  if (!mainId) return null;
  return SERVICE_STATUS_FLOW[mainId.toUpperCase()] || null;
};

export const getSubStatusMetadata = (status) => {
  const subId = resolveSubStatusId(status);
  if (!subId) return null;
  return JOB_SUB_STATUS_FLOW[subId.toUpperCase()] || null;
};

export const getStatusConfig = (status) => {
  const mainMeta = getMainStatusMetadata(status);
  if (mainMeta) {
    return { ...mainMeta, kind: "status", isSubStatus: false };
  }
  const subMeta = getSubStatusMetadata(status);
  if (subMeta) {
    return { ...subMeta, kind: "event", isSubStatus: true };
  }
  return null;
};

// Helper function to get next possible statuses
export const getNextStatuses = (currentStatusId) => {
  const currentId = resolveMainStatusId(currentStatusId);
  if (!currentId) return [];
  const currentStatus = SERVICE_STATUS_FLOW[currentId.toUpperCase()];
  if (!currentStatus || !currentStatus.next) return [];

  return currentStatus.next.map((nextId) =>
    SERVICE_STATUS_FLOW[nextId.toUpperCase()]
  );
};

// Helper function to check if status transition is valid
export const isValidTransition = (fromStatusId, toStatusId) => {
  const fromId = resolveMainStatusId(fromStatusId);
  const toId = resolveMainStatusId(toStatusId);
  if (!fromId || !toId) return false;
  if (fromId === toId) return true;

  const fromStatus = SERVICE_STATUS_FLOW[fromId.toUpperCase()];
  if (!fromStatus || !fromStatus.next) return false;

  return fromStatus.next.includes(toId.toLowerCase());
};

// Helper function to check if time should be paused
export const shouldPauseTime = (statusId) => {
  const mainId = resolveMainStatusId(statusId);
  if (!mainId) return true;
  const status = SERVICE_STATUS_FLOW[mainId.toUpperCase()];
  return status ? status.pausesTime : true;
};

// Get all main statuses as array for timeline display
export const getStatusTimeline = () => {
  return MAIN_STATUS_ORDER.map((statusId) =>
    SERVICE_STATUS_FLOW[statusId.toUpperCase()]
  );
};
