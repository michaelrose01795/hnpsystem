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

// ---------------------------------------------------------------------------
// Item-level status normalization (for parts_job_items rows)
// ---------------------------------------------------------------------------

export const ITEM_STATUSES = {
  PENDING: "pending",
  PRICED: "priced",
  PRE_PICK: "pre_pick",
  ON_ORDER: "on_order",
  BOOKED: "booked",
  REMOVED: "removed",
  RESERVED: "reserved",
  STOCK: "stock",
};

const ITEM_ALIASES = {
  pending: ITEM_STATUSES.PENDING,
  priced: ITEM_STATUSES.PRICED,
  pre_pick: ITEM_STATUSES.PRE_PICK,
  "pre-pick": ITEM_STATUSES.PRE_PICK,
  picked: ITEM_STATUSES.PRE_PICK,
  on_order: ITEM_STATUSES.ON_ORDER,
  "on-order": ITEM_STATUSES.ON_ORDER,
  awaiting_stock: ITEM_STATUSES.ON_ORDER,
  order: ITEM_STATUSES.ON_ORDER,
  ordered: ITEM_STATUSES.ON_ORDER,
  booked: ITEM_STATUSES.BOOKED,
  removed: ITEM_STATUSES.REMOVED,
  reserved: ITEM_STATUSES.RESERVED,
  stock: ITEM_STATUSES.STOCK,
  allocated: ITEM_STATUSES.STOCK,
  fitted: ITEM_STATUSES.STOCK,
};

/** Normalize a raw parts_job_items status string to a canonical item status. */
export const NORMALIZE_ITEM = (value) => {
  if (!value) return ITEM_STATUSES.PENDING; // Default for empty/null.
  const normalized = String(value).toLowerCase().replace(/\s+/g, "_"); // Lowercase + underscore.
  return ITEM_ALIASES[normalized] || ITEM_STATUSES.PENDING; // Fallback to pending.
};
