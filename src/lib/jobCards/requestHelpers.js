// file location: src/lib/jobCards/requestHelpers.js
//
// Pure job-card request / parts-row helpers. Moved verbatim out of
// src/pages/job-cards/[jobNumber].js so the technician route can reuse the
// shared job-card components without importing that 13k-line page.

const normalizeStatusId = (value = "") =>
String(value || "").
trim().
toLowerCase().
replace(/[^a-z0-9]+/g, "_");

const SERVICE_CHOICE_LABELS = {
  reset: "Service Reminder Reset",
  not_required: "Service Reminder Not Required",
  no_reminder: "Doesn't Have a Service Reminder",
  indicator_on: "Service Indicator On"
};

const safeJsonParse = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

const normalizeWriteUpCompletionStatus = (value = "") =>
String(value || "").
trim().
toLowerCase();

const isRemovedPartsRow = (item = {}) => normalizeStatusId(item?.status) === "removed";
const isBookedPartsRow = (item = {}) => normalizeStatusId(item?.status) === "booked";
const isPartsRowAllocated = (item = {}) =>
Boolean(
  item?.allocated_to_request_id ??
  item?.allocatedToRequestId ??
  item?.vhc_item_id ??
  item?.vhcItemId
);

const getRowTimestamp = (item = {}) => {
  const raw = item?.updatedAt ?? item?.updated_at ?? item?.createdAt ?? item?.created_at ?? null;
  const timestamp = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const preferLatestPartRow = (current = null, candidate = null) => {
  if (!current) return candidate;
  if (!candidate) return current;

  const currentTime = getRowTimestamp(current);
  const candidateTime = getRowTimestamp(candidate);
  if (candidateTime !== currentTime) {
    return candidateTime > currentTime ? candidate : current;
  }

  const currentRemoved = isRemovedPartsRow(current);
  const candidateRemoved = isRemovedPartsRow(candidate);
  if (currentRemoved !== candidateRemoved) {
    return candidateRemoved ? candidate : current;
  }

  return candidate;
};

export {
  normalizeStatusId,
  SERVICE_CHOICE_LABELS,
  safeJsonParse,
  normalizeWriteUpCompletionStatus,
  isRemovedPartsRow,
  isBookedPartsRow,
  isPartsRowAllocated,
  getRowTimestamp,
  preferLatestPartRow,
};
