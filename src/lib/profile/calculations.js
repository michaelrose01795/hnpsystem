import {
  buildMonthRange,
  buildRuleRowsForMonth,
  createOverrideId,
  createRuleId,
  deriveMonthStatus,
  formatMonthLabel,
  getCurrentMonthKey,
  isFutureMonth,
  monthKeyToDate,
  normaliseMonthKey,
  shiftMonthKey,
  sumRows,
} from "@/lib/profile/monthPlanning";

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function expectedMonthlyContractHours(contractedWeeklyHours = 0) {
  const weekly = toNumber(contractedWeeklyHours, 0);
  return Number((weekly * 52 / 12).toFixed(2));
}

export function calculateOvertimeHours(actualHours = 0, expectedHours = 0) {
  return Number(Math.max(toNumber(actualHours, 0) - toNumber(expectedHours, 0), 0).toFixed(2));
}

export function calculateBasePay(standardHours = 0, hourlyRate = 0) {
  return Number((toNumber(standardHours, 0) * toNumber(hourlyRate, 0)).toFixed(2));
}

export function calculateOvertimePay(overtimeHours = 0, overtimeRate = 0) {
  return Number((toNumber(overtimeHours, 0) * toNumber(overtimeRate, 0)).toFixed(2));
}

export function calculateTaxEstimate(grossPay = 0, taxRate = 0) {
  return Number((toNumber(grossPay, 0) * (toNumber(taxRate, 0) / 100)).toFixed(2));
}

export function calculateNationalInsuranceEstimate(grossPay = 0, niRate = 0) {
  return Number((toNumber(grossPay, 0) * (toNumber(niRate, 0) / 100)).toFixed(2));
}

export function calculateAfterTaxTotal(grossPay = 0, taxAmount = 0, niAmount = 0) {
  return Number((toNumber(grossPay, 0) - toNumber(taxAmount, 0) - toNumber(niAmount, 0)).toFixed(2));
}

export function calculateSavingsAccountTotal(entries = [], accountName = "") {
  return Number(
    (entries || [])
      .filter((entry) => String(entry?.accountName || "") === String(accountName || ""))
      .reduce((sum, entry) => sum + toNumber(entry?.amount, 0), 0)
      .toFixed(2)
  );
}

export function calculateAllSavingsTotal(entries = []) {
  return Number(
    (entries || [])
      .reduce((sum, entry) => sum + toNumber(entry?.amount, 0), 0)
      .toFixed(2)
  );
}

export function calculateFuelEntryValues(entry = {}) {
  const totalCost = toNumber(entry.totalCost, 0);
  const litres = toNumber(entry.litres, 0);
  const pricePerLitre = toNumber(entry.pricePerLitre, 0);
  const hasTotal = totalCost > 0;
  const hasLitres = litres > 0;
  const hasPpl = pricePerLitre > 0;

  if (hasLitres && hasPpl && !hasTotal) {
    return {
      totalCost: Number((litres * pricePerLitre).toFixed(2)),
      litres: Number(litres.toFixed(2)),
      pricePerLitre: Number(pricePerLitre.toFixed(3)),
    };
  }
  if (hasTotal && hasLitres && !hasPpl) {
    return {
      totalCost: Number(totalCost.toFixed(2)),
      litres: Number(litres.toFixed(2)),
      pricePerLitre: Number((totalCost / litres).toFixed(3)),
    };
  }
  if (hasTotal && hasPpl && !hasLitres) {
    return {
      totalCost: Number(totalCost.toFixed(2)),
      litres: Number((totalCost / pricePerLitre).toFixed(2)),
      pricePerLitre: Number(pricePerLitre.toFixed(3)),
    };
  }

  return {
    totalCost: Number(totalCost.toFixed(2)),
    litres: Number(litres.toFixed(2)),
    pricePerLitre: Number(pricePerLitre.toFixed(3)),
  };
}

function normaliseTransactionMonth(dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return getCurrentMonthKey(date);
}

function filterTransactionsForMonth(transactions = [], monthKey, type = null) {
  const targetMonthKey = normaliseMonthKey(monthKey);
  return (transactions || []).filter((transaction) => {
    if (type && transaction?.type !== type) return false;
    return normaliseTransactionMonth(transaction?.date) === targetMonthKey;
  });
}

function totalsFromTransactions(transactions = []) {
  return (transactions || []).reduce((accumulator, transaction) => {
    const category = transaction?.category || "Other";
    accumulator[category] = Number(
      (toNumber(accumulator[category], 0) + toNumber(transaction?.amount)).toFixed(2)
    );
    return accumulator;
  }, {});
}

function sortRows(rows = []) {
  return [...rows].sort((left, right) =>
    String(left.category || "").localeCompare(String(right.category || ""))
  );
}

function normalisePlanning(widgetData = {}) {
  return {
    settings: widgetData?.settings && typeof widgetData.settings === "object" ? widgetData.settings : {},
    rules: Array.isArray(widgetData?.rules) ? widgetData.rules : [],
    overrides: Array.isArray(widgetData?.overrides) ? widgetData.overrides : [],
  };
}

function buildRecurringRows(items = [], monthKey, mapItem) {
  return sortRows(
    (items || []).map((item) => ({
      category: mapItem(item).category,
      amount: Number(toNumber(mapItem(item).amount).toFixed(2)),
      source: isFutureMonth(monthKey) ? "projected" : "planned",
      isActual: false,
      isProjected: isFutureMonth(monthKey),
      note: mapItem(item).note || "",
    }))
  );
}

function mergeRows(primaryRows = [], extraRows = []) {
  const map = new Map();
  [...primaryRows, ...extraRows].forEach((row) => {
    const key = row.category || "Other";
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row });
      return;
    }
    map.set(key, {
      ...existing,
      amount: Number((toNumber(existing.amount) + toNumber(row.amount)).toFixed(2)),
      source: existing.isActual || row.isActual ? "actual" : row.source || existing.source,
      isActual: Boolean(existing.isActual || row.isActual),
      isProjected: Boolean(existing.isProjected || row.isProjected),
    });
  });
  return sortRows(Array.from(map.values()));
}

export function createPlanningRule({
  category = "General",
  amount = 0,
  startMonth = getCurrentMonthKey(),
  endMonth = "",
  recurrenceType = "monthly",
  configJson = {},
} = {}) {
  return {
    id: createRuleId(),
    category,
    amount: Number(toNumber(amount).toFixed(2)),
    startMonth: normaliseMonthKey(startMonth),
    endMonth: endMonth ? normaliseMonthKey(endMonth) : "",
    recurrenceType,
    configJson,
  };
}

export function createPlanningOverride({
  category = "General",
  monthKey = getCurrentMonthKey(),
  amount = 0,
  note = "",
} = {}) {
  return {
    id: createOverrideId(),
    category,
    monthKey: normaliseMonthKey(monthKey),
    overrideJson: {
      amount: Number(toNumber(amount).toFixed(2)),
      note,
    },
  };
}

export function calculateMonthlyIncome({
  transactions = [],
  widgetData = {},
  workData = null,
  referenceDate = new Date(),
} = {}) {
  return calculateIncomeForMonth({
    monthKey: getCurrentMonthKey(referenceDate),
    transactions,
    widgetData,
    workData,
  }).total;
}

export function calculateIncomeForMonth({
  monthKey = getCurrentMonthKey(),
  transactions = [],
  widgetData = {},
  workData = null,
  referenceMonthKey = getCurrentMonthKey(),
} = {}) {
  const planning = normalisePlanning(widgetData);
  const actualRows = totalsFromTransactions(filterTransactionsForMonth(transactions, monthKey, "income"));
  const plannedRows = buildRuleRowsForMonth({
    rules: planning.rules,
    overrides: planning.overrides,
    monthKey,
    actualMap: actualRows,
    defaultCategories: ["Base income", "Overtime", "Other income"],
  });

  const hasActual = Object.keys(actualRows).length > 0;
  const useWorkEstimate = planning.settings?.useWorkEstimate !== false;
  const hasRuleAmounts = plannedRows.some((row) => toNumber(row.amount) > 0 && !row.isActual);
  const manualMonthlyIncome = toNumber(widgetData?.manualMonthlyIncome, 0);
  const baseMonthlyIncome = toNumber(planning.settings?.baseMonthlyIncome, 0);
  const workEstimate = useWorkEstimate ? toNumber(workData?.estimatedIncome, 0) : 0;

  if (!hasActual && !hasRuleAmounts) {
    const fallbackAmount = isFutureMonth(monthKey, referenceMonthKey)
      ? baseMonthlyIncome || manualMonthlyIncome || workEstimate
      : manualMonthlyIncome || workEstimate;

    if (fallbackAmount > 0) {
      plannedRows.push({
        category: useWorkEstimate && workEstimate > 0 && fallbackAmount === workEstimate ? "Work estimate" : "Planned income",
        amount: Number(fallbackAmount.toFixed(2)),
        source: isFutureMonth(monthKey, referenceMonthKey) ? "projected" : "planned",
        isActual: false,
        isProjected: isFutureMonth(monthKey, referenceMonthKey),
      });
    }
  }

  const rows = sortRows(plannedRows.filter((row) => toNumber(row.amount) !== 0));
  const total = Number((sumRows(rows) + (hasActual ? 0 : manualMonthlyIncome && hasRuleAmounts ? manualMonthlyIncome : 0)).toFixed(2));

  return {
    monthKey: normaliseMonthKey(monthKey),
    label: formatMonthLabel(monthKey),
    status: deriveMonthStatus(rows, monthKey, referenceMonthKey),
    total,
    rows,
    hasActual,
  };
}

export function calculateRecurringMonthlyTotal(items = []) {
  return Number(
    (items || []).reduce((sum, item) => {
      if (item?.isRecurring === false) {
        return sum;
      }
      return sum + toNumber(item.amount);
    }, 0).toFixed(2)
  );
}

export function calculateBillsForMonth({
  monthKey = getCurrentMonthKey(),
  bills = [],
  widgetData = {},
  referenceMonthKey = getCurrentMonthKey(),
} = {}) {
  const planning = normalisePlanning(widgetData);
  const recurringRows = buildRecurringRows(bills, monthKey, (bill) => ({
    category: bill?.name || "Bill",
    amount: bill?.amount,
    note: bill?.dueDay ? `Due day ${bill.dueDay}` : "",
  }));
  const plannedRows = buildRuleRowsForMonth({
    rules: planning.rules,
    overrides: planning.overrides,
    monthKey,
    defaultCategories: recurringRows.map((row) => row.category),
  });

  const rows = mergeRows(recurringRows, plannedRows).filter((row) => toNumber(row.amount) !== 0);
  return {
    monthKey: normaliseMonthKey(monthKey),
    label: formatMonthLabel(monthKey),
    status: deriveMonthStatus(rows, monthKey, referenceMonthKey),
    total: sumRows(rows),
    rows,
  };
}

export function calculateTotalSpending({
  transactions = [],
  bills = [],
  referenceDate = new Date(),
} = {}) {
  return calculateSpendingForMonth({
    monthKey: getCurrentMonthKey(referenceDate),
    transactions,
    bills,
  }).total;
}

export function calculateSpendingForMonth({
  monthKey = getCurrentMonthKey(),
  transactions = [],
  bills = [],
  widgetData = {},
  referenceMonthKey = getCurrentMonthKey(),
} = {}) {
  const planning = normalisePlanning(widgetData);
  const actualRows = totalsFromTransactions(filterTransactionsForMonth(transactions, monthKey, "expense"));
  const categoryRows = buildRuleRowsForMonth({
    rules: planning.rules,
    overrides: planning.overrides,
    monthKey,
    actualMap: actualRows,
    defaultCategories: ["Fuel", "Food", "Eating out", "Car costs", "Shopping", "Subscriptions"],
  });
  const billTotal = calculateBillsForMonth({
    monthKey,
    bills,
    widgetData: {},
    referenceMonthKey,
  }).total;

  return {
    monthKey: normaliseMonthKey(monthKey),
    label: formatMonthLabel(monthKey),
    status: deriveMonthStatus(categoryRows, monthKey, referenceMonthKey),
    total: Number(sumRows(categoryRows).toFixed(2)),
    rows: categoryRows.filter((row) => toNumber(row.amount) !== 0),
    billTotal,
  };
}

export function calculateMonthlyCategoryTotals({
  transactions = [],
  type = "expense",
  referenceDate = new Date(),
} = {}) {
  return totalsFromTransactions(filterTransactionsForMonth(transactions, getCurrentMonthKey(referenceDate), type));
}

export function calculateFuelForMonth({
  monthKey = getCurrentMonthKey(),
  transactions = [],
  widgetData = {},
  referenceMonthKey = getCurrentMonthKey(),
} = {}) {
  const planning = normalisePlanning(widgetData);
  const fuelEntries = Array.isArray(widgetData?.fuelEntries) ? widgetData.fuelEntries : [];
  const entryTotal = fuelEntries
    .filter((entry) => normaliseMonthKey(entry?.monthKey || monthKey) === normaliseMonthKey(monthKey))
    .reduce((sum, entry) => sum + toNumber(calculateFuelEntryValues(entry).totalCost, 0), 0);
  const actualFuel = totalsFromTransactions(
    filterTransactionsForMonth(transactions, monthKey, "expense").filter(
      (transaction) => String(transaction?.category || "").toLowerCase() === "fuel"
    )
  );
  const rows = buildRuleRowsForMonth({
    rules: planning.rules,
    overrides: planning.overrides,
    monthKey,
    actualMap: Object.keys(actualFuel).length > 0 ? { Fuel: actualFuel.Fuel || 0 } : entryTotal > 0 ? { Fuel: entryTotal } : {},
    defaultCategories: ["Fuel"],
  }).filter((row) => toNumber(row.amount) !== 0);
  return {
    monthKey: normaliseMonthKey(monthKey),
    label: formatMonthLabel(monthKey),
    status: deriveMonthStatus(rows, monthKey, referenceMonthKey),
    total: sumRows(rows),
    rows,
  };
}

export function calculateSavingsProgress(savings = null) {
  const targetAmount = toNumber(savings?.targetAmount, 0);
  const currentAmount = toNumber(savings?.currentAmount, 0);
  const progress = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
  return {
    targetAmount: Number(targetAmount.toFixed(2)),
    currentAmount: Number(currentAmount.toFixed(2)),
    progressPercent: Number(Math.max(0, Math.min(progress, 100)).toFixed(1)),
    remainingAmount: Number(Math.max(targetAmount - currentAmount, 0).toFixed(2)),
  };
}

export function calculateSavingsForMonth({
  monthKey = getCurrentMonthKey(),
  savings = null,
  goals = [],
  widgetData = {},
  referenceMonthKey = getCurrentMonthKey(),
} = {}) {
  const planning = normalisePlanning(widgetData);
  const accountEntries = Array.isArray(widgetData?.accountEntries) ? widgetData.accountEntries : [];
  const accountRows = accountEntries
    .filter((entry) => normaliseMonthKey(entry?.monthKey || monthKey) === normaliseMonthKey(monthKey))
    .map((entry) => ({
      category: entry?.accountName || "Savings account",
      amount: Number(toNumber(entry?.amount, 0).toFixed(2)),
      source: "actual",
      isActual: true,
      isProjected: false,
    }));
  const goalCategories = (goals || []).map((goal) => {
    const type = String(goal?.type || "custom").toLowerCase();
    if (type === "house") return "House";
    if (type === "holiday") return "Holiday";
    return goal?.type || "Custom";
  });
  const rows = mergeRows(accountRows, buildRuleRowsForMonth({
    rules: planning.rules,
    overrides: planning.overrides,
    monthKey,
    defaultCategories: ["House", "Emergency", "Holiday", "Car", ...goalCategories],
  })).filter((row) => toNumber(row.amount) !== 0);
  const totalContribution = sumRows(rows);
  const progress = calculateSavingsProgress(savings);

  return {
    monthKey: normaliseMonthKey(monthKey),
    label: formatMonthLabel(monthKey),
    status: deriveMonthStatus(rows, monthKey, referenceMonthKey),
    total: totalContribution,
    rows,
    currentAmount: progress.currentAmount,
    targetAmount: progress.targetAmount,
    progressPercent: progress.progressPercent,
    remainingAmount: progress.remainingAmount,
  };
}

export function calculateGoalContributionForMonth({
  monthKey = getCurrentMonthKey(),
  widgetData = {},
  defaultCategory = "Goal",
  referenceMonthKey = getCurrentMonthKey(),
} = {}) {
  const planning = normalisePlanning(widgetData);
  const rows = buildRuleRowsForMonth({
    rules: planning.rules,
    overrides: planning.overrides,
    monthKey,
    defaultCategories: [defaultCategory],
  }).filter((row) => toNumber(row.amount) !== 0);
  return {
    monthKey: normaliseMonthKey(monthKey),
    label: formatMonthLabel(monthKey),
    status: deriveMonthStatus(rows, monthKey, referenceMonthKey),
    total: sumRows(rows),
    rows,
  };
}

export function calculateNetPosition({
  monthlyIncome = 0,
  totalSpending = 0,
  savings = null,
  goals = [],
} = {}) {
  const savingsCurrent = toNumber(savings?.currentAmount, 0);
  const goalCurrent = (goals || []).reduce((sum, goal) => sum + toNumber(goal.current), 0);
  return Number((toNumber(monthlyIncome) - toNumber(totalSpending) + savingsCurrent + goalCurrent).toFixed(2));
}

export function calculateNetPositionForMonth({
  monthKey = getCurrentMonthKey(),
  transactions = [],
  bills = [],
  savings = null,
  goals = [],
  widgetData = {},
  widgetDataMap = {},
  workData = null,
  referenceMonthKey = getCurrentMonthKey(),
} = {}) {
  const settings = widgetData?.settings || {};
  const incomeView = calculateIncomeForMonth({
    monthKey,
    transactions,
    widgetData: widgetDataMap?.income?.data || {},
    workData,
    referenceMonthKey,
  });
  const spendingView = calculateSpendingForMonth({
    monthKey,
    transactions,
    bills,
    widgetData: widgetDataMap?.spending?.data || {},
    referenceMonthKey,
  });
  const fuelView = calculateFuelForMonth({
    monthKey,
    transactions,
    widgetData: widgetDataMap?.fuel?.data || {},
    referenceMonthKey,
  });
  const savingsView = calculateSavingsForMonth({
    monthKey,
    savings,
    goals,
    widgetData: widgetDataMap?.savings?.data || {},
    referenceMonthKey,
  });
  const billsView = calculateBillsForMonth({
    monthKey,
    bills,
    widgetData: widgetDataMap?.bills?.data || {},
    referenceMonthKey,
  });

  const includeSavings = settings.includeSavings !== false;
  const includeFuel = settings.includeFuel !== false;
  const includeBills = settings.includeBills !== false;

  const totalSpending = Number(
    (
      spendingView.total +
      (includeBills ? billsView.total : 0) +
      (includeFuel ? fuelView.total : 0) +
      (includeSavings ? savingsView.total : 0)
    ).toFixed(2)
  );
  const net = Number((incomeView.total - totalSpending).toFixed(2));

  return {
    monthKey: normaliseMonthKey(monthKey),
    label: formatMonthLabel(monthKey),
    status:
      incomeView.status === "Actual" && spendingView.status === "Actual"
        ? "Actual"
        : isFutureMonth(monthKey, referenceMonthKey)
          ? "Projected"
          : "Planned",
    total: net,
    monthlyIncome: incomeView.total,
    totalSpending,
    savingsContribution: includeSavings ? savingsView.total : 0,
    fuelContribution: includeFuel ? fuelView.total : 0,
    billsContribution: includeBills ? billsView.total : 0,
    incomeView,
    spendingView,
    savingsView,
    billsView,
    fuelView,
  };
}

export function calculateProjectedSavingsDate(savings = null, referenceDate = new Date()) {
  const targetAmount = toNumber(savings?.targetAmount, 0);
  const currentAmount = toNumber(savings?.currentAmount, 0);
  const monthlyContribution = toNumber(savings?.monthlyContribution, 0);

  if (targetAmount <= currentAmount) {
    return referenceDate.toISOString();
  }

  if (monthlyContribution <= 0) {
    return null;
  }

  const remaining = targetAmount - currentAmount;
  const monthsRequired = Math.ceil(remaining / monthlyContribution);
  const projected = new Date(referenceDate);
  projected.setMonth(projected.getMonth() + monthsRequired);
  return projected.toISOString();
}

export function calculateProjectedSavingsDateForPlan({
  monthKey = getCurrentMonthKey(),
  savings = null,
  goals = [],
  widgetData = {},
} = {}) {
  const monthView = calculateSavingsForMonth({ monthKey, savings, goals, widgetData });
  return calculateProjectedSavingsDate({
    targetAmount: monthView.targetAmount,
    currentAmount: monthView.currentAmount,
    monthlyContribution: monthView.total,
  }, monthKeyToDate(monthKey));
}

export function calculateWidgetMonthView({
  widgetType,
  monthKey = getCurrentMonthKey(),
  datasets = {},
  widgetData = {},
  widgetDataMap = {},
  referenceMonthKey = getCurrentMonthKey(),
} = {}) {
  switch (widgetType) {
    case "income":
      return calculateIncomeForMonth({
        monthKey,
        transactions: datasets.transactions,
        widgetData,
        workData: datasets.workData,
        referenceMonthKey,
      });
    case "spending":
      return calculateSpendingForMonth({
        monthKey,
        transactions: datasets.transactions,
        bills: datasets.bills,
        widgetData,
        referenceMonthKey,
      });
    case "bills":
      return calculateBillsForMonth({
        monthKey,
        bills: datasets.bills,
        widgetData,
        referenceMonthKey,
      });
    case "savings":
      return calculateSavingsForMonth({
        monthKey,
        savings: datasets.savings,
        goals: datasets.goals,
        widgetData,
        referenceMonthKey,
      });
    case "fuel":
      return calculateFuelForMonth({
        monthKey,
        transactions: datasets.transactions,
        widgetData,
        referenceMonthKey,
      });
    case "holiday":
      return calculateGoalContributionForMonth({
        monthKey,
        widgetData,
        defaultCategory: "Holiday",
        referenceMonthKey,
      });
    case "mortgage":
      return calculateGoalContributionForMonth({
        monthKey,
        widgetData,
        defaultCategory: "House",
        referenceMonthKey,
      });
    case "net-position":
      return calculateNetPositionForMonth({
        monthKey,
        transactions: datasets.transactions,
        bills: datasets.bills,
        savings: datasets.savings,
        goals: datasets.goals,
        widgetData,
        widgetDataMap,
        workData: datasets.workData,
        referenceMonthKey,
      });
    case "work-summary":
      return {
        monthKey: normaliseMonthKey(monthKey),
        label: formatMonthLabel(monthKey),
        status: isFutureMonth(monthKey, referenceMonthKey) ? "Projected" : "Actual",
        total: toNumber(datasets.workData?.estimatedIncome, 0),
        rows: [
          { category: "Hours worked", amount: toNumber(datasets.workData?.hoursWorked, 0), source: "actual", isActual: true, isProjected: false },
          { category: "Overtime", amount: toNumber(datasets.workData?.overtimeHours, 0), source: "actual", isActual: true, isProjected: false },
        ],
      };
    default:
      return {
        monthKey: normaliseMonthKey(monthKey),
        label: formatMonthLabel(monthKey),
        status: isFutureMonth(monthKey, referenceMonthKey) ? "Projected" : "Planned",
        total: 0,
        rows: [],
      };
  }
}

export function calculateProjectedTimeline({
  startMonth = getCurrentMonthKey(),
  endMonth = shiftMonthKey(getCurrentMonthKey(), 5),
  datasets = {},
  widgetDataMap = {},
  referenceMonthKey = getCurrentMonthKey(),
} = {}) {
  return buildMonthRange(startMonth, endMonth).map((monthKey) => {
    const netView = calculateNetPositionForMonth({
      monthKey,
      transactions: datasets.transactions,
      bills: datasets.bills,
      savings: datasets.savings,
      goals: datasets.goals,
      widgetData: widgetDataMap?.["net-position"]?.data || {},
      widgetDataMap,
      workData: datasets.workData,
      referenceMonthKey,
    });
    return {
      monthKey,
      label: formatMonthLabel(monthKey),
      income: netView.monthlyIncome,
      spending: netView.totalSpending,
      net: netView.total,
      status: netView.status,
    };
  });
}
