import dayjs from "dayjs";

export const runQuery = async (executor) => {
  const { data, error } = await executor();
  if (error) {
    throw error;
  }
  return data || [];
};

export const buildSevenDaySeries = (rows, dateKey = "checked_in_at") => {
  const anchor = dayjs();
  const start = anchor.subtract(6, "day").startOf("day");
  const counts = {};

  (rows || []).forEach((row) => {
    const value = row?.[dateKey];
    if (!value) return;
    const key = dayjs(value).startOf("day").toISOString();
    counts[key] = (counts[key] || 0) + 1;
  });

  return Array.from({ length: 7 }).map((_, index) => {
    const day = start.add(index, "day");
    const key = day.toISOString();
    return {
      label: day.format("ddd"),
      count: counts[key] || 0,
    };
  });
};

const severityFromText = (value = "") => {
  const normalized = String(value).toLowerCase();
  if (normalized.includes("red")) return "red";
  if (normalized.includes("amber")) return "amber";
  if (normalized.includes("green")) return "green";
  return "amber";
};

export const buildSeverityWeeklySeries = (rows, dateKey = "created_at") => {
  const anchor = dayjs();
  const start = anchor.subtract(6, "day").startOf("day");
  const series = Array.from({ length: 7 }).map((_, index) => ({
    label: start.add(index, "day").format("ddd"),
    red: 0,
    amber: 0,
    green: 0,
  }));

  (rows || []).forEach((row) => {
    const timestamp = row?.[dateKey];
    if (!timestamp) return;
    const dayIndex = dayjs(timestamp).startOf("day").diff(start, "day");
    if (dayIndex < 0 || dayIndex >= series.length) return;
    const severity = severityFromText(row?.issue_title || row?.issue_description || row?.section);
    series[dayIndex][severity] += 1;
  });

  return series;
};
