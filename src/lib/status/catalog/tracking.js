// Vehicle/key tracking status catalog used by tracking dashboard and next-action helpers.
import { normalizeStatusId } from "./utils";

export const DOMAIN = "tracking";

export const STATUSES = {
  AWAITING_AUTHORIZATION: "Awaiting Authorization",
  WAITING_FOR_COLLECTION: "Waiting For Collection",
  READY_FOR_COLLECTION: "Ready For Collection",
  COMPLETE: "Complete",
  VALET_HOLD: "Valet Hold",
  IN_TRANSIT: "In Transit",
  AWAITING_WORKSHOP: "Awaiting Workshop",
  AWAITING_ADVISOR: "Awaiting Advisor",
};

export const DISPLAY = {
  [STATUSES.AWAITING_AUTHORIZATION]: "Awaiting Authorization",
  [STATUSES.WAITING_FOR_COLLECTION]: "Waiting For Collection",
  [STATUSES.READY_FOR_COLLECTION]: "Ready For Collection",
  [STATUSES.COMPLETE]: "Complete",
  [STATUSES.VALET_HOLD]: "Valet Hold",
  [STATUSES.IN_TRANSIT]: "In Transit",
  [STATUSES.AWAITING_WORKSHOP]: "Awaiting Workshop",
  [STATUSES.AWAITING_ADVISOR]: "Awaiting Advisor",
};

const ALIASES = {
  awaiting_authorization: STATUSES.AWAITING_AUTHORIZATION,
  awaiting_authorisation: STATUSES.AWAITING_AUTHORIZATION,
  awaiting_workshop: STATUSES.AWAITING_WORKSHOP,
  awaiting_advisor: STATUSES.AWAITING_ADVISOR,
  waiting_for_collection: STATUSES.WAITING_FOR_COLLECTION,
  ready_for_collection: STATUSES.READY_FOR_COLLECTION,
  complete: STATUSES.COMPLETE,
  valet_hold: STATUSES.VALET_HOLD,
  in_transit: STATUSES.IN_TRANSIT,
};

export const NORMALIZE = (value) => {
  if (value === null || value === undefined) return null;
  if (Object.values(STATUSES).includes(value)) return value;
  const normalized = normalizeStatusId(value);
  if (!normalized) return null;
  return ALIASES[normalized] || null;
};
