// file location: src/features/deliveries/deliveryStatus.js
//
// Single source of truth for the parts delivery workflow: the canonical states,
// how the legacy `parts_delivery_jobs.status` values map onto them, which
// action each state offers, and which roles may perform it.
//
// Both the browser (/deliveries) and the API routes
// (/api/parts/delivery-diary/*) import this module, so a transition can never
// be allowed on one side and refused on the other.
//
// Legacy note: /delivery-planner still creates rows with 'scheduled' and the
// old page wrote 'en_route' / 'completed'. Those values remain valid in the
// database CHECK constraint and are normalised here at read time — no row is
// rewritten, so nothing that reads the old vocabulary changes behaviour.

export const DELIVERY_STATUS = {
  PLANNED: "planned",
  PICKING: "picking",
  READY: "ready",
  LOADED: "loaded",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  FAILED: "failed",
  RETURNED: "returned",
};

// Legacy value -> canonical value.
const LEGACY_STATUS_MAP = {
  scheduled: DELIVERY_STATUS.PLANNED,
  en_route: DELIVERY_STATUS.OUT_FOR_DELIVERY,
  completed: DELIVERY_STATUS.DELIVERED,
};

/**
 * Normalise any stored status (legacy or canonical) to a canonical value.
 * Unknown values fall back to `planned` so a row is never invisible.
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function normaliseDeliveryStatus(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!key) return DELIVERY_STATUS.PLANNED;
  if (LEGACY_STATUS_MAP[key]) return LEGACY_STATUS_MAP[key];
  return Object.values(DELIVERY_STATUS).includes(key) ? key : DELIVERY_STATUS.PLANNED;
}

// Display metadata. `badge` is a shared .app-badge--* modifier from
// staffglobal.css — no delivery-specific colour is introduced anywhere.
export const DELIVERY_STATUS_META = {
  [DELIVERY_STATUS.PLANNED]: {
    label: "Planned",
    short: "Planned",
    badge: "app-badge--neutral",
    order: 0,
    open: true,
  },
  [DELIVERY_STATUS.PICKING]: {
    label: "Picking",
    short: "Picking",
    badge: "app-badge--accent-soft",
    order: 1,
    open: true,
  },
  [DELIVERY_STATUS.READY]: {
    label: "Ready",
    short: "Ready",
    badge: "app-badge--accent-strong",
    order: 2,
    open: true,
  },
  [DELIVERY_STATUS.LOADED]: {
    label: "Loaded",
    short: "Loaded",
    badge: "app-badge--warning",
    order: 3,
    open: true,
  },
  [DELIVERY_STATUS.OUT_FOR_DELIVERY]: {
    label: "Out for delivery",
    short: "Out",
    badge: "app-badge--warning-strong",
    order: 4,
    open: true,
  },
  [DELIVERY_STATUS.DELIVERED]: {
    label: "Delivered",
    short: "Delivered",
    badge: "app-badge--success-strong",
    order: 5,
    open: false,
  },
  [DELIVERY_STATUS.FAILED]: {
    label: "Failed",
    short: "Failed",
    badge: "app-badge--danger-strong",
    order: 6,
    open: false,
  },
  [DELIVERY_STATUS.RETURNED]: {
    label: "Returned",
    short: "Returned",
    badge: "app-badge--danger",
    order: 7,
    open: false,
  },
};

/** Ordered status list for filter dropdowns and the summary strip. */
export const DELIVERY_STATUS_ORDER = Object.values(DELIVERY_STATUS).sort(
  (a, b) => DELIVERY_STATUS_META[a].order - DELIVERY_STATUS_META[b].order
);

/**
 * Human label for a stored status value (legacy values included).
 * @param {string} value
 * @returns {string}
 */
export const deliveryStatusLabel = (value) =>
  DELIVERY_STATUS_META[normaliseDeliveryStatus(value)].label;

/**
 * Shared badge modifier class for a stored status value.
 * @param {string} value
 * @returns {string}
 */
export const deliveryStatusBadgeClass = (value) =>
  `app-badge ${DELIVERY_STATUS_META[normaliseDeliveryStatus(value)].badge}`;

/** True while the delivery is still live work for the day. */
export const isOpenDeliveryStatus = (value) =>
  DELIVERY_STATUS_META[normaliseDeliveryStatus(value)].open;

// ---------------------------------------------------------------------------
// Failure reasons
// ---------------------------------------------------------------------------
export const DELIVERY_FAILURE_REASONS = [
  { value: "customer_closed", label: "Customer closed" },
  { value: "wrong_address", label: "Wrong address" },
  { value: "refused", label: "Refused on arrival" },
  { value: "unable_to_contact", label: "Unable to contact" },
  { value: "no_access", label: "No access to site" },
  { value: "vehicle_issue", label: "Vehicle / van issue" },
  { value: "other", label: "Other" },
];

const FAILURE_REASON_LABELS = new Map(
  DELIVERY_FAILURE_REASONS.map((reason) => [reason.value, reason.label])
);

export const deliveryFailureReasonLabel = (value) =>
  FAILURE_REASON_LABELS.get(String(value || "")) || "";

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------
// Each action names the status it moves the delivery to plus the capability it
// needs. `from` lists the canonical statuses the action is offered from.
export const DELIVERY_ACTIONS = {
  start_picking: {
    key: "start_picking",
    label: "Start picking",
    to: DELIVERY_STATUS.PICKING,
    from: [DELIVERY_STATUS.PLANNED],
    capability: "pick",
    variant: "secondary",
  },
  mark_ready: {
    key: "mark_ready",
    label: "Mark ready",
    to: DELIVERY_STATUS.READY,
    from: [DELIVERY_STATUS.PLANNED, DELIVERY_STATUS.PICKING],
    capability: "pick",
    variant: "primary",
  },
  mark_loaded: {
    key: "mark_loaded",
    label: "Mark loaded",
    to: DELIVERY_STATUS.LOADED,
    from: [DELIVERY_STATUS.READY],
    capability: "load",
    variant: "primary",
  },
  dispatch: {
    key: "dispatch",
    label: "Dispatch",
    to: DELIVERY_STATUS.OUT_FOR_DELIVERY,
    from: [DELIVERY_STATUS.LOADED, DELIVERY_STATUS.READY],
    capability: "drive",
    variant: "primary",
  },
  mark_delivered: {
    key: "mark_delivered",
    label: "Delivered",
    to: DELIVERY_STATUS.DELIVERED,
    from: [DELIVERY_STATUS.OUT_FOR_DELIVERY, DELIVERY_STATUS.LOADED],
    capability: "drive",
    variant: "primary",
  },
  mark_failed: {
    key: "mark_failed",
    label: "Failed",
    to: DELIVERY_STATUS.FAILED,
    // A stop can only fail once the parts are on the van. Something that never
    // left the shelf is still Ready, not a failed delivery — that distinction
    // is what keeps the "Failed" figure meaningful the next morning.
    from: [DELIVERY_STATUS.OUT_FOR_DELIVERY, DELIVERY_STATUS.LOADED],
    capability: "drive",
    variant: "danger",
  },
  mark_returned: {
    key: "mark_returned",
    label: "Returned to stores",
    to: DELIVERY_STATUS.RETURNED,
    from: [DELIVERY_STATUS.FAILED, DELIVERY_STATUS.OUT_FOR_DELIVERY],
    capability: "pick",
    variant: "secondary",
  },
  reopen: {
    key: "reopen",
    label: "Reopen",
    to: DELIVERY_STATUS.PLANNED,
    from: [
      DELIVERY_STATUS.DELIVERED,
      DELIVERY_STATUS.FAILED,
      DELIVERY_STATUS.RETURNED,
    ],
    capability: "manage",
    variant: "ghost",
  },
};

/** Every action key the API will accept. */
export const DELIVERY_ACTION_KEYS = Object.keys(DELIVERY_ACTIONS);

// ---------------------------------------------------------------------------
// Capabilities by role
// ---------------------------------------------------------------------------
// pick    — stores side: picking, ready, packages, missing items, returns
// load    — confirming the van is loaded
// drive   — dispatch / delivered / failed / proof of delivery
// assign  — driver + vehicle + planned time + window
// reorder — drag-and-drop route order
// manage  — reopen a closed delivery, edit any field
const PARTS_ROLES = ["parts", "parts manager"];
const DRIVER_ROLES = ["parts driver"];
const MANAGER_ROLES = [
  "parts manager",
  "admin",
  "admin manager",
  "general manager",
  "after sales director",
];

const ALL_CAPABILITIES = {
  view: true,
  pick: true,
  load: true,
  drive: true,
  assign: true,
  reorder: true,
  manage: true,
};

const NO_CAPABILITIES = {
  view: false,
  pick: false,
  load: false,
  drive: false,
  assign: false,
  reorder: false,
  manage: false,
};

const includesAny = (roles, allowed) => allowed.some((role) => roles.includes(role));

/**
 * Resolve what the signed-in user may do on the delivery diary.
 *
 * @param {string[]} roles         Lower-cased role list (see lib/auth/roles).
 * @param {boolean}  hasAllAccess  True for the All Access demo session / admin.
 * @returns {{view:boolean, pick:boolean, load:boolean, drive:boolean, assign:boolean, reorder:boolean, manage:boolean}}
 */
export function resolveDeliveryCapabilities(roles = [], hasAllAccess = false) {
  const normalised = roles.map((role) => String(role).toLowerCase());
  if (hasAllAccess || includesAny(normalised, MANAGER_ROLES)) {
    return { ...ALL_CAPABILITIES };
  }
  if (includesAny(normalised, PARTS_ROLES)) {
    return {
      view: true,
      pick: true,
      load: true,
      drive: true,
      assign: true,
      reorder: true,
      manage: false,
    };
  }
  if (includesAny(normalised, DRIVER_ROLES)) {
    // A driver runs the van: they load, dispatch, deliver and record failures
    // and proof of delivery, and they may re-order their own route. They do not
    // assign work to themselves or to anyone else.
    return {
      view: true,
      pick: false,
      load: true,
      drive: true,
      assign: false,
      reorder: true,
      manage: false,
    };
  }
  return { ...NO_CAPABILITIES };
}

/** Roles allowed to reach the diary at all — used by the API route guard. */
export const DELIVERY_DIARY_ROLES = Array.from(
  new Set([...PARTS_ROLES, ...DRIVER_ROLES, ...MANAGER_ROLES])
);

/**
 * The actions offered for a delivery in its current state.
 *
 * @param {object} delivery     A delivery row (only `status` is read).
 * @param {object} capabilities Result of resolveDeliveryCapabilities.
 * @returns {Array<object>} Action descriptors, in workflow order.
 */
export function getDeliveryActions(delivery, capabilities = NO_CAPABILITIES) {
  const status = normaliseDeliveryStatus(delivery?.status);
  return DELIVERY_ACTION_KEYS.map((key) => DELIVERY_ACTIONS[key])
    .filter((action) => action.from.includes(status))
    .filter((action) => capabilities[action.capability] === true);
}

/**
 * Server-side guard: may this actor apply this action to this row?
 *
 * @returns {{ok:true}|{ok:false, reason:string}}
 */
export function canApplyDeliveryAction(delivery, actionKey, capabilities) {
  const action = DELIVERY_ACTIONS[actionKey];
  if (!action) return { ok: false, reason: `Unknown delivery action "${actionKey}".` };
  if (capabilities?.[action.capability] !== true) {
    return { ok: false, reason: `Your role cannot ${action.label.toLowerCase()}.` };
  }
  const status = normaliseDeliveryStatus(delivery?.status);
  if (!action.from.includes(status)) {
    return {
      ok: false,
      reason: `"${action.label}" is not available from ${DELIVERY_STATUS_META[status].label}.`,
    };
  }
  return { ok: true };
}

/**
 * The timestamp column an action stamps, so the workflow trail is complete
 * without the caller having to remember which column belongs to which step.
 * `completed_at` stays the delivered timestamp it always was.
 */
export const DELIVERY_ACTION_TIMESTAMP = {
  start_picking: "picked_at",
  mark_ready: "ready_at",
  mark_loaded: "loaded_at",
  dispatch: "dispatched_at",
  mark_delivered: "completed_at",
  mark_failed: "failed_at",
  mark_returned: "returned_at",
};
