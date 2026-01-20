// HR status catalog covering employee status, absences, and training trackers.
import { normalizeStatusId } from "./utils";

export const DOMAIN = "hr";

export const STATUSES = {
  EMPLOYEE_ACTIVE: "Active",
  EMPLOYEE_ON_LEAVE: "On leave",
  EMPLOYEE_RESIGNED: "Resigned",
  EMPLOYEE_TERMINATED: "Terminated",
  ABSENCE_PENDING: "Pending",
  ABSENCE_APPROVED: "Approved",
  OVERTIME_CLOCKED_IN: "Clocked In",
  OVERTIME_ON_TIME: "On Time",
  OVERTIME_OVERTIME: "Overtime",
  TRAINING_IN_PROGRESS: "In Progress",
  TRAINING_READY: "Ready",
  TRAINING_SCHEDULED: "Scheduled",
  TRAINING_OVERDUE: "Overdue",
  TRAINING_DUE_SOON: "Due Soon",
  TRAINING_COMPLETED: "Completed",
};

export const DISPLAY = {
  [STATUSES.EMPLOYEE_ACTIVE]: "Active",
  [STATUSES.EMPLOYEE_ON_LEAVE]: "On leave",
  [STATUSES.EMPLOYEE_RESIGNED]: "Resigned",
  [STATUSES.EMPLOYEE_TERMINATED]: "Terminated",
  [STATUSES.ABSENCE_PENDING]: "Pending",
  [STATUSES.ABSENCE_APPROVED]: "Approved",
  [STATUSES.OVERTIME_CLOCKED_IN]: "Clocked In",
  [STATUSES.OVERTIME_ON_TIME]: "On Time",
  [STATUSES.OVERTIME_OVERTIME]: "Overtime",
  [STATUSES.TRAINING_IN_PROGRESS]: "In Progress",
  [STATUSES.TRAINING_READY]: "Ready",
  [STATUSES.TRAINING_SCHEDULED]: "Scheduled",
  [STATUSES.TRAINING_OVERDUE]: "Overdue",
  [STATUSES.TRAINING_DUE_SOON]: "Due Soon",
  [STATUSES.TRAINING_COMPLETED]: "Completed",
};

const ALIASES = {
  active: STATUSES.EMPLOYEE_ACTIVE,
  on_leave: STATUSES.EMPLOYEE_ON_LEAVE,
  onleave: STATUSES.EMPLOYEE_ON_LEAVE,
  resigned: STATUSES.EMPLOYEE_RESIGNED,
  terminated: STATUSES.EMPLOYEE_TERMINATED,
  pending: STATUSES.ABSENCE_PENDING,
  approved: STATUSES.ABSENCE_APPROVED,
  clocked_in: STATUSES.OVERTIME_CLOCKED_IN,
  on_time: STATUSES.OVERTIME_ON_TIME,
  overtime: STATUSES.OVERTIME_OVERTIME,
  in_progress: STATUSES.TRAINING_IN_PROGRESS,
  ready: STATUSES.TRAINING_READY,
  scheduled: STATUSES.TRAINING_SCHEDULED,
  overdue: STATUSES.TRAINING_OVERDUE,
  due_soon: STATUSES.TRAINING_DUE_SOON,
  completed: STATUSES.TRAINING_COMPLETED,
};

export const NORMALIZE = (value) => {
  if (value === null || value === undefined) return null;
  if (Object.values(STATUSES).includes(value)) return value;
  const normalized = normalizeStatusId(value);
  if (!normalized) return null;
  return ALIASES[normalized] || null;
};
