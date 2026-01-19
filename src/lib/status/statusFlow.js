// file location: src/lib/status/statusFlow.js
// This file defines main job statuses (stored on jobs) and sub-statuses (timeline only).

export const MAIN_STATUS_ORDER = [
  "booked",
  "checked_in",
  "in_progress",
  "invoiced",
  "complete",
];

export const SERVICE_STATUS_FLOW = {
  BOOKED: {
    id: "booked",
    label: "Booked",
    color: "var(--info)",
    next: ["checked_in", "in_progress"],
    department: "Service Reception",
    canClockOn: false,
    pausesTime: true,
  },

  CHECKED_IN: {
    id: "checked_in",
    label: "Checked In",
    color: "var(--accent-purple)",
    next: ["in_progress"],
    department: "Service Reception",
    canClockOn: false,
    pausesTime: true,
  },

  IN_PROGRESS: {
    id: "in_progress",
    label: "In Progress",
    color: "var(--info)",
    next: ["invoiced"],
    department: "Workshop",
    canClockOn: true,
    pausesTime: false,
    autoSetOnClockOn: true,
  },

  INVOICED: {
    id: "invoiced",
    label: "Invoiced",
    color: "var(--info)",
    next: ["complete"],
    department: "Accounts",
    canClockOn: false,
    pausesTime: true,
  },

  COMPLETE: {
    id: "complete",
    label: "Complete",
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
    id: "technician_started",
    label: "Technician Started",
    color: "var(--info)",
    department: "Workshop",
    category: "Workshop",
  },
  TECHNICIAN_WORK_COMPLETED: {
    id: "technician_work_completed",
    label: "Technician Work Completed",
    color: "var(--success)",
    department: "Workshop",
    category: "Workshop",
  },
  VHC_STARTED: {
    id: "vhc_started",
    label: "VHC Started",
    color: "var(--accent-purple)",
    department: "VHC",
    category: "VHC",
  },
  VHC_REOPENED: {
    id: "vhc_reopened",
    label: "VHC Reopened",
    color: "var(--warning)",
    department: "VHC",
    category: "VHC",
  },
  VHC_COMPLETED: {
    id: "vhc_completed",
    label: "VHC Completed",
    color: "var(--success)",
    department: "VHC",
    category: "VHC",
  },
  WAITING_FOR_PRICING: {
    id: "waiting_for_pricing",
    label: "Waiting for Pricing",
    color: "var(--warning)",
    department: "VHC",
    category: "VHC",
  },
  PRICING_COMPLETED: {
    id: "pricing_completed",
    label: "Pricing Completed",
    color: "var(--info)",
    department: "VHC",
    category: "VHC",
  },
  SENT_TO_CUSTOMER: {
    id: "sent_to_customer",
    label: "Sent to Customer",
    color: "var(--info)",
    department: "VHC",
    category: "VHC",
  },
  CUSTOMER_AUTHORISED: {
    id: "customer_authorised",
    label: "Customer Authorised",
    color: "var(--success)",
    department: "VHC",
    category: "VHC",
  },
  CUSTOMER_DECLINED: {
    id: "customer_declined",
    label: "Customer Declined",
    color: "var(--danger)",
    department: "VHC",
    category: "VHC",
  },
  WAITING_FOR_PARTS: {
    id: "waiting_for_parts",
    label: "Waiting for Parts",
    color: "var(--danger)",
    department: "Parts",
    category: "Parts",
  },
  PARTS_READY: {
    id: "parts_ready",
    label: "Parts Ready",
    color: "var(--success)",
    department: "Parts",
    category: "Parts",
  },
  READY_FOR_INVOICE: {
    id: "ready_for_invoice",
    label: "Ready for Invoice",
    color: "var(--accent-orange)",
    department: "Admin",
    category: "Admin",
  },
};

const LEGACY_STATUS_TO_MAIN_ID = {
  appointment_booked: "booked",
  customer_checkin_pending: "booked",
  customer_arrived: "checked_in",
  job_accepted: "checked_in",
  assigned_to_tech: "checked_in",
  in_progress: "in_progress",
  in_mot: "in_progress",
  waiting_for_parts: "in_progress",
  tea_break: "in_progress",
  parts_arrived: "in_progress",
  vhc_waiting: "in_progress",
  vhc_in_progress: "in_progress",
  vhc_complete: "in_progress",
  vhc_reopened: "in_progress",
  vhc_sent_to_service: "in_progress",
  waiting_for_pricing: "in_progress",
  vhc_priced: "in_progress",
  vhc_sent_to_customer: "in_progress",
  vhc_approved: "in_progress",
  vhc_declined: "in_progress",
  work_complete: "in_progress",
  ready_for_valet: "in_progress",
  being_valeted: "in_progress",
  valet_complete: "in_progress",
  ready_for_release: "in_progress",
  delivered_to_customer: "in_progress",
  invoicing: "invoiced",
  invoiced: "invoiced",
  released: "complete",
  completed: "complete",
  complete: "complete",
  collected: "complete",
  cancelled: "complete",
  workshop_mot: "in_progress",
  vhc_sent: "in_progress",
  additional_work_required: "in_progress",
  additional_work_being_carried_out: "in_progress",
  retail_parts_on_order: "in_progress",
  warranty_parts_on_order: "in_progress",
  raise_tsr: "in_progress",
  waiting_for_tsr_response: "in_progress",
  warranty_quality_control: "in_progress",
  warranty_ready_to_claim: "in_progress",
  being_washed: "in_progress",
  tech_done: "in_progress",
  tech_complete: "in_progress",
};

const LEGACY_STATUS_TO_SUB_ID = {
  workshop_mot: "technician_started",
  assigned_to_tech: "technician_started",
  in_progress: "technician_started",
  vhc_in_progress: "vhc_started",
  vhc_reopened: "vhc_reopened",
  vhc_complete: "vhc_completed",
  vhc_sent: "sent_to_customer",
  vhc_sent_to_customer: "sent_to_customer",
  waiting_for_pricing: "waiting_for_pricing",
  vhc_priced: "pricing_completed",
  vhc_approved: "customer_authorised",
  vhc_declined: "customer_declined",
  work_complete: "technician_work_completed",
  tech_done: "technician_work_completed",
  tech_complete: "technician_work_completed",
  waiting_for_parts: "waiting_for_parts",
  parts_arrived: "parts_ready",
  retail_parts_on_order: "waiting_for_parts",
  warranty_parts_on_order: "waiting_for_parts",
};

export const normalizeStatusId = (status) => {
  if (!status) return null;
  return String(status)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
};

export const resolveMainStatusId = (status) => {
  const normalized = normalizeStatusId(status);
  if (!normalized) return null;
  if (SERVICE_STATUS_FLOW[normalized.toUpperCase()]) return normalized;
  return LEGACY_STATUS_TO_MAIN_ID[normalized] || null;
};

export const resolveSubStatusId = (status) => {
  const normalized = normalizeStatusId(status);
  if (!normalized) return null;
  if (JOB_SUB_STATUS_FLOW[normalized.toUpperCase()]) return normalized;
  return LEGACY_STATUS_TO_SUB_ID[normalized] || null;
};

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
