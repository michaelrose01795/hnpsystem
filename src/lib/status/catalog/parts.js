// Parts pipeline catalog used for grouping parts job items into pipeline stages.
import { normalizeStatusId } from "./utils";

export const DOMAIN = "parts";

export const STATUSES = {
  WAITING_AUTHORISATION: "waiting_authorisation",
  WAITING_TO_ORDER: "waiting_to_order",
  ON_ORDER: "on_order",
  PRE_PICKED: "pre_picked",
  IN_STOCK: "in_stock",
};

export const DISPLAY = {
  [STATUSES.WAITING_AUTHORISATION]: "Waiting Authorisation",
  [STATUSES.WAITING_TO_ORDER]: "Waiting to Order",
  [STATUSES.ON_ORDER]: "On Order",
  [STATUSES.PRE_PICKED]: "Pre Picked",
  [STATUSES.IN_STOCK]: "In Stock",
};

const ITEM_STATUS_TO_STAGE = {
  waiting_authorisation: STATUSES.WAITING_AUTHORISATION,
  pending: STATUSES.WAITING_TO_ORDER,
  awaiting_stock: STATUSES.WAITING_TO_ORDER,
  on_order: STATUSES.ON_ORDER,
  pre_picked: STATUSES.PRE_PICKED,
  pre_pick: STATUSES.PRE_PICKED,
  pre_pick_location: STATUSES.PRE_PICKED,
  picked: STATUSES.PRE_PICKED,
  stock: STATUSES.IN_STOCK,
  allocated: STATUSES.IN_STOCK,
  fitted: STATUSES.IN_STOCK,
};

export const NORMALIZE = (value) => {
  const normalized = normalizeStatusId(value);
  if (!normalized) return null;
  if (Object.values(STATUSES).includes(normalized)) return normalized;
  return ITEM_STATUS_TO_STAGE[normalized] || STATUSES.WAITING_AUTHORISATION;
};
