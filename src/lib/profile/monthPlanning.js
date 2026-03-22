function pad(value) {
  return String(value).padStart(2, "0");
}

export function getCurrentMonthKey(referenceDate = new Date()) {
  return `${referenceDate.getFullYear()}-${pad(referenceDate.getMonth() + 1)}`;
}

export function normaliseMonthKey(monthKey, fallback = getCurrentMonthKey()) {
  if (typeof monthKey !== "string") return fallback;
  const match = monthKey.trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return fallback;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return fallback;
  }
  return `${year}-${pad(month)}`;
}

export function monthKeyToDate(monthKey) {
  const [year, month] = normaliseMonthKey(monthKey).split("-").map(Number);
  return new Date(year, month - 1, 1);
}

export function compareMonthKeys(leftMonthKey, rightMonthKey) {
  const left = normaliseMonthKey(leftMonthKey);
  const right = normaliseMonthKey(rightMonthKey);
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function shiftMonthKey(monthKey, monthDelta) {
  const date = monthKeyToDate(monthKey);
  date.setMonth(date.getMonth() + monthDelta);
  return getCurrentMonthKey(date);
}

export function formatMonthLabel(monthKey, locale = "en-GB") {
  return monthKeyToDate(monthKey).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

export function isFutureMonth(monthKey, referenceMonthKey = getCurrentMonthKey()) {
  return compareMonthKeys(monthKey, referenceMonthKey) > 0;
}

export function isPastMonth(monthKey, referenceMonthKey = getCurrentMonthKey()) {
  return compareMonthKeys(monthKey, referenceMonthKey) < 0;
}

export function createRuleId() {
  return `rule-${Math.random().toString(36).slice(2, 10)}`;
}

export function createOverrideId() {
  return `override-${Math.random().toString(36).slice(2, 10)}`;
}

export function createMonthValueId() {
  return `month-${Math.random().toString(36).slice(2, 10)}`;
}

export function ruleAppliesToMonth(rule = {}, monthKey) {
  const targetMonthKey = normaliseMonthKey(monthKey);
  const startMonth = normaliseMonthKey(rule.startMonth || targetMonthKey, targetMonthKey);
  const endMonth = rule.endMonth ? normaliseMonthKey(rule.endMonth, targetMonthKey) : null;

  if (compareMonthKeys(targetMonthKey, startMonth) < 0) return false;
  if (endMonth && compareMonthKeys(targetMonthKey, endMonth) > 0) return false;

  return (rule.recurrenceType || "monthly") === "monthly";
}

export function calculateRecurringAmountForMonth(rule = {}, monthKey) {
  if (!ruleAppliesToMonth(rule, monthKey)) return 0;

  const baseAmount = Number(rule.amount || 0);
  const annualIncreasePct = Number(rule.configJson?.annualIncreasePct || rule.annualIncreasePct || 0);
  if (!annualIncreasePct) {
    return Number(baseAmount.toFixed(2));
  }

  const startMonth = monthKeyToDate(rule.startMonth || monthKey);
  const targetMonth = monthKeyToDate(monthKey);
  const yearDelta = targetMonth.getFullYear() - startMonth.getFullYear();
  const growthMultiplier = Math.pow(1 + annualIncreasePct / 100, Math.max(yearDelta, 0));
  return Number((baseAmount * growthMultiplier).toFixed(2));
}

export function getMonthOverride(overrides = [], monthKey, category = "") {
  const targetMonthKey = normaliseMonthKey(monthKey);
  const targetCategory = String(category || "").toLowerCase();
  return (overrides || []).find((override) => {
    const overrideMonthKey = normaliseMonthKey(override.monthKey || override.month_key, "");
    const overrideCategory = String(override.category || "").toLowerCase();
    return overrideMonthKey === targetMonthKey && overrideCategory === targetCategory;
  }) || null;
}

export function sumRows(rows = []) {
  return Number(
    (rows || []).reduce((sum, row) => sum + Number(row.amount || 0), 0).toFixed(2)
  );
}

export function buildRuleRowsForMonth({
  rules = [],
  overrides = [],
  monthKey,
  actualMap = {},
  defaultCategories = [],
  treatOverridesAsActual = false,
} = {}) {
  const rowsByCategory = new Map();

  defaultCategories.forEach((category) => {
    rowsByCategory.set(category, {
      category,
      amount: 0,
      source: "planned",
      isActual: false,
      isProjected: true,
    });
  });

  (rules || []).forEach((rule) => {
    const category = rule.category || "General";
    if (!ruleAppliesToMonth(rule, monthKey)) return;
    const nextAmount = calculateRecurringAmountForMonth(rule, monthKey);
    const existing = rowsByCategory.get(category) || {
      category,
      amount: 0,
      source: "planned",
      isActual: false,
      isProjected: true,
    };

    rowsByCategory.set(category, {
      ...existing,
      amount: Number((existing.amount + nextAmount).toFixed(2)),
      source: "planned",
      isActual: false,
      isProjected: true,
    });
  });

  Object.entries(actualMap || {}).forEach(([category, amount]) => {
    rowsByCategory.set(category, {
      category,
      amount: Number(amount || 0),
      source: "actual",
      isActual: true,
      isProjected: false,
    });
  });

  (overrides || []).forEach((override) => {
    const category = override.category || "General";
    if (normaliseMonthKey(override.monthKey || override.month_key) !== normaliseMonthKey(monthKey)) {
      return;
    }

    const overrideAmount = Number(
      override.overrideJson?.amount ??
        override.amount ??
        0
    );
    rowsByCategory.set(category, {
      category,
      amount: overrideAmount,
      source: treatOverridesAsActual ? "actual" : "planned",
      isActual: treatOverridesAsActual,
      isProjected: !treatOverridesAsActual,
      note: override.overrideJson?.note || "",
    });
  });

  return Array.from(rowsByCategory.values()).sort((left, right) =>
    String(left.category || "").localeCompare(String(right.category || ""))
  );
}

export function deriveMonthStatus(rows = [], monthKey, referenceMonthKey = getCurrentMonthKey()) {
  if ((rows || []).some((row) => row.isActual)) return "Actual";
  if (isFutureMonth(monthKey, referenceMonthKey)) return "Projected";
  return "Planned";
}

export function buildMonthRange(startMonthKey, endMonthKey) {
  const range = [];
  let current = normaliseMonthKey(startMonthKey);
  const final = normaliseMonthKey(endMonthKey);
  let safetyCounter = 0;

  while (compareMonthKeys(current, final) <= 0 && safetyCounter < 120) {
    range.push(current);
    current = shiftMonthKey(current, 1);
    safetyCounter += 1;
  }

  return range;
}
