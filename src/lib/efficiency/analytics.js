import { calculateOverallTotals, calculateTechTotals } from "@/lib/database/efficiency";

const HOUR_TOLERANCE = 0.02;
const LONG_CLOCKING_HOURS = 12;

const roundHours = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
};

const parseYmd = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toYmd = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getMonday = (date) => {
  const start = new Date(date);
  const weekday = start.getDay();
  start.setDate(start.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  start.setHours(0, 0, 0, 0);
  return start;
};

export const getBaseJobNumber = (value) =>
  String(value || "")
    .split(" - Req ")[0]
    .trim();

export function getPeriodBounds(period, anchorDate) {
  const anchor = anchorDate instanceof Date ? new Date(anchorDate) : new Date();
  anchor.setHours(0, 0, 0, 0);
  let start = new Date(anchor);
  let end = new Date(anchor);

  if (period === "week") {
    start = getMonday(anchor);
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else if (period === "month") {
    start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
  } else {
    end.setDate(end.getDate() + 1);
  }

  return { start, end };
}

export function getPreviousPeriodBounds(period, anchorDate) {
  const { start, end } = getPeriodBounds(period, anchorDate);
  const duration = end.getTime() - start.getTime();
  if (period === "month") {
    const previousStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
    return {
      start: previousStart,
      end: new Date(start),
    };
  }
  return {
    start: new Date(start.getTime() - duration),
    end: new Date(start),
  };
}

export function filterEntriesByBounds(entries, bounds) {
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    const date = parseYmd(entry?.date);
    return date && date >= bounds.start && date < bounds.end;
  });
}

const duplicateKey = (entry) =>
  [entry?.user_id, entry?.date, getBaseJobNumber(entry?.job_number).toLowerCase()].join("|");

export function reconcileEfficiencyEntries(entries) {
  const source = Array.isArray(entries) ? entries : [];
  const clockingsByKey = new Map();
  const duplicateByManualId = new Map();
  const manualByClockingId = new Map();

  source.forEach((entry) => {
    if (entry?._source !== "job_clocking") return;
    const key = duplicateKey(entry);
    if (!clockingsByKey.has(key)) clockingsByKey.set(key, []);
    clockingsByKey.get(key).push(entry);
  });

  source.forEach((entry) => {
    if (entry?._source || !entry?.job_number) return;
    const matches = clockingsByKey.get(duplicateKey(entry)) || [];
    const duplicate = matches.find(
      (clocking) =>
        Math.abs(Number(clocking.hours_spent || 0) - Number(entry.hours_spent || 0)) <=
        HOUR_TOLERANCE
    );
    if (!duplicate) return;
    duplicateByManualId.set(entry.id, duplicate);
    manualByClockingId.set(duplicate.id, entry);
  });

  return source.map((entry) => {
    if (entry?._source === "job_clocking" && manualByClockingId.has(entry.id)) {
      const manual = manualByClockingId.get(entry.id);
      return {
        ...entry,
        allocated_hours:
          Number(entry.allocated_hours || 0) > 0
            ? entry.allocated_hours
            : manual.allocated_hours,
        job_description: entry.job_description || manual.job_description,
        _allocation_key:
          Number(entry.allocated_hours || 0) > 0
            ? entry._allocation_key
            : `manual-allocation:${manual.id}`,
      };
    }
    if (entry?._source || !entry?.job_number) return entry;
    const duplicate = duplicateByManualId.get(entry.id);
    if (!duplicate) return entry;
    return {
      ...entry,
      _excludedFromTotals: true,
      _qualityIssue: "Likely duplicate of an automatic clocking",
      _duplicateOf: duplicate.id,
    };
  });
}

export function getCountableEntries(entries) {
  return reconcileEfficiencyEntries(entries).filter(
    (entry) => entry?._source !== "overtime_sessions" && !entry?._excludedFromTotals
  );
}

export function buildPeriodMetrics(entries, target, options) {
  const reconciled = reconcileEfficiencyEntries(entries);
  const productiveEntries = getCountableEntries(reconciled);
  const overtimeHours = roundHours(
    reconciled
      .filter((entry) => entry?._source === "overtime_sessions")
      .reduce((sum, entry) => sum + Number(entry.hours_spent || 0), 0)
  );
  const totals = calculateTechTotals(productiveEntries, target, options);
  const unallocatedHours = roundHours(
    productiveEntries
      .filter((entry) => Number(entry.allocated_hours || 0) <= 0)
      .reduce((sum, entry) => sum + Number(entry.hours_spent || 0), 0)
  );

  return {
    ...totals,
    productiveHours: totals.actualHours,
    loggedHours: roundHours(totals.actualHours + overtimeHours),
    overtimeHours,
    unallocatedHours,
    remainingTargetHours: roundHours(Math.max(totals.targetHours - totals.actualHours, 0)),
    fullMonthTargetHours: roundHours(target?.monthlyTargetHours || 0),
    allocationDifference: roundHours(totals.actualHours - totals.allocatedHours),
    targetProgressPct:
      totals.targetHours > 0
        ? roundHours((totals.actualHours / totals.targetHours) * 100)
        : 0,
    reconciledEntries: reconciled,
    productiveEntries,
  };
}

export function aggregateWorkshopMetrics(items) {
  const rows = (Array.isArray(items) ? items : []).filter((item) => item?.metrics);
  const overall = calculateOverallTotals(
    rows.map((item) => ({
      totals: {
        ...item.metrics,
        actualHours: Number(item.metrics.actualHours ?? item.metrics.productiveHours ?? 0),
      },
      weight: Number(item.weight ?? 1),
    }))
  );
  const summed = rows.reduce(
    (totals, item) => {
      const metrics = item.metrics;
      totals.loggedHours += Number(metrics.loggedHours || 0);
      totals.productiveHours += Number(metrics.productiveHours || 0);
      totals.overtimeHours += Number(metrics.overtimeHours || 0);
      totals.unallocatedHours += Number(metrics.unallocatedHours || 0);
      totals.targetHours += Number(metrics.targetHours || 0);
      totals.fullMonthTargetHours += Number(metrics.fullMonthTargetHours || 0);
      totals.allocatedHours += Number(metrics.allocatedHours || 0);
      return totals;
    },
    { loggedHours: 0, productiveHours: 0, overtimeHours: 0, unallocatedHours: 0, targetHours: 0, fullMonthTargetHours: 0, allocatedHours: 0 }
  );

  Object.keys(summed).forEach((key) => { summed[key] = roundHours(summed[key]); });
  return {
    ...summed,
    actualHours: summed.productiveHours,
    difference: roundHours(summed.productiveHours - summed.targetHours),
    allocationDifference: roundHours(summed.productiveHours - summed.allocatedHours),
    remainingTargetHours: roundHours(Math.max(summed.targetHours - summed.productiveHours, 0)),
    targetProgressPct: summed.targetHours > 0 ? roundHours((summed.productiveHours / summed.targetHours) * 100) : 0,
    efficiencyPct: overall.efficiencyPct,
    weightedActual: overall.weightedActual,
    weightedTarget: overall.weightedTarget,
    weightedDifference: overall.difference,
  };
}

const metricsForConfig = (entries, config, period, anchorDate, referenceDate) => {
  const userEntries = (Array.isArray(entries) ? entries : []).filter(
    (entry) => Number(entry?.user_id) === Number(config.userId)
  );
  const comparable = buildComparableMetrics(userEntries, config.target, period, anchorDate, referenceDate);
  return {
    current: { metrics: comparable.current, weight: config.weight },
    previous: { metrics: comparable.previous, weight: config.weight },
  };
};

export function buildWorkshopComparableMetrics(entries, configs, period, anchorDate, referenceDate = new Date()) {
  const rows = (Array.isArray(configs) ? configs : []).map((config) =>
    metricsForConfig(entries, config, period, anchorDate, referenceDate)
  );
  const current = aggregateWorkshopMetrics(rows.map((row) => row.current));
  const previous = aggregateWorkshopMetrics(rows.map((row) => row.previous));
  return {
    current,
    previous,
    efficiencyChange: roundHours(current.efficiencyPct - previous.efficiencyPct),
    productiveChange: roundHours(current.productiveHours - previous.productiveHours),
  };
}

export function buildWorkshopComparisons(entries, configs, anchorDate, referenceDate = new Date()) {
  return [["day", "Today"], ["week", "Week"], ["month", "Month"]].map(([key, label]) => ({
    key,
    label,
    ...buildWorkshopComparableMetrics(entries, configs, key, anchorDate, referenceDate),
  }));
}

export function buildWorkshopTrend(entries, configs, period, anchorDate, referenceDate = new Date()) {
  const bounds = getPeriodBounds(period, anchorDate);
  const cursor = new Date(bounds.start);
  const points = [];
  while (cursor < bounds.end) {
    const date = toYmd(cursor);
    const dayEntries = (Array.isArray(entries) ? entries : []).filter((entry) => entry?.date === date);
    const items = (Array.isArray(configs) ? configs : []).map((config) => ({
      weight: config.weight,
      metrics: buildPeriodMetrics(
        dayEntries.filter((entry) => Number(entry.user_id) === Number(config.userId)),
        config.target,
        {
          year: cursor.getFullYear(),
          month: cursor.getMonth() + 1,
          period: "day",
          anchorDate: new Date(cursor),
          referenceDate,
          weeklyContractedHours: config.weeklyContractedHours,
        }
      ),
    }));
    const metrics = aggregateWorkshopMetrics(items);
    if (dayEntries.length > 0 || period !== "month") {
      points.push({
        date,
        label: cursor.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        efficiencyPct: metrics.efficiencyPct,
        productiveHours: metrics.productiveHours,
        targetHours: metrics.targetHours,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}

const buildTargetOptions = (bounds, target, referenceDate) => ({
  year: bounds.start.getFullYear(),
  month: bounds.start.getMonth() + 1,
  period:
    bounds.end.getTime() - bounds.start.getTime() <= 24 * 60 * 60 * 1000
      ? "day"
      : bounds.end.getTime() - bounds.start.getTime() <= 7 * 24 * 60 * 60 * 1000
        ? "week"
        : "month",
  anchorDate: bounds.start,
  referenceDate,
  weeklyContractedHours: target?.weeklyContractedHours ?? 40,
});

export function buildComparableMetrics(entries, target, period, anchorDate, referenceDate = new Date()) {
  const currentBounds = getPeriodBounds(period, anchorDate);
  const previousBounds = getPreviousPeriodBounds(period, anchorDate);
  const current = buildPeriodMetrics(
    filterEntriesByBounds(entries, currentBounds),
    target,
    buildTargetOptions(currentBounds, target, referenceDate)
  );
  const previous = buildPeriodMetrics(
    filterEntriesByBounds(entries, previousBounds),
    target,
    buildTargetOptions(previousBounds, target, referenceDate)
  );

  return {
    current,
    previous,
    efficiencyChange: roundHours(current.efficiencyPct - previous.efficiencyPct),
    productiveChange: roundHours(current.productiveHours - previous.productiveHours),
  };
}

export function buildTrend(entries, target, period, anchorDate) {
  const bounds = getPeriodBounds(period, anchorDate);
  const cursor = new Date(bounds.start);
  const points = [];
  while (cursor < bounds.end) {
    const date = toYmd(cursor);
    const dayEntries = (Array.isArray(entries) ? entries : []).filter((entry) => entry?.date === date);
    const metrics = buildPeriodMetrics(dayEntries, target, {
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
      period: "day",
      anchorDate: new Date(cursor),
      weeklyContractedHours: target?.weeklyContractedHours ?? 40,
    });
    if (dayEntries.length > 0 || period !== "month") {
      points.push({
        date,
        label: cursor.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        efficiencyPct: metrics.efficiencyPct,
        productiveHours: metrics.productiveHours,
        targetHours: metrics.targetHours,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}

const getAllocationIdentity = (entry) =>
  entry?._allocation_key || `${entry?.id || "entry"}:${entry?.allocated_hours || 0}`;

export function buildJobAnalysis(entries) {
  const groups = new Map();
  getCountableEntries(entries).forEach((entry) => {
    const jobNumber = getBaseJobNumber(entry.job_number);
    if (!jobNumber) return;
    const key = `${entry.user_id}|${jobNumber}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        userId: entry.user_id,
        jobNumber,
        description: entry.job_description || "No description recorded",
        allocatedHours: 0,
        actualHours: 0,
        categories: new Set(),
        allocations: new Set(),
      });
    }
    const group = groups.get(key);
    group.actualHours += Number(entry.hours_spent || 0);
    if (entry.job_description && group.description === "No description recorded") {
      group.description = entry.job_description;
    }
    const allocationIdentity = getAllocationIdentity(entry);
    if (!group.allocations.has(allocationIdentity)) {
      group.allocations.add(allocationIdentity);
      group.allocatedHours += Number(entry.allocated_hours || 0);
    }
    (Array.isArray(entry._categories) ? entry._categories : []).forEach((category) => {
      if (category) group.categories.add(String(category));
    });
    if (entry._category) group.categories.add(String(entry._category));
  });

  const jobs = [...groups.values()].map((group) => ({
    ...group,
    allocatedHours: roundHours(group.allocatedHours),
    actualHours: roundHours(group.actualHours),
    difference: roundHours(group.actualHours - group.allocatedHours),
    categories: [...group.categories],
  }));

  return {
    over: jobs.filter((job) => job.allocatedHours > 0 && job.difference > 0).sort((a, b) => b.difference - a.difference),
    under: jobs.filter((job) => job.allocatedHours > 0 && job.difference <= 0).sort((a, b) => a.difference - b.difference),
  };
}

const normaliseCategory = (categories, description) => {
  const haystack = [...(categories || []), description || ""].join(" ").toLowerCase();
  if (haystack.includes("mot")) return "MOT";
  if (haystack.includes("warranty")) return "Warranty";
  if (haystack.includes("diagnos")) return "Diagnostics";
  if (haystack.includes("service")) return "Service";
  if (haystack.includes("repair")) return "Repairs";
  if (haystack.includes("vhc")) return "VHC / other";
  return "Other";
};

export function buildCategoryAnalysis(entries) {
  const groups = new Map();
  const allocations = new Map();
  getCountableEntries(entries).forEach((entry) => {
    const category = normaliseCategory(
      [...(entry?._categories || []), entry?._category],
      entry?.job_description
    );
    if (!groups.has(category)) groups.set(category, { category, actualHours: 0, allocatedHours: 0 });
    const group = groups.get(category);
    group.actualHours += Number(entry.hours_spent || 0);
    const allocationKey = `${category}|${getAllocationIdentity(entry)}`;
    if (!allocations.has(allocationKey)) {
      allocations.set(allocationKey, true);
      group.allocatedHours += Number(entry.allocated_hours || 0);
    }
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      actualHours: roundHours(group.actualHours),
      allocatedHours: roundHours(group.allocatedHours),
      efficiencyPct:
        group.actualHours > 0 ? roundHours((group.allocatedHours / group.actualHours) * 100) : 0,
    }))
    .sort((a, b) => b.actualHours - a.actualHours);
}

export function buildClockingQualityAlerts(entries, rawClockings = []) {
  const alerts = [];
  const reconciled = reconcileEfficiencyEntries(entries);

  reconciled.forEach((entry) => {
    if (entry?._qualityIssue) {
      alerts.push({
        key: `duplicate-${entry.id}`,
        severity: "warning",
        userId: entry.user_id,
        title: "Possible duplicate entry",
        detail: `${entry.date} · ${entry.job_number || "No job number"}`,
      });
    }
    if (entry?._source !== "overtime_sessions" && Number(entry?.allocated_hours || 0) <= 0) {
      alerts.push({
        key: `allocation-${entry.id}`,
        severity: "neutral",
        userId: entry.user_id,
        title: "Missing allocation",
        detail: `${entry.date} · ${entry.job_number || entry.job_description || "Manual entry"}`,
      });
    }
    if (entry?._source === "job_clocking" && Number(entry?.hours_spent || 0) > LONG_CLOCKING_HOURS) {
      alerts.push({
        key: `long-${entry.id}`,
        severity: "danger",
        userId: entry.user_id,
        title: "Unusually long clocking",
        detail: `${entry.date} · ${roundHours(entry.hours_spent)}h on ${entry.job_number}`,
      });
    }
  });

  const clockingsByUser = new Map();
  (Array.isArray(rawClockings) ? rawClockings : []).forEach((clocking) => {
    if (!clocking.clock_out) {
      alerts.push({
        key: `open-${clocking.id}`,
        severity: "danger",
        userId: clocking.user_id,
        title: "Missing clock-off",
        detail: `${clocking.job_number || "No job"} · started ${new Date(clocking.clock_in).toLocaleString("en-GB")}`,
      });
    }
    if (!clockingsByUser.has(clocking.user_id)) clockingsByUser.set(clocking.user_id, []);
    clockingsByUser.get(clocking.user_id).push(clocking);
  });

  clockingsByUser.forEach((clockings) => {
    const ordered = [...clockings].sort((a, b) => new Date(a.clock_in) - new Date(b.clock_in));
    ordered.forEach((clocking, index) => {
      const next = ordered[index + 1];
      if (!next || !clocking.clock_out) return;
      if (new Date(next.clock_in) < new Date(clocking.clock_out)) {
        alerts.push({
          key: `overlap-${clocking.id}-${next.id}`,
          severity: "danger",
          userId: clocking.user_id,
          title: "Overlapping clockings",
          detail: `${clocking.job_number} overlaps ${next.job_number}`,
        });
      }
    });
  });

  return alerts;
}
