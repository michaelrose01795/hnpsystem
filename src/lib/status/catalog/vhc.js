// VHC item status catalog (approval status + severity). Used across VHC panels and API updates.
import { normalizeStatusId } from "./utils";

export const DOMAIN = "vhc";

export const STATUSES = {
  SEVERITY_RED: "red",
  SEVERITY_AMBER: "amber",
  SEVERITY_GREEN: "green",
  SEVERITY_GREY: "grey",
  APPROVAL_PENDING: "pending",
  APPROVAL_AUTHORIZED: "authorized",
  APPROVAL_DECLINED: "declined",
  APPROVAL_COMPLETED: "completed",
  APPROVAL_NA: "n/a",
};

export const DISPLAY = {
  [STATUSES.SEVERITY_RED]: "Red",
  [STATUSES.SEVERITY_AMBER]: "Amber",
  [STATUSES.SEVERITY_GREEN]: "Green",
  [STATUSES.SEVERITY_GREY]: "Grey",
  [STATUSES.APPROVAL_PENDING]: "Pending",
  [STATUSES.APPROVAL_AUTHORIZED]: "Authorised",
  [STATUSES.APPROVAL_DECLINED]: "Declined",
  [STATUSES.APPROVAL_COMPLETED]: "Completed",
  [STATUSES.APPROVAL_NA]: "N/A",
};

const ALIASES = {
  red: STATUSES.SEVERITY_RED,
  amber: STATUSES.SEVERITY_AMBER,
  green: STATUSES.SEVERITY_GREEN,
  grey: STATUSES.SEVERITY_GREY,
  gray: STATUSES.SEVERITY_GREY,
  advisory: STATUSES.SEVERITY_AMBER,
  warning: STATUSES.SEVERITY_AMBER,
  pending: STATUSES.APPROVAL_PENDING,
  authorized: STATUSES.APPROVAL_AUTHORIZED,
  authorised: STATUSES.APPROVAL_AUTHORIZED,
  declined: STATUSES.APPROVAL_DECLINED,
  completed: STATUSES.APPROVAL_COMPLETED,
  "n/a": STATUSES.APPROVAL_NA,
};

export const NORMALIZE = (value) => {
  const normalized = normalizeStatusId(value);
  if (!normalized) return null;
  return ALIASES[normalized] || null;
};
