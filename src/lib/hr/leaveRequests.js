const toTrimmedString = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const normaliseDateString = (value) => {
  const text = toTrimmedString(value);
  if (!text) return "";
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? text : "";
};

const toLocalDate = (value) => {
  const text = normaliseDateString(value);
  if (!text) return null;
  const [year, month, day] = text.split("-").map(Number);
  const next = new Date(year, month - 1, day);
  return Number.isNaN(next.getTime()) ? null : next;
};

const HALF_DAY_VALUES = new Set(["AM", "PM"]);

export const normaliseLeaveDayType = (value) => {
  const text = toTrimmedString(value).toUpperCase();
  return HALF_DAY_VALUES.has(text) ? text : "None";
};

export const calculateLeaveRequestDayTotals = ({
  startDate,
  endDate,
  halfDay = "None",
  fallbackTotalDays = null,
} = {}) => {
  const start = toLocalDate(startDate);
  const end = toLocalDate(endDate);
  const isHalfDay = normaliseLeaveDayType(halfDay) !== "None";

  if (!start || !end || end < start) {
    const fallbackWorkDays = fallbackTotalDays === null || fallbackTotalDays === undefined || fallbackTotalDays === ""
      ? 0
      : Number(fallbackTotalDays);
    return {
      workDays: Number.isFinite(fallbackWorkDays) ? Number(fallbackWorkDays.toFixed(1)) : 0,
      calendarDays: 0,
    };
  }

  let calendarDays = 0;
  let workDays = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    calendarDays += 1;
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      workDays += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (isHalfDay && workDays > 0) {
    workDays = Math.max(workDays - 0.5, 0.5);
  }

  return {
    workDays: Number(workDays.toFixed(1)),
    calendarDays,
  };
};

const normalizeNotificationRef = (entry) => {
  if (!entry || typeof entry !== "object") return null;
  const managerId = Number.parseInt(String(entry.managerId ?? entry.manager_id ?? ""), 10);
  const threadId = Number.parseInt(String(entry.threadId ?? entry.thread_id ?? ""), 10);
  const messageId = toTrimmedString(entry.messageId ?? entry.message_id ?? "");

  if (!Number.isInteger(managerId) || managerId <= 0) return null;
  if (!Number.isInteger(threadId) || threadId <= 0) return null;
  if (!messageId) return null;

  return {
    managerId,
    threadId,
    messageId,
  };
};

export const parseLeaveRequestNotes = (value) => {
  const fallback = {
    requestNotes: "",
    declineReason: "",
    halfDay: "None",
    totalDays: null,
    lineManagerIds: [],
    managerNotificationRefs: [],
  };

  if (!value) return fallback;

  if (typeof value !== "string") {
    return {
      ...fallback,
      requestNotes: toTrimmedString(value?.requestNotes ?? value?.notes ?? ""),
      declineReason: toTrimmedString(value?.declineReason ?? ""),
      halfDay: toTrimmedString(value?.halfDay ?? value?.half_day ?? "") || "None",
      totalDays:
        value?.totalDays === null || value?.totalDays === undefined || value?.totalDays === ""
          ? null
          : Number(value.totalDays),
      lineManagerIds: Array.isArray(value?.lineManagerIds)
        ? value.lineManagerIds
            .map((entry) => Number.parseInt(String(entry), 10))
            .filter((entry) => Number.isInteger(entry) && entry > 0)
        : [],
      managerNotificationRefs: Array.isArray(value?.managerNotificationRefs)
        ? value.managerNotificationRefs.map(normalizeNotificationRef).filter(Boolean)
        : [],
    };
  }

  try {
    const parsed = JSON.parse(value);
    return parseLeaveRequestNotes(parsed);
  } catch (_error) {
    return {
      ...fallback,
      requestNotes: toTrimmedString(value),
    };
  }
};

export const serializeLeaveRequestNotes = (value = {}) => {
  const parsed = parseLeaveRequestNotes(value);
  return JSON.stringify({
    requestNotes: parsed.requestNotes || "",
    declineReason: parsed.declineReason || "",
    halfDay: parsed.halfDay || "None",
    totalDays: parsed.totalDays ?? null,
    lineManagerIds: parsed.lineManagerIds || [],
    managerNotificationRefs: parsed.managerNotificationRefs || [],
  });
};

export const formatLeaveDateRange = (startDate, endDate) => {
  const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const start = formatDate(startDate);
  const end = formatDate(endDate);
  if (!start) return end;
  if (!end || start === end) return start;
  return `${start} to ${end}`;
};

export const buildLeaveRequestMessageLines = ({
  prefix = "/leaverequest",
  type,
  startDate,
  endDate,
  halfDay = "None",
  totalDays = null,
  notes = "",
} = {}) => {
  return [
    `${prefix} ${type} requested for ${formatLeaveDateRange(startDate, endDate)}.`,
    halfDay && halfDay !== "None" ? `Half day: ${halfDay}.` : null,
    totalDays ? `Working days requested: ${totalDays}.` : null,
    notes ? `Details: ${notes}` : null,
  ].filter(Boolean);
};
