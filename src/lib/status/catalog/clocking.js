// Clocking status catalog used for technician availability views.
import { normalizeStatusId } from "./utils";

export const DOMAIN = "clocking";

export const STATUSES = {
  WAITING_FOR_JOB: "Waiting for Job",
  IN_PROGRESS: "In Progress",
  TEA_BREAK: "Tea Break",
  ROAD_TEST: "Road Test",
  WORKSHOP_MAINTENANCE: "Workshop Maintenance",
  MEETING_TRAINING: "Meeting/Training",
  ON_MOT: "On MOT",
  NOT_CLOCKED_IN: "Not Clocked In",
};

export const WORK_TYPES = {
  STANDARD: "initial",
  ROAD_TEST: "road_test",
};

export const DISPLAY = {
  [STATUSES.WAITING_FOR_JOB]: "Waiting for Job",
  [STATUSES.IN_PROGRESS]: "In Progress",
  [STATUSES.TEA_BREAK]: "Tea Break",
  [STATUSES.ROAD_TEST]: "Road Test",
  [STATUSES.WORKSHOP_MAINTENANCE]: "Workshop Maintenance",
  [STATUSES.MEETING_TRAINING]: "Meeting/Training",
  [STATUSES.ON_MOT]: "On MOT",
  [STATUSES.NOT_CLOCKED_IN]: "Not Clocked In",
};

const ALIASES = {
  waiting_for_job: STATUSES.WAITING_FOR_JOB,
  waiting: STATUSES.WAITING_FOR_JOB,
  in_progress: STATUSES.IN_PROGRESS,
  tea_break: STATUSES.TEA_BREAK,
  road_test: STATUSES.ROAD_TEST,
  workshop_maintenance: STATUSES.WORKSHOP_MAINTENANCE,
  meeting_training: STATUSES.MEETING_TRAINING,
  on_mot: STATUSES.ON_MOT,
  not_clocked_in: STATUSES.NOT_CLOCKED_IN,
};

export const NORMALIZE = (value) => {
  if (value === null || value === undefined) return null;
  if (Object.values(STATUSES).includes(value)) return value;
  const normalized = normalizeStatusId(value);
  if (!normalized) return null;
  return ALIASES[normalized] || null;
};
