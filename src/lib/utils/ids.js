// file location: src/lib/utils/ids.js

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isValidUuid = (value) => {
  if (typeof value !== "string") return false;
  return UUID_REGEX.test(value.trim());
};

export const sanitizeUuid = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return isValidUuid(trimmed) ? trimmed : null;
};

export const sanitizeNumericId = (value) => {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      return Number.parseInt(trimmed, 10);
    }
  }
  return null;
};

export const resolveAuditIds = (rawUuid, rawNumeric) => {
  const uuid = sanitizeUuid(rawUuid);
  const numeric = sanitizeNumericId(rawNumeric);
  return { uuid, numeric };
};

export default {
  isValidUuid,
  sanitizeUuid,
  sanitizeNumericId,
  resolveAuditIds,
};
