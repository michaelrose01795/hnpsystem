import { calculateNationalInsuranceEstimate, calculateTaxEstimate, expectedMonthlyContractHours } from "@/lib/profile/calculations";
import { getCurrentMonthKey, normaliseMonthKey, shiftMonthKey } from "@/lib/profile/monthPlanning";

const DEFAULT_PAYMENT_BUCKETS = ["Savings", "LISA", "Fuel", "Holidays", "Grandad", "Joint", "Family"];

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value) {
  return Number(toNumber(value).toFixed(2));
}

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function compactItems(items = []) {
  return (items || []).filter((entry) => entry && String(entry.name || entry.category || "").trim().length > 0);
}

export function getFinanceYearLabel(monthKey = getCurrentMonthKey()) {
  const safeMonthKey = normaliseMonthKey(monthKey, getCurrentMonthKey());
  const [yearText, monthText] = safeMonthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return `${startYear} Apr - ${endYear} Mar`;
}

export function getFinanceYearMonths(monthKey = getCurrentMonthKey()) {
  const safeMonthKey = normaliseMonthKey(monthKey, getCurrentMonthKey());
  const [yearText, monthText] = safeMonthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const startYear = month >= 4 ? year : year - 1;
  const months = [];
  for (let index = 0; index < 12; index += 1) {
    const m = 4 + index;
    const y = m > 12 ? startYear + 1 : startYear;
    const monthValue = m > 12 ? m - 12 : m;
    months.push(`${y}-${String(monthValue).padStart(2, "0")}`);
  }
  return months;
}

export function createDefaultMonthFinanceState() {
  return {
    otherIncome: 0,
    incomeAdjustments: 0,
    outgoingAdjustments: 0,
    fixedOutgoings: [],
    plannedPayments: DEFAULT_PAYMENT_BUCKETS.map((name) => ({ id: makeId("pay"), name, amount: 0 })),
    creditCards: [{ id: makeId("card"), name: "Main card", balance: 0, monthlyPayment: 0 }],
    savingsBuckets: [{ id: makeId("save"), name: "Savings", amount: 0 }],
    overtimeEntries: [],
  };
}

export function createDefaultFinanceState({ workData = null, monthKey = getCurrentMonthKey() } = {}) {
  return {
    version: 2,
    selectedMonthKey: normaliseMonthKey(monthKey, getCurrentMonthKey()),
    selectedFinanceYear: getFinanceYearLabel(monthKey),
    paySettings: {
      contractedWeeklyHours: toNumber(workData?.contractedWeeklyHours, 37.5),
      hourlyRate: toNumber(workData?.hourlyRate, 0),
      overtimeRate: toNumber(workData?.overtimeRate, toNumber(workData?.hourlyRate, 0)),
      annualSalary: toNumber(workData?.annualSalary, 0),
      manualTax: 0,
      manualNationalInsurance: 0,
      useManualTax: false,
    },
    months: {
      [normaliseMonthKey(monthKey, getCurrentMonthKey())]: createDefaultMonthFinanceState(),
    },
    ui: {
      collapsed: {},
    },
  };
}

export function ensureFinanceState(rawFinanceState = null, { workData = null, monthKey = getCurrentMonthKey() } = {}) {
  const base = createDefaultFinanceState({ workData, monthKey });
  const merged = {
    ...base,
    ...(rawFinanceState && typeof rawFinanceState === "object" ? rawFinanceState : {}),
    paySettings: {
      ...base.paySettings,
      ...(rawFinanceState?.paySettings || {}),
    },
    months: {
      ...(rawFinanceState?.months || {}),
    },
    ui: {
      ...base.ui,
      ...(rawFinanceState?.ui || {}),
      collapsed: {
        ...base.ui.collapsed,
        ...(rawFinanceState?.ui?.collapsed || {}),
      },
    },
  };

  const safeMonthKey = normaliseMonthKey(merged.selectedMonthKey, monthKey);
  merged.selectedMonthKey = safeMonthKey;
  merged.selectedFinanceYear = getFinanceYearLabel(safeMonthKey);
  merged.months[safeMonthKey] = ensureMonthFinanceState(merged.months[safeMonthKey]);
  return merged;
}

export function ensureMonthFinanceState(rawMonthState = null) {
  const base = createDefaultMonthFinanceState();
  return {
    ...base,
    ...(rawMonthState && typeof rawMonthState === "object" ? rawMonthState : {}),
    fixedOutgoings: compactItems(rawMonthState?.fixedOutgoings || []),
    plannedPayments: compactItems(rawMonthState?.plannedPayments || base.plannedPayments),
    creditCards: compactItems(rawMonthState?.creditCards || base.creditCards),
    savingsBuckets: compactItems(rawMonthState?.savingsBuckets || base.savingsBuckets),
    overtimeEntries: Array.isArray(rawMonthState?.overtimeEntries) ? rawMonthState.overtimeEntries : [],
  };
}

function getMonthState(financeState, monthKey) {
  const safeMonthKey = normaliseMonthKey(monthKey, financeState?.selectedMonthKey || getCurrentMonthKey());
  return ensureMonthFinanceState(financeState?.months?.[safeMonthKey]);
}

function sumByAmount(items = [], key = "amount") {
  return roundMoney((items || []).reduce((sum, entry) => sum + toNumber(entry?.[key], 0), 0));
}

function sumOvertimeHours(entries = []) {
  return Number((entries || []).reduce((sum, entry) => sum + toNumber(entry?.hours, 0), 0).toFixed(2));
}

function toOvertimeDateMonthKey(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
}

function getAttendanceOvertimeHours(workData, monthKey) {
  const sessions = Array.isArray(workData?.overtimeSessions) ? workData.overtimeSessions : [];
  const targetedSessions = sessions.filter((session) => {
    const sessionMonth = toOvertimeDateMonthKey(session?.date || session?.createdAt || session?.created_at);
    return sessionMonth === monthKey;
  });

  if (targetedSessions.length > 0) {
    return Number(targetedSessions.reduce((sum, session) => sum + toNumber(session?.totalHours, 0), 0).toFixed(2));
  }

  if (monthKey === getCurrentMonthKey()) {
    return Number(toNumber(workData?.overtimeHours, 0).toFixed(2));
  }
  return 0;
}

export function buildMonthlyFinanceSummary({ financeState, workData = null, monthKey }) {
  const safeMonthKey = normaliseMonthKey(monthKey, financeState?.selectedMonthKey || getCurrentMonthKey());
  const paySettings = financeState?.paySettings || {};
  const monthState = getMonthState(financeState, safeMonthKey);

  const expectedHours = expectedMonthlyContractHours(toNumber(paySettings.contractedWeeklyHours, 0), safeMonthKey);
  const attendanceOvertimeHours = getAttendanceOvertimeHours(workData, safeMonthKey);
  const manualOvertimeHours = sumOvertimeHours(monthState.overtimeEntries);
  const overtimeHours = Number((attendanceOvertimeHours + manualOvertimeHours).toFixed(2));

  const hourlyRate = toNumber(paySettings.hourlyRate, 0);
  const overtimeRate = toNumber(paySettings.overtimeRate, hourlyRate);
  const annualSalary = toNumber(paySettings.annualSalary, 0);
  const basePay = annualSalary > 0 ? roundMoney(annualSalary / 12) : roundMoney(expectedHours * hourlyRate);
  const overtimePay = roundMoney(overtimeHours * overtimeRate);

  const workIncome = roundMoney(basePay + overtimePay);
  const classicIncome = roundMoney(monthState.otherIncome + monthState.incomeAdjustments);
  const totalIn = roundMoney(workIncome + classicIncome);

  const fixedOut = sumByAmount(monthState.fixedOutgoings);
  const plannedOut = sumByAmount(monthState.plannedPayments);
  const creditCardOut = sumByAmount(monthState.creditCards, "monthlyPayment");
  const savingsTotal = sumByAmount(monthState.savingsBuckets);
  const classicOut = roundMoney(fixedOut + plannedOut + toNumber(monthState.outgoingAdjustments, 0));
  const totalOut = roundMoney(classicOut + creditCardOut + savingsTotal);

  const autoTax = calculateTaxEstimate(workIncome);
  const autoNi = calculateNationalInsuranceEstimate(workIncome);
  const tax = paySettings.useManualTax ? roundMoney(paySettings.manualTax) : roundMoney(autoTax);
  const nationalInsurance = paySettings.useManualTax ? roundMoney(paySettings.manualNationalInsurance) : roundMoney(autoNi);
  const afterTaxIncome = roundMoney(totalIn - tax - nationalInsurance);

  const difference = roundMoney(totalIn - totalOut);
  const moneyLeftAfterTax = roundMoney(afterTaxIncome - totalOut);

  const biggestOutgoing = [
    ...monthState.fixedOutgoings.map((item) => ({ category: item.name, amount: roundMoney(item.amount), kind: "Fixed" })),
    ...monthState.plannedPayments.map((item) => ({ category: item.name, amount: roundMoney(item.amount), kind: "Planned" })),
    ...monthState.creditCards.map((item) => ({ category: item.name, amount: roundMoney(item.monthlyPayment), kind: "Credit" })),
    ...monthState.savingsBuckets.map((item) => ({ category: item.name, amount: roundMoney(item.amount), kind: "Savings" })),
  ]
    .filter((entry) => entry.amount > 0)
    .sort((left, right) => right.amount - left.amount)[0] || null;

  return {
    monthKey: safeMonthKey,
    pay: {
      expectedHours,
      attendanceOvertimeHours,
      manualOvertimeHours,
      overtimeHours,
      hourlyRate,
      overtimeRate,
      basePay,
      overtimePay,
      workIncome,
      tax,
      nationalInsurance,
      afterTaxIncome,
    },
    totals: {
      classicIncome,
      totalIn,
      fixedOut,
      plannedOut,
      creditCardOut,
      savingsTotal,
      classicOut,
      totalOut,
      difference,
      moneyLeftAfterTax,
    },
    monthState,
    biggestOutgoing,
  };
}

export function buildFinanceDashboardModel({ financeState, workData = null, monthKey }) {
  const safeMonthKey = normaliseMonthKey(monthKey, financeState?.selectedMonthKey || getCurrentMonthKey());
  const currentMonth = buildMonthlyFinanceSummary({ financeState, workData, monthKey: safeMonthKey });
  const previousMonthKey = shiftMonthKey(safeMonthKey, -1);
  const previousMonth = buildMonthlyFinanceSummary({ financeState, workData, monthKey: previousMonthKey });

  const financeYearMonths = getFinanceYearMonths(safeMonthKey);
  const yearRows = financeYearMonths.map((rowMonthKey) => buildMonthlyFinanceSummary({ financeState, workData, monthKey: rowMonthKey }));

  const yearTotals = yearRows.reduce(
    (accumulator, row) => ({
      totalIn: roundMoney(accumulator.totalIn + row.totals.totalIn),
      totalOut: roundMoney(accumulator.totalOut + row.totals.totalOut),
      difference: roundMoney(accumulator.difference + row.totals.difference),
      savingsTotal: roundMoney(accumulator.savingsTotal + row.totals.savingsTotal),
      overtimePay: roundMoney(accumulator.overtimePay + row.pay.overtimePay),
    }),
    { totalIn: 0, totalOut: 0, difference: 0, savingsTotal: 0, overtimePay: 0 }
  );

  const deltaFromPrevious = roundMoney(currentMonth.totals.difference - previousMonth.totals.difference);
  const biggestOutgoingName = currentMonth.biggestOutgoing
    ? `${currentMonth.biggestOutgoing.category} (${currentMonth.biggestOutgoing.kind})`
    : null;

  const insights = [];
  if (currentMonth.totals.creditCardOut > currentMonth.totals.savingsTotal && currentMonth.totals.creditCardOut > 0) {
    insights.push({
      type: "warning",
      message: "Credit card payments are higher than planned savings this month.",
    });
  }
  if (currentMonth.totals.plannedOut + currentMonth.totals.fixedOut > currentMonth.totals.totalIn) {
    insights.push({
      type: "warning",
      message: "Planned allocations and fixed outgoings exceed total incoming money.",
    });
  }
  if (currentMonth.pay.overtimePay > currentMonth.pay.basePay * 0.25 && currentMonth.pay.overtimePay > 0) {
    insights.push({
      type: "info",
      message: "Overtime is carrying more than 25% of work income this month.",
    });
  }
  if (biggestOutgoingName) {
    insights.push({
      type: "info",
      message: `Largest outgoing: ${biggestOutgoingName} at £${currentMonth.biggestOutgoing.amount.toFixed(2)}.`,
    });
  }
  if (insights.length === 0) {
    insights.push({ type: "positive", message: "Month is balanced with no immediate finance warnings." });
  }

  return {
    selectedMonthKey: safeMonthKey,
    selectedFinanceYear: getFinanceYearLabel(safeMonthKey),
    currentMonth,
    previousMonth,
    deltaFromPrevious,
    financeYearMonths,
    yearRows,
    yearTotals,
    insights: insights.slice(0, 3),
  };
}

export function updateMonthCollection(monthState, key, nextItems) {
  return {
    ...monthState,
    [key]: Array.isArray(nextItems) ? nextItems : [],
  };
}

export function makeCollectionItem(name = "", amount = 0) {
  return {
    id: makeId("row"),
    name,
    amount: roundMoney(amount),
  };
}

export function makeCreditCardItem(name = "Card") {
  return {
    id: makeId("card"),
    name,
    balance: 0,
    monthlyPayment: 0,
  };
}

export function makeOvertimeEntry(monthKey = getCurrentMonthKey()) {
  const date = `${monthKey}-01`;
  return {
    id: makeId("ot"),
    date,
    hours: 0,
    note: "",
  };
}
