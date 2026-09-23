// file location: src/features/deliveries/deliveryFormatting.js
//
// Display helpers shared by the delivery row, the detail panel, the route panel
// and the day header, so a time or a total never renders two different ways on
// the same screen.

const CURRENCY = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const CLOCK = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

/** @param {number|string|null} value */
export const formatCurrency = (value) => {
  const parsed = Number(value);
  return CURRENCY.format(Number.isFinite(parsed) ? parsed : 0);
};

export const todayIso = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

/**
 * Shift an ISO date by whole days. Parsed as UTC midnight so a BST/GMT
 * changeover cannot skip or repeat a day in the previous/next controls.
 */
export const shiftIsoDate = (isoDate, days) => {
  const base = isoDate || todayIso();
  const date = new Date(`${base}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const formatIsoDate = (isoDate) => {
  if (!isoDate) return "—";
  try {
    return LONG_DATE.format(new Date(`${isoDate}T00:00:00`));
  } catch {
    return isoDate;
  }
};

export const formatIsoDateShort = (isoDate) => {
  if (!isoDate) return "—";
  try {
    return SHORT_DATE.format(new Date(`${isoDate}T00:00:00`));
  } catch {
    return isoDate;
  }
};

/** A `time` column value (HH:MM:SS) as HH:MM. */
export const formatClockTime = (value) => {
  if (!value) return "";
  const text = String(value);
  return text.length >= 5 ? text.slice(0, 5) : text;
};

/** A timestamptz as a local HH:MM. */
export const formatTimestampTime = (value) => {
  if (!value) return "";
  try {
    return CLOCK.format(new Date(value));
  } catch {
    return "";
  }
};

/**
 * The planned time or window, whichever the delivery carries.
 * "09:30", "09:00–11:00", or "Any time".
 */
export const formatDeliveryWindow = (delivery = {}) => {
  const start = formatClockTime(delivery.window_start);
  const end = formatClockTime(delivery.window_end);
  if (start && end) return `${start}–${end}`;
  const planned = formatClockTime(delivery.planned_time);
  if (planned) return planned;
  if (start) return `From ${start}`;
  if (end) return `By ${end}`;
  return "Any time";
};

/** True when a planned time has passed and the stop is still open. */
export const isDeliveryOverdue = (delivery, { open }) => {
  if (!open) return false;
  const reference = delivery.window_end || delivery.planned_time;
  if (!reference || !delivery.delivery_date) return false;
  const due = new Date(`${delivery.delivery_date}T${formatClockTime(reference)}:00`);
  return Number.isFinite(due.getTime()) && due.getTime() < Date.now();
};

/**
 * One address line for a stop.
 *
 * Customer addresses in this database usually already end with the postcode
 * ("14, Meadow View, Sittingbourne, Kent, ME10 3RF"), so appending the postcode
 * column unconditionally printed it twice. The postcode is only added when the
 * address does not already carry it.
 */
export const formatDeliveryAddress = (delivery = {}) => {
  const address = String(delivery.addressLine || delivery.address || "").trim();
  const postcode = String(delivery.postcodeValue || delivery.postcode || "").trim();
  if (!address) return postcode;
  if (!postcode) return address;
  const squash = (value) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return squash(address).includes(squash(postcode)) ? address : `${address}, ${postcode}`;
};

/** UK numbers dial reliably from a tel: link once spacing is stripped. */
export const telHref = (phone) => {
  const digits = String(phone || "").replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
};

/**
 * Navigation deep link. Google Maps' universal directions URL opens the native
 * app on a phone and the web map on a desktop, and needs no API key — which is
 * what keeps the Navigate action free of a paid mapping integration.
 */
export const navigationHref = (delivery = {}) => {
  const destination = formatDeliveryAddress(delivery);
  if (!destination) return "";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
};

/** "3 items · 2 packages" — omits the half that is not known. */
export const formatLoadSummary = (delivery = {}) => {
  const parts = [];
  const items = Number(delivery.itemCount ?? delivery.quantity ?? 0);
  if (items > 0) parts.push(`${items} item${items === 1 ? "" : "s"}`);
  const packages = Number(delivery.packageCount ?? delivery.package_count ?? 0);
  if (packages > 0) parts.push(`${packages} package${packages === 1 ? "" : "s"}`);
  return parts.join(" · ") || "No items recorded";
};

/** The reference a stop is known by on the parts desk. */
export const deliveryReference = (delivery = {}) =>
  delivery.invoice_number ||
  delivery.order_reference ||
  delivery.jobNumber ||
  delivery.invoice?.invoice_number ||
  "No reference";
