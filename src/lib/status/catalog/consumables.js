// Consumables status catalog for tracker labels and request statuses.
import { normalizeStatusId } from "./utils";

export const DOMAIN = "consumables";

export const STATUSES = {
  TRACKER_OVERDUE: "overdue",
  TRACKER_COMING_UP: "coming_up",
  TRACKER_NOT_REQUIRED: "not_required",
  REQUEST_PENDING: "pending",
  REQUEST_URGENT: "urgent",
  REQUEST_ORDERED: "ordered",
  REQUEST_REJECTED: "rejected",
};

export const DISPLAY = {
  [STATUSES.TRACKER_OVERDUE]: "Overdue",
  [STATUSES.TRACKER_COMING_UP]: "Coming Up",
  [STATUSES.TRACKER_NOT_REQUIRED]: "Not Required",
  [STATUSES.REQUEST_PENDING]: "Pending",
  [STATUSES.REQUEST_URGENT]: "Urgent",
  [STATUSES.REQUEST_ORDERED]: "Ordered",
  [STATUSES.REQUEST_REJECTED]: "Rejected",
};

const ALIASES = {
  overdue: STATUSES.TRACKER_OVERDUE,
  coming_up: STATUSES.TRACKER_COMING_UP,
  comingup: STATUSES.TRACKER_COMING_UP,
  not_required: STATUSES.TRACKER_NOT_REQUIRED,
  pending: STATUSES.REQUEST_PENDING,
  urgent: STATUSES.REQUEST_URGENT,
  ordered: STATUSES.REQUEST_ORDERED,
  rejected: STATUSES.REQUEST_REJECTED,
};

export const NORMALIZE = (value) => {
  const normalized = normalizeStatusId(value);
  if (!normalized) return null;
  return ALIASES[normalized] || null;
};
