// Tech-facing job status catalog (derived for technician UI).
import { normalizeStatusId } from "./utils";

export const DOMAIN = "tech";

export const STATUSES = {
  WAITING: "waiting",
  IN_PROGRESS: "in_progress",
  COMPLETE: "complete",
};

export const DISPLAY = {
  [STATUSES.WAITING]: "Waiting",
  [STATUSES.IN_PROGRESS]: "In Progress",
  [STATUSES.COMPLETE]: "Complete",
};

export const NORMALIZE = (value) => {
  const normalized = normalizeStatusId(value);
  if (!normalized) return null;
  if (
    normalized.includes("tech_complete") ||
    normalized.includes("technician_work_completed") ||
    normalized.includes("invoiced") ||
    normalized === "complete" ||
    normalized === "completed"
  ) {
    return STATUSES.COMPLETE;
  }
  if (
    normalized.includes("booked") ||
    normalized.includes("checked_in") ||
    normalized.includes("waiting") ||
    normalized.includes("pending")
  ) {
    return STATUSES.WAITING;
  }
  if (normalized.includes("in_progress")) {
    return STATUSES.IN_PROGRESS;
  }
  return null;
};
