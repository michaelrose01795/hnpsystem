const toTrimmedString = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

export const normalizeLineManagerIds = (value) => {
  const source = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return Array.from(
    new Set(
      source
        .map((entry) => Number.parseInt(String(entry), 10))
        .filter((entry) => Number.isInteger(entry) && entry > 0)
    )
  );
};

const parseJsonString = (value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return value;
  }
};

export const parseEmployeeMeta = (value) => {
  const parsed = parseJsonString(value);

  if (!parsed) {
    return {
      raw: "",
      address: "",
      lineManagerIds: [],
      extra: {},
    };
  }

  if (typeof parsed === "string") {
    return {
      raw: parsed,
      address: "",
      lineManagerIds: [],
      extra: {},
    };
  }

  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      raw: "",
      address: "",
      lineManagerIds: [],
      extra: {},
    };
  }

  const {
    raw,
    address,
    lineManagerIds,
    line_manager_ids,
    ...extra
  } = parsed;

  return {
    raw: toTrimmedString(raw),
    address: toTrimmedString(address),
    lineManagerIds: normalizeLineManagerIds(lineManagerIds ?? line_manager_ids),
    extra,
  };
};

export const buildEmployeeMeta = ({
  existingValue = null,
  contact = "",
  address = "",
  lineManagerIds = [],
} = {}) => {
  const existing = parseEmployeeMeta(existingValue);
  const next = {
    ...existing.extra,
  };

  const normalizedContact = toTrimmedString(contact);
  const normalizedAddress = toTrimmedString(address);
  const normalizedManagerIds = normalizeLineManagerIds(lineManagerIds);

  if (normalizedContact) {
    next.raw = normalizedContact;
  }

  if (normalizedAddress) {
    next.address = normalizedAddress;
  }

  if (normalizedManagerIds.length > 0) {
    next.lineManagerIds = normalizedManagerIds;
  }

  if (!normalizedContact && !normalizedAddress && normalizedManagerIds.length === 0 && Object.keys(existing.extra).length === 0) {
    return null;
  }

  return next;
};
