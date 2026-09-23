// file location: src/features/loanCars/loanCarModel.js
//
// The loan car tracker's business rules, in one pure module so the calendar,
// the drawers and the API routes can never disagree:
//
//   * calendar ranges (7 day / 14 day / month) and previous / next navigation,
//   * booking time windows and overlap detection (bookings + unavailable
//     periods), and the free alternatives offered when a slot is taken,
//   * each booking's live state and each vehicle's current availability
//     (Available / Reserved / Out / Due today / Overdue / Unavailable),
//   * the summary counts and filters above the calendar,
//   * search matching and the compact labels / hover text / copy text.
//
// Dates are local calendar keys ("YYYY-MM-DD") and times are local "HH:MM",
// exactly as staff type them from the external system. Comparisons use
// "YYYY-MM-DDTHH:MM" stamps, which order correctly as plain strings.

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------
export const BOOKING_STATUS = Object.freeze({
  RESERVED: "reserved",
  OUT: "out",
  RETURNED: "returned",
});

export const BOOKING_STATUS_VALUES = Object.values(BOOKING_STATUS);

// A booking's live state, derived from its status, its times and "now".
export const BOOKING_STATE = Object.freeze({
  UPCOMING: "upcoming",
  RESERVED: "reserved",
  OUT: "out",
  DUE_TODAY: "due_today",
  OVERDUE: "overdue",
  RETURNED: "returned",
});

// A vehicle's availability right now.
export const AVAILABILITY = Object.freeze({
  AVAILABLE: "available",
  RESERVED: "reserved",
  OUT: "out",
  DUE_TODAY: "due_today",
  OVERDUE: "overdue",
  UNAVAILABLE: "unavailable",
});

// `tone` maps onto the .app-badge--* modifiers and the .loan-car-* tone
// classes in staffglobal.css.
export const AVAILABILITY_META = Object.freeze({
  [AVAILABILITY.AVAILABLE]: { label: "Available", tone: "success" },
  [AVAILABILITY.RESERVED]: { label: "Reserved", tone: "warning" },
  [AVAILABILITY.OUT]: { label: "Out", tone: "accent" },
  [AVAILABILITY.DUE_TODAY]: { label: "Due today", tone: "warning-strong" },
  [AVAILABILITY.OVERDUE]: { label: "Overdue", tone: "danger" },
  [AVAILABILITY.UNAVAILABLE]: { label: "Unavailable", tone: "neutral" },
});

export const BOOKING_STATE_META = Object.freeze({
  [BOOKING_STATE.UPCOMING]: { label: "Reserved", tone: "warning" },
  [BOOKING_STATE.RESERVED]: { label: "Reserved", tone: "warning" },
  [BOOKING_STATE.OUT]: { label: "Out", tone: "accent" },
  [BOOKING_STATE.DUE_TODAY]: { label: "Due today", tone: "warning-strong" },
  [BOOKING_STATE.OVERDUE]: { label: "Overdue", tone: "danger" },
  [BOOKING_STATE.RETURNED]: { label: "Returned", tone: "neutral" },
});

export const UNAVAILABLE_REASONS = Object.freeze([
  { value: "service", label: "Service" },
  { value: "mot", label: "MOT" },
  { value: "repair", label: "Repair" },
  { value: "damage", label: "Damage" },
  { value: "other", label: "Other" },
]);

export const TRANSMISSIONS = Object.freeze([
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automatic" },
]);

export const FUEL_TYPES = Object.freeze([
  { value: "petrol", label: "Petrol" },
  { value: "diesel", label: "Diesel" },
  { value: "hybrid", label: "Hybrid" },
  { value: "plug_in_hybrid", label: "Plug-in hybrid" },
  { value: "electric", label: "Electric" },
  { value: "other", label: "Other" },
]);

// Fuel is stored on a 0–8 scale (eighths): 0 = Empty, 8 = Full, matching the
// FuelGauge segments and the tracking_loan_cars_fuel_level_check constraint.
export const FUEL_LEVEL_COUNT = 8;
export const FUEL_LEVEL_LABELS = Object.freeze(["Empty", "1/8", "1/4", "3/8", "1/2", "5/8", "3/4", "7/8", "Full"]);

export const clampFuelLevel = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(FUEL_LEVEL_COUNT, Math.max(0, Math.round(parsed)));
};

export const fuelLevelLabel = (value) => FUEL_LEVEL_LABELS[clampFuelLevel(value)];

// Whole-number percent (0, 13, 25, 38, 50, 63, 75, 88, 100).
export const fuelLevelPercent = (level) => Math.round((clampFuelLevel(level) / FUEL_LEVEL_COUNT) * 100);

export const fuelLevelDisplayLabel = (level) => `${fuelLevelLabel(level)} · ${fuelLevelPercent(level)}%`;

const labelFrom = (list, value) => list.find((item) => item.value === value)?.label || "";
export const unavailableReasonLabel = (value) => labelFrom(UNAVAILABLE_REASONS, value) || "Unavailable";
export const transmissionLabel = (value) => labelFrom(TRANSMISSIONS, value);
export const fuelTypeLabel = (value) => labelFrom(FUEL_TYPES, value);

// Summary filters above the calendar. "Out" counts everything currently away
// from site, including the due-today and overdue cars it contains.
export const SUMMARY_FILTERS = Object.freeze([
  { id: "available", label: "Available", states: [AVAILABILITY.AVAILABLE] },
  { id: "out", label: "Out", states: [AVAILABILITY.OUT, AVAILABILITY.DUE_TODAY, AVAILABILITY.OVERDUE] },
  { id: "due_today", label: "Due today", states: [AVAILABILITY.DUE_TODAY] },
  { id: "overdue", label: "Overdue", states: [AVAILABILITY.OVERDUE] },
]);

export const RANGE_OPTIONS = Object.freeze([
  { value: "7", label: "7 day" },
  { value: "14", label: "14 day" },
  { value: "month", label: "Month" },
]);

// Days shown before the anchor in the rolling views, so yesterday's returns
// are one scroll away without pushing today off the top.
const RANGE_LEAD_DAYS = { 7: 1, 14: 2 };

// ---------------------------------------------------------------------------
// Dates and times
// ---------------------------------------------------------------------------
const pad = (value) => String(value).padStart(2, "0");

export const toDateKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseDateKey = (key) => {
  const match = String(key || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const normaliseDateKey = (value) => {
  const parsed = parseDateKey(value);
  return parsed ? toDateKey(parsed) : "";
};

export const addDays = (key, days) => {
  const date = parseDateKey(key);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

/** Whole days from `fromKey` to `toKey` (negative when `toKey` is earlier). */
export const diffDays = (fromKey, toKey) => {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  if (!from || !to) return 0;
  // Round, so a DST change inside the span cannot produce 6.96 days.
  return Math.round((to.getTime() - from.getTime()) / 86400000);
};

export const normaliseTime = (value) => {
  const match = String(value || "").match(/^([01]?\d|2[0-3]):([0-5]\d)/);
  return match ? `${pad(match[1])}:${match[2]}` : "";
};

export const toTimeKey = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** The "now" stamp every state rule compares against. */
export const nowStamp = (now = new Date()) => `${toDateKey(now)}T${toTimeKey(now)}`;

const stamp = (dateKey, time, fallbackTime) =>
  dateKey ? `${String(dateKey).slice(0, 10)}T${normaliseTime(time) || fallbackTime}` : "";

// ---------------------------------------------------------------------------
// Calendar ranges
// ---------------------------------------------------------------------------
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

export const formatDayLabel = (key) => {
  const date = parseDateKey(key);
  return date ? `${WEEKDAY.format(date)} ${DAY_MONTH.format(date)}` : "";
};

export const formatShortDate = (key) => {
  const date = parseDateKey(key);
  return date ? DAY_MONTH.format(date) : "";
};

/**
 * The rows the calendar renders.
 *
 * @param {object} options
 * @param {"7"|"14"|"month"} options.rangeType
 * @param {string} options.anchorKey  The day the view is built around.
 * @param {string} options.todayKey
 * @returns {{ startKey: string, endKey: string, label: string, days: object[] }}
 */
export function buildCalendarRange({ rangeType = "14", anchorKey, todayKey }) {
  const anchor = normaliseDateKey(anchorKey) || todayKey;
  let startKey;
  let length;

  if (rangeType === "month") {
    const date = parseDateKey(anchor);
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    startKey = toDateKey(first);
    length = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  } else {
    length = Number(rangeType) === 7 ? 7 : 14;
    startKey = addDays(anchor, -(RANGE_LEAD_DAYS[length] || 0));
  }

  const days = Array.from({ length }, (_, index) => {
    const key = addDays(startKey, index);
    const date = parseDateKey(key);
    const weekday = date.getDay();
    return {
      key,
      weekday: WEEKDAY.format(date),
      dayMonth: DAY_MONTH.format(date),
      isToday: key === todayKey,
      isPast: key < todayKey,
      isWeekend: weekday === 0 || weekday === 6,
    };
  });

  const endKey = days[days.length - 1].key;
  const label =
    rangeType === "month"
      ? MONTH_YEAR.format(parseDateKey(startKey))
      : `${formatShortDate(startKey)} – ${formatShortDate(endKey)}`;

  return { startKey, endKey, label, days };
}

/** The anchor one step before / after the current view. */
export function shiftAnchor({ rangeType = "14", anchorKey, direction = 1 }) {
  if (rangeType === "month") {
    const date = parseDateKey(anchorKey);
    return toDateKey(new Date(date.getFullYear(), date.getMonth() + direction, 1));
  }
  return addDays(anchorKey, (Number(rangeType) === 7 ? 7 : 14) * direction);
}

// ---------------------------------------------------------------------------
// Booking windows and overlap
// ---------------------------------------------------------------------------
export const bookingStartStamp = (booking) => stamp(booking?.startDate, booking?.startTime, "00:00");

export const bookingPlannedEndStamp = (booking) =>
  stamp(booking?.endDate || booking?.startDate, booking?.endTime, "23:59");

/** When the car actually becomes free again: the return, if recorded. */
export const bookingEffectiveEndStamp = (booking) => {
  if (booking?.status === BOOKING_STATUS.RETURNED && (booking.returnedDate || booking.endDate)) {
    return stamp(booking.returnedDate || booking.endDate, booking.returnedTime, "23:59");
  }
  return bookingPlannedEndStamp(booking);
};

const windowsOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

const periodOverlapsDates = (period, startKey, endKey) =>
  period.startDate <= endKey && startKey <= period.endDate;

/** Validation shared by the forms and the API. Returns an error string or "". */
export function validateBookingWindow(booking) {
  if (!booking?.loanCarId) return "Choose a loan car.";
  if (!booking.startDate) return "Enter the loan start date.";
  if (!booking.endDate) return "Enter the loan end date.";
  if (booking.endDate < booking.startDate) {
    return "The loan end date must be the same as or after the start date.";
  }
  if (bookingPlannedEndStamp(booking) <= bookingStartStamp(booking)) {
    return "The return time must be after the start time.";
  }
  return "";
}

/**
 * Everything the candidate booking would clash with on its own loan car.
 *
 * @returns {Array<{ type: "booking"|"unavailable", item: object }>}
 */
export function findBookingConflicts(candidate, { bookings = [], periods = [] } = {}) {
  if (!candidate?.loanCarId || !candidate.startDate) return [];
  const ownId = candidate.bookingId || candidate.id || null;
  const start = bookingStartStamp(candidate);
  const end = bookingPlannedEndStamp(candidate);
  const endDate = candidate.endDate || candidate.startDate;

  const bookingClashes = bookings
    .filter((booking) => booking.loanCarId === candidate.loanCarId)
    .filter((booking) => !ownId || (booking.bookingId || booking.id) !== ownId)
    .filter((booking) => windowsOverlap(start, end, bookingStartStamp(booking), bookingEffectiveEndStamp(booking)))
    .map((item) => ({ type: "booking", item }));

  const periodClashes = periods
    .filter((period) => period.loanCarId === candidate.loanCarId)
    .filter((period) => periodOverlapsDates(period, candidate.startDate, endDate))
    .map((item) => ({ type: "unavailable", item }));

  return [...bookingClashes, ...periodClashes];
}

export const isActiveCar = (car) => String(car?.status || "active").toLowerCase() !== "inactive";

/** Other active cars that are free for the candidate's whole window. */
export function findAlternativeCars(candidate, { cars = [], bookings = [], periods = [] } = {}) {
  return cars
    .filter(isActiveCar)
    .filter((car) => (car.loanCarId || car.id) !== candidate.loanCarId)
    .filter(
      (car) =>
        findBookingConflicts({ ...candidate, loanCarId: car.loanCarId || car.id }, { bookings, periods }).length === 0
    );
}

/** Human description of one conflict, for the form and the 409 message. */
export function describeConflict(conflict) {
  if (!conflict) return "";
  const { type, item } = conflict;
  if (type === "unavailable") {
    return `Vehicle unavailable (${unavailableReasonLabel(item.reason)}) ${formatShortDate(item.startDate)} – ${formatShortDate(item.endDate)}`;
  }
  const who = customerSurname(item.customerName) || "another customer";
  const job = item.jobNumber ? ` #${item.jobNumber}` : "";
  return `Booked for ${who}${job} ${formatShortDate(item.startDate)} – ${formatShortDate(item.endDate)}`;
}

// ---------------------------------------------------------------------------
// Live state
// ---------------------------------------------------------------------------
/**
 * A booking's state at `now`.
 *
 * The tracker is a copy of the external system, so staff will not always press
 * "Mark out" at handover. A reserved booking that started on an earlier day is
 * therefore treated as out; one starting today stays Reserved until it is
 * handed over, so reception can see which cars are waiting for collection.
 */
export function resolveBookingState(booking, now = nowStamp()) {
  if (!booking) return BOOKING_STATE.UPCOMING;
  if (booking.status === BOOKING_STATUS.RETURNED) return BOOKING_STATE.RETURNED;

  const today = now.slice(0, 10);
  const isHandedOver = booking.status === BOOKING_STATUS.OUT;
  const startsToday = booking.startDate === today;

  if (bookingStartStamp(booking) > now) {
    return startsToday ? BOOKING_STATE.RESERVED : BOOKING_STATE.UPCOMING;
  }
  if (!isHandedOver && startsToday) return BOOKING_STATE.RESERVED;
  if (bookingPlannedEndStamp(booking) < now) return BOOKING_STATE.OVERDUE;
  if ((booking.endDate || booking.startDate) === today) return BOOKING_STATE.DUE_TODAY;
  return BOOKING_STATE.OUT;
}

/**
 * The last calendar day a booking occupies on screen. An overdue car is still
 * away, so its block runs on to today instead of stopping at the planned end.
 */
export function bookingDisplayEndDate(booking, now = nowStamp()) {
  if (booking?.status === BOOKING_STATUS.RETURNED) {
    return booking.returnedDate || booking.endDate || booking.startDate;
  }
  const planned = booking?.endDate || booking?.startDate;
  const today = now.slice(0, 10);
  return resolveBookingState(booking, now) === BOOKING_STATE.OVERDUE && planned < today ? today : planned;
}

const STATE_PRIORITY = [
  BOOKING_STATE.OVERDUE,
  BOOKING_STATE.DUE_TODAY,
  BOOKING_STATE.OUT,
  BOOKING_STATE.RESERVED,
];

const STATE_TO_AVAILABILITY = {
  [BOOKING_STATE.OVERDUE]: AVAILABILITY.OVERDUE,
  [BOOKING_STATE.DUE_TODAY]: AVAILABILITY.DUE_TODAY,
  [BOOKING_STATE.OUT]: AVAILABILITY.OUT,
  [BOOKING_STATE.RESERVED]: AVAILABILITY.RESERVED,
};

/**
 * A vehicle's availability at `now`, with the booking / period behind it and
 * its next upcoming booking.
 */
export function resolveCarAvailability(car, { bookings = [], periods = [] } = {}, now = nowStamp()) {
  const carId = car?.loanCarId || car?.id;
  const today = now.slice(0, 10);
  const carBookings = bookings
    .filter((booking) => booking.loanCarId === carId)
    .sort((a, b) => bookingStartStamp(a).localeCompare(bookingStartStamp(b)));
  const nextBooking =
    carBookings.find((booking) => resolveBookingState(booking, now) === BOOKING_STATE.UPCOMING) || null;

  if (!isActiveCar(car)) {
    return { state: AVAILABILITY.UNAVAILABLE, reason: "Inactive", booking: null, period: null, nextBooking };
  }

  const period = periods.find(
    (item) => item.loanCarId === carId && item.startDate <= today && item.endDate >= today
  );
  if (period) {
    return {
      state: AVAILABILITY.UNAVAILABLE,
      reason: unavailableReasonLabel(period.reason),
      booking: null,
      period,
      nextBooking,
    };
  }

  for (const state of STATE_PRIORITY) {
    const booking = carBookings.find((item) => resolveBookingState(item, now) === state);
    if (booking) {
      return { state: STATE_TO_AVAILABILITY[state], reason: "", booking, period: null, nextBooking };
    }
  }

  return { state: AVAILABILITY.AVAILABLE, reason: "", booking: null, period: null, nextBooking };
}

/** Counts for the summary filters. */
export function summariseAvailability(availabilityByCar = {}) {
  const states = Object.values(availabilityByCar).map((entry) => entry?.state);
  return SUMMARY_FILTERS.reduce((counts, filter) => {
    counts[filter.id] = states.filter((state) => filter.states.includes(state)).length;
    return counts;
  }, {});
}

export const carMatchesSummaryFilter = (availability, filterId) => {
  if (!filterId) return true;
  const filter = SUMMARY_FILTERS.find((item) => item.id === filterId);
  return filter ? filter.states.includes(availability?.state) : true;
};

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
const digits = (value) => String(value || "").replace(/\D/g, "");

/**
 * Loan registration / make is matched on the car; customer, customer vehicle,
 * job number, phone and external reference on the booking. Phone numbers match
 * on digits only, so "07700 900123" finds "07700900123".
 */
export function bookingMatchesSearch(booking, term) {
  const needle = String(term || "").trim().toLowerCase();
  if (!needle) return true;
  const textFields = [
    booking.customerName,
    booking.customerEmail,
    booking.vehicleReg,
    booking.vehicleMakeModel,
    booking.jobNumber,
    booking.externalReference,
  ];
  if (textFields.some((value) => String(value || "").toLowerCase().includes(needle))) return true;
  // Registrations are often typed without the space.
  const compact = needle.replace(/\s+/g, "");
  if (compact && String(booking.vehicleReg || "").replace(/\s+/g, "").toLowerCase().includes(compact)) return true;
  const phoneNeedle = digits(needle);
  return phoneNeedle.length >= 4 && digits(booking.customerPhone).includes(phoneNeedle);
}

export function carMatchesSearch(car, term) {
  const needle = String(term || "").trim().toLowerCase();
  if (!needle) return true;
  const compact = needle.replace(/\s+/g, "");
  return (
    [car.reg, car.makeModel, car.name, car.colour, car.notes].some((value) =>
      String(value || "").toLowerCase().includes(needle)
    ) || String(car.reg || "").replace(/\s+/g, "").toLowerCase().includes(compact)
  );
}

// ---------------------------------------------------------------------------
// Labels, hover text and copy text
// ---------------------------------------------------------------------------
const TITLES = new Set(["mr", "mrs", "ms", "miss", "dr", "mx", "sir", "prof"]);

/** "Mr John Smith" → "Smith", "Smith, John" → "Smith", "ACME Ltd" → "ACME Ltd". */
export function customerSurname(name) {
  const text = String(name || "").trim();
  if (!text) return "";
  if (text.includes(",")) return text.split(",")[0].trim();
  if (/\b(ltd|limited|plc|llp|group|motors|services)\b/i.test(text)) return text;
  const parts = text.split(/\s+/).filter((part) => !TITLES.has(part.replace(/\./g, "").toLowerCase()));
  return parts[parts.length - 1] || text;
}

export const formatBookingTimes = (booking) => {
  const start = normaliseTime(booking?.startTime);
  const end = normaliseTime(booking?.endTime);
  if (start && end) return `${start}–${end}`;
  if (start) return `from ${start}`;
  if (end) return `until ${end}`;
  return "";
};

export function formatBookingWindow(booking) {
  if (!booking?.startDate) return "";
  const start = [formatDayLabel(booking.startDate), normaliseTime(booking.startTime)].filter(Boolean).join(" ");
  const end = [formatDayLabel(booking.endDate || booking.startDate), normaliseTime(booking.endTime)]
    .filter(Boolean)
    .join(" ");
  return start === end ? start : `${start} → ${end}`;
}

export const bookingDurationDays = (booking) =>
  booking?.startDate ? diffDays(booking.startDate, booking.endDate || booking.startDate) + 1 : 0;

/** One-line hover text for a calendar block. */
export function bookingHoverText(booking, car, now = nowStamp()) {
  const state = BOOKING_STATE_META[resolveBookingState(booking, now)]?.label;
  return [
    [car?.reg, state].filter(Boolean).join(" · "),
    booking.customerName,
    booking.jobNumber ? `Job #${booking.jobNumber}` : "",
    [booking.vehicleReg, booking.vehicleMakeModel].filter(Boolean).join(" "),
    formatBookingWindow(booking),
    booking.customerPhone,
    booking.externalReference ? `Ref ${booking.externalReference}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Plain-text summary for the clipboard (pasting back into the external system, notes, emails). */
export function bookingCopyText(booking, car) {
  const lines = [
    ["Loan car", [car?.reg, car?.makeModel].filter(Boolean).join(" ")],
    ["Customer", booking.customerName],
    ["Phone", booking.customerPhone],
    ["Email", booking.customerEmail],
    ["Job", booking.jobNumber ? `#${booking.jobNumber}` : ""],
    ["Customer vehicle", [booking.vehicleReg, booking.vehicleMakeModel].filter(Boolean).join(" ")],
    ["Loan period", formatBookingWindow(booking)],
    ["External ref", booking.externalReference],
    ["Notes", booking.notes],
  ];
  return lines
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}
