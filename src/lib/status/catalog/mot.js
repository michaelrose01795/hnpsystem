// MOT completion status catalog (used for reporting and dashboard labels).
import { normalizeStatusId } from "./utils";

export const DOMAIN = "mot";

export const STATUSES = {
  PASS: "pass",
  FAIL: "fail",
  RETEST: "retest",
  PENDING: "pending",
};

export const DISPLAY = {
  [STATUSES.PASS]: "pass",
  [STATUSES.FAIL]: "fail",
  [STATUSES.RETEST]: "retest",
  [STATUSES.PENDING]: "pending",
};

const ALIASES = {
  pass: STATUSES.PASS,
  passed: STATUSES.PASS,
  fail: STATUSES.FAIL,
  failed: STATUSES.FAIL,
  retest: STATUSES.RETEST,
  pending: STATUSES.PENDING,
};

export const NORMALIZE = (value) => {
  const normalized = normalizeStatusId(value);
  if (!normalized) return null;
  return ALIASES[normalized] || null;
};
