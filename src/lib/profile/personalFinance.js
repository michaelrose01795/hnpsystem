import { expectedMonthlyContractHours, getCurrentMonthKey, normaliseMonthKey, shiftMonthKey } from "@/lib/profile/calculations";

const DEFAULT_PAYMENT_BUCKETS = ["Savings", "LISA", "Fuel", "Holidays", "Grandad", "Joint", "Family"];
const DEFAULT_SAVINGS_BUCKETS = ["Savings"];

export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function roundMoney(value) {
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

function getFinanceYearWeeksWorked(monthKey = getCurrentMonthKey()) {
  const safeMonthKey = normaliseMonthKey(monthKey, getCurrentMonthKey());
  const months = getFinanceYearMonths(safeMonthKey);
  const monthIndex = Math.max(months.indexOf(safeMonthKey), 0);
  return Number((((monthIndex + 1) * 52) / 12).toFixed(2));
}

export function createDefaultMonthFinanceState() {
  return {
    otherIncome: 0,
    incomeAdjustments: 0,
    outgoingAdjustments: 0,
    fixedOutgoings: [],
    plannedPayments: [],
    creditCards: [],
    fuelEntries: [],
    savingsBuckets: [],
    overtimeEntries: [],
  };
}

function stripLegacyPresetRows(items = [], presetNames = []) {
  return (items || []).filter((entry) => {
    const name = String(entry?.name || "").trim();
    const amount = toNumber(entry?.amount, 0);
    if (!presetNames.includes(name)) return true;
    return amount !== 0;
  });
}

function stripLegacyCardRows(items = []) {
  return (items || []).filter((entry) => {
    const name = String(entry?.name || "").trim().toLowerCase();
    const balance = toNumber(entry?.balance, 0);
    const monthlyPayment = toNumber(entry?.monthlyPayment, 0);
    if (name !== "main card") return true;
    return balance !== 0 || monthlyPayment !== 0;
  });
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
    savingsAccounts: [],
    plannedPaymentPlans: [],
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
  const existingPay = rawFinanceState?.paySettings || {};

  // Seed pay settings from DB workData only when the user hasn't set them manually.
  // A value of 0 in existing state is treated as "not yet set" for rates/salary —
  // this lets DB values flow in on first load without overwriting later edits.
  const seedFromDb = (existingValue, dbValue) => {
    if (existingValue !== undefined && existingValue !== null && existingValue !== 0) {
      return existingValue;
    }
    return dbValue ?? existingValue ?? 0;
  };

  const mergedPay = {
    ...base.paySettings,
    ...existingPay,
    contractedWeeklyHours: seedFromDb(existingPay.contractedWeeklyHours, workData?.contractedWeeklyHours),
    hourlyRate: seedFromDb(existingPay.hourlyRate, workData?.hourlyRate),
    overtimeRate: seedFromDb(existingPay.overtimeRate, workData?.overtimeRate),
    annualSalary: seedFromDb(existingPay.annualSalary, workData?.annualSalary),
  };

  const merged = {
    ...base,
    ...(rawFinanceState && typeof rawFinanceState === "object" ? rawFinanceState : {}),
    paySettings: mergedPay,
    savingsAccounts: Array.isArray(rawFinanceState?.savingsAccounts) ? rawFinanceState.savingsAccounts : [],
    plannedPaymentPlans: Array.isArray(rawFinanceState?.plannedPaymentPlans) ? rawFinanceState.plannedPaymentPlans : [],
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
  // Brand-new month — return defaults so first visit gets seeded buckets.
  if (!rawMonthState || typeof rawMonthState !== "object") {
    return createDefaultMonthFinanceState();
  }
  // Existing month — preserve rows exactly as saved.  No compactItems
  // (which would strip unnamed rows) and no fallback to defaults (which
  // would re-seed deleted buckets).
  const base = createDefaultMonthFinanceState();
  return {
    ...base,
    ...rawMonthState,
    fixedOutgoings: Array.isArray(rawMonthState.fixedOutgoings) ? rawMonthState.fixedOutgoings : [],
    plannedPayments: Array.isArray(rawMonthState.plannedPayments)
      ? stripLegacyPresetRows(rawMonthState.plannedPayments, DEFAULT_PAYMENT_BUCKETS)
      : [],
    creditCards: Array.isArray(rawMonthState.creditCards) ? stripLegacyCardRows(rawMonthState.creditCards) : [],
    fuelEntries: Array.isArray(rawMonthState.fuelEntries) ? rawMonthState.fuelEntries : [],
    savingsBuckets: Array.isArray(rawMonthState.savingsBuckets)
      ? stripLegacyPresetRows(rawMonthState.savingsBuckets, DEFAULT_SAVINGS_BUCKETS)
      : [],
    overtimeEntries: Array.isArray(rawMonthState.overtimeEntries) ? rawMonthState.overtimeEntries : [],
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

function isAttendanceOvertimeEntry(entry = {}) {
  const type = String(entry?.type || entry?.status || "").trim().toLowerCase();
  return type === "overtime";
}

function getAttendanceOvertimeHours(workData, monthKey) {
  const logs = Array.isArray(workData?.attendanceLogs) ? workData.attendanceLogs : [];
  const overtimeFromAttendance = logs.reduce((sum, entry) => {
    if (!entry?.date || entry.bulk) return sum; // skip bulk overtime — counted at year level only
    const entryMonth = toOvertimeDateMonthKey(entry.date);
    if (entryMonth !== monthKey || !isAttendanceOvertimeEntry(entry)) return sum;
    return sum + toNumber(entry.totalHours, 0);
  }, 0);

  if (overtimeFromAttendance > 0) {
    return Number(overtimeFromAttendance.toFixed(2));
  }

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

function getBulkOvertimeHoursForYear(workData, financeYearMonths) {
  const logs = Array.isArray(workData?.attendanceLogs) ? workData.attendanceLogs : [];
  const yearMonthSet = new Set(financeYearMonths);
  let total = 0;
  for (const entry of logs) {
    if (!entry?.bulk || !entry?.date) continue;
    const entryMonth = toOvertimeDateMonthKey(entry.date);
    if (entryMonth && yearMonthSet.has(entryMonth)) {
      total += toNumber(entry.totalHours, 0);
    }
  }
  return Number(total.toFixed(2));
}

function getWorkedHoursForMonth(workData, monthKey) {
  const logs = Array.isArray(workData?.attendanceLogs) ? workData.attendanceLogs : [];
  const target = normaliseMonthKey(monthKey, getCurrentMonthKey());
  let total = 0;
  for (const entry of logs) {
    if (!entry?.date) continue;
    const entryMonth = toOvertimeDateMonthKey(entry.date);
    if (entryMonth === target && !isAttendanceOvertimeEntry(entry)) {
      total += toNumber(entry.totalHours, 0);
    }
  }
  return total > 0 ? Number(total.toFixed(2)) : null;
}

function calculateWidgetTaxAmount(taxablePay = 0) {
  return roundMoney(Math.max(toNumber(taxablePay, 0) - 1047.50, 0) * 0.2);
}

function calculateWidgetNationalInsuranceAmount(taxablePay = 0) {
  return roundMoney(Math.max(toNumber(taxablePay, 0) - 1047.50, 0) * 0.08);
}

export function getLeaveForMonth(workData, monthKey) {
  const requests = Array.isArray(workData?.leaveRequests) ? workData.leaveRequests : [];
  const target = normaliseMonthKey(monthKey, getCurrentMonthKey());
  const [targetYear, targetMonth] = target.split("-").map(Number);
  let days = 0;

  for (const request of requests) {
    if (String(request?.status || "").toLowerCase() !== "approved") continue;
    if (!request?.startDate || !request?.endDate) continue;
    const start = new Date(request.startDate);
    const end = new Date(request.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;

    const monthStart = new Date(targetYear, targetMonth - 1, 1);
    const monthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
    const overlapStart = start < monthStart ? monthStart : start;
    const overlapEnd = end > monthEnd ? monthEnd : end;
    if (overlapStart > overlapEnd) continue;

    const overlapDays = Math.round((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
    let weekdays = 0;
    for (let d = 0; d < overlapDays; d++) {
      const day = new Date(overlapStart);
      day.setDate(day.getDate() + d);
      const dow = day.getDay();
      if (dow !== 0 && dow !== 6) weekdays++;
    }
    days += weekdays;
  }
  return days;
}

export function buildMonthlyFinanceSummary({ financeState, workData = null, monthKey }) {
  const safeMonthKey = normaliseMonthKey(monthKey, financeState?.selectedMonthKey || getCurrentMonthKey());
  const paySettings = financeState?.paySettings || {};
  const monthState = getMonthState(financeState, safeMonthKey);

  const expectedHours = expectedMonthlyContractHours(toNumber(paySettings.contractedWeeklyHours, 0), safeMonthKey);
  const workedHours = getWorkedHoursForMonth(workData, safeMonthKey);
  const attendanceOvertimeHours = getAttendanceOvertimeHours(workData, safeMonthKey);
  const manualOvertimeHours = sumOvertimeHours(monthState.overtimeEntries);
  const overtimeHours = Number((attendanceOvertimeHours + manualOvertimeHours).toFixed(2));

  const hourlyRate = toNumber(paySettings.hourlyRate, 0);
  const overtimeRate = toNumber(paySettings.overtimeRate, hourlyRate);
  const annualSalary = toNumber(paySettings.annualSalary, 0);

  const basePay = roundMoney(expectedHours * hourlyRate);
  const overtimePay = roundMoney(overtimeHours * overtimeRate);

  const workIncome = roundMoney(basePay + overtimePay);
  const classicIncome = roundMoney(monthState.otherIncome + monthState.incomeAdjustments);
  const totalIn = roundMoney(workIncome + classicIncome);

  const fixedOut = sumByAmount(monthState.fixedOutgoings);
  const legacyPlannedOut = sumByAmount(monthState.plannedPayments);
  // Sum planned payment plans for this month
  const plans = Array.isArray(financeState?.plannedPaymentPlans) ? financeState.plannedPaymentPlans : [];
  const planPlannedOut = plans.reduce((sum, plan) => {
    if (safeMonthKey >= plan.startMonth && safeMonthKey <= plan.endMonth) {
      return sum + toNumber(plan.monthlyAmounts?.[safeMonthKey], 0);
    }
    return sum;
  }, 0);
  const plannedOut = roundMoney(legacyPlannedOut + planPlannedOut);
  const creditCardOut = sumByAmount(monthState.creditCards, "monthlyPayment");
  const totalCardBalances = sumByAmount(monthState.creditCards, "balance");
  const fuelTotal = roundMoney(sumByAmount(monthState.fuelEntries, "cost"));
  const fuelLitres = Number((monthState.fuelEntries || []).reduce((sum, entry) => sum + toNumber(entry?.litres, 0), 0).toFixed(2));
  const fuelAverageCostPerLitre = fuelLitres > 0 ? Number((fuelTotal / fuelLitres).toFixed(3)) : 0;
  const savingsTotal = sumByAmount(monthState.savingsBuckets);
  const classicOut = roundMoney(fixedOut + plannedOut + toNumber(monthState.outgoingAdjustments, 0));
  const totalOut = roundMoney(classicOut + creditCardOut + fuelTotal + savingsTotal);

  const autoTax = calculateWidgetTaxAmount(totalIn);
  const autoNi = calculateWidgetNationalInsuranceAmount(totalIn);
  const tax = paySettings.useManualTax ? roundMoney(paySettings.manualTax) : roundMoney(autoTax);
  const nationalInsurance = paySettings.useManualTax ? roundMoney(paySettings.manualNationalInsurance) : roundMoney(autoNi);
  const afterTaxIncome = roundMoney(totalIn - tax - nationalInsurance);

  const difference = roundMoney(totalIn - totalOut);
  const moneyLeftAfterTax = roundMoney(afterTaxIncome - totalOut);

  const planOutgoings = plans
    .filter((plan) => safeMonthKey >= plan.startMonth && safeMonthKey <= plan.endMonth && toNumber(plan.monthlyAmounts?.[safeMonthKey], 0) > 0)
    .map((plan) => ({ category: plan.name, amount: roundMoney(toNumber(plan.monthlyAmounts?.[safeMonthKey], 0)), kind: "Planned" }));
  const biggestOutgoing = [
    ...monthState.fixedOutgoings.map((item) => ({ category: item.name, amount: roundMoney(item.amount), kind: "Fixed" })),
    ...monthState.plannedPayments.map((item) => ({ category: item.name, amount: roundMoney(item.amount), kind: "Planned" })),
    ...planOutgoings,
    ...monthState.creditCards.map((item) => ({ category: item.name, amount: roundMoney(item.monthlyPayment), kind: "Credit" })),
    ...monthState.fuelEntries.map((item) => ({ category: item.name || "Fuel", amount: roundMoney(item.cost), kind: "Fuel" })),
    ...monthState.savingsBuckets.map((item) => ({ category: item.name, amount: roundMoney(item.amount), kind: "Savings" })),
  ]
    .filter((entry) => entry.amount > 0)
    .sort((left, right) => right.amount - left.amount)[0] || null;

  const leaveDaysInMonth = getLeaveForMonth(workData, safeMonthKey);

  return {
    monthKey: safeMonthKey,
    pay: {
      expectedHours,
      workedHours,
      actualHoursWorked: workedHours,
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
      leaveDaysInMonth,
    },
    totals: {
      classicIncome,
      totalIn,
      fixedOut,
      plannedOut,
      creditCardOut,
      totalCardBalances,
      fuelTotal,
      fuelLitres,
      fuelAverageCostPerLitre,
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
  const contractedWeeklyHours = toNumber(financeState?.paySettings?.contractedWeeklyHours, 0);
  const financeYearWorkedHours = Number((contractedWeeklyHours * getFinanceYearWeeksWorked(safeMonthKey)).toFixed(2));
  const yearRows = financeYearMonths.map((rowMonthKey) => buildMonthlyFinanceSummary({ financeState, workData, monthKey: rowMonthKey }));

  const yearTotals = yearRows.reduce(
    (accumulator, row) => ({
      totalIn: roundMoney(accumulator.totalIn + row.totals.totalIn),
      totalOut: roundMoney(accumulator.totalOut + row.totals.totalOut),
      difference: roundMoney(accumulator.difference + row.totals.difference),
      savingsTotal: roundMoney(accumulator.savingsTotal + row.totals.savingsTotal),
      totalAfterTax: roundMoney(accumulator.totalAfterTax + row.pay.afterTaxIncome),
      totalTax: roundMoney(accumulator.totalTax + row.pay.tax),
      totalNationalInsurance: roundMoney(accumulator.totalNationalInsurance + row.pay.nationalInsurance),
      overtimeHours: Number((accumulator.overtimeHours + toNumber(row.pay.overtimeHours, 0)).toFixed(2)),
      basePay: roundMoney(accumulator.basePay + row.pay.basePay),
      overtimePay: roundMoney(accumulator.overtimePay + row.pay.overtimePay),
    }),
    {
      totalIn: 0,
      totalOut: 0,
      difference: 0,
      savingsTotal: 0,
      totalAfterTax: 0,
      totalTax: 0,
      totalNationalInsurance: 0,
      overtimeHours: 0,
      basePay: 0,
      overtimePay: 0,
    }
  );
  yearTotals.workedHours = financeYearWorkedHours;

  // Add bulk overtime hours (year-level entries not tied to a single month)
  const bulkOvertimeHours = getBulkOvertimeHoursForYear(workData, financeYearMonths);
  yearTotals.bulkOvertimeHours = bulkOvertimeHours;
  yearTotals.overtimeHours = Number((yearTotals.overtimeHours + bulkOvertimeHours).toFixed(2));
  const overtimeRate = toNumber(financeState?.paySettings?.overtimeRate, toNumber(financeState?.paySettings?.hourlyRate, 0));
  yearTotals.overtimePay = roundMoney(yearTotals.overtimePay + bulkOvertimeHours * overtimeRate);

  // Compute per-account savings balances up to selected month
  const savingsAccounts = Array.isArray(financeState?.savingsAccounts) ? financeState.savingsAccounts : [];
  const savingsAccountBalances = savingsAccounts.map((account) => {
    let balance = roundMoney(toNumber(account.openingBalance, 0));
    let monthActivity = 0;
    let monthInflow = 0;
    let monthOutflow = 0;
    // Walk all months in chronological order up to and including selected month
    const allMonthKeys = Object.keys(financeState?.months || {}).sort();
    for (const mk of allMonthKeys) {
      const ms = financeState.months[mk];
      const buckets = Array.isArray(ms?.savingsBuckets) ? ms.savingsBuckets : [];
      const accountTransactions = buckets.filter((b) => b.accountId === account.id);
      for (const txn of accountTransactions) {
        const amt = toNumber(txn.amount, 0);
        if (txn.type === "withdrawal") {
          balance = roundMoney(balance - amt);
        } else {
          balance = roundMoney(balance + amt);
        }
      }
      if (mk === safeMonthKey) {
        monthActivity = accountTransactions.reduce((sum, txn) => {
          const amt = toNumber(txn.amount, 0);
          return txn.type === "withdrawal" ? sum - amt : sum + amt;
        }, 0);
        monthInflow = accountTransactions.reduce((sum, txn) => {
          if (txn.type === "withdrawal") return sum;
          return sum + toNumber(txn.amount, 0);
        }, 0);
        monthOutflow = accountTransactions.reduce((sum, txn) => {
          if (txn.type !== "withdrawal") return sum;
          return sum + toNumber(txn.amount, 0);
        }, 0);
      }
      if (mk > safeMonthKey) break;
    }
    return {
      ...account,
      currentBalance: balance,
      monthActivity: roundMoney(monthActivity),
      monthInflow: roundMoney(monthInflow),
      monthOutflow: roundMoney(monthOutflow),
    };
  });
  const savingsAccountGroupsMap = new Map();
  savingsAccountBalances.forEach((account) => {
    const groupName = String(account.parentGroup || "").trim();
    if (!groupName) return;
    if (!savingsAccountGroupsMap.has(groupName)) {
      savingsAccountGroupsMap.set(groupName, {
        id: `group-${groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "savings"}`,
        name: groupName,
        currentBalance: 0,
        monthActivity: 0,
        monthInflow: 0,
        monthOutflow: 0,
        accounts: [],
      });
    }
    const group = savingsAccountGroupsMap.get(groupName);
    group.currentBalance = roundMoney(group.currentBalance + toNumber(account.currentBalance, 0));
    group.monthActivity = roundMoney(group.monthActivity + toNumber(account.monthActivity, 0));
    group.monthInflow = roundMoney(group.monthInflow + toNumber(account.monthInflow, 0));
    group.monthOutflow = roundMoney(group.monthOutflow + toNumber(account.monthOutflow, 0));
    group.accounts.push(account);
  });
  const savingsAccountGroups = Array.from(savingsAccountGroupsMap.values())
    .map((group) => {
      const sortedAccounts = [...group.accounts].sort((left, right) =>
        String(left.name || "").localeCompare(String(right.name || ""))
      );
      return {
        ...group,
        accounts: sortedAccounts,
      };
    })
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));

  // Compute planned payment plan details for the selected month
  const paymentPlans = Array.isArray(financeState?.plannedPaymentPlans) ? financeState.plannedPaymentPlans : [];
  const plannedPaymentPlanDetails = paymentPlans.map((plan) => {
    const months = getMonthRange(plan.startMonth, plan.endMonth);
    const thisMonthAmount = toNumber(plan.monthlyAmounts?.[safeMonthKey], 0);
    const totalAcrossMonths = months.reduce((sum, mk) => sum + toNumber(plan.monthlyAmounts?.[mk], 0), 0);
    const isActiveThisMonth = safeMonthKey >= plan.startMonth && safeMonthKey <= plan.endMonth;
    return {
      ...plan,
      months,
      thisMonthAmount: roundMoney(thisMonthAmount),
      totalAcrossMonths: roundMoney(totalAcrossMonths),
      isActiveThisMonth,
    };
  });

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
    savingsAccountBalances,
    savingsAccountGroups,
    plannedPaymentPlanDetails,
    insights: insights.slice(0, 3),
  };
}

export function updateMonthCollection(monthState, key, nextItems) {
  return {
    ...monthState,
    [key]: Array.isArray(nextItems) ? nextItems : [],
  };
}

export function makeSavingsAccount(name = "", interestRate = 0, openingBalance = 0, parentGroup = "") {
  return {
    id: makeId("sa"),
    name,
    interestRate: toNumber(interestRate),
    openingBalance: toNumber(openingBalance),
    parentGroup: String(parentGroup || "").trim(),
  };
}

export function makePlannedPaymentPlan(name = "", startMonth = getCurrentMonthKey(), endMonth = getCurrentMonthKey()) {
  return { id: makeId("pp"), name, startMonth, endMonth, monthlyAmounts: {} };
}

/** Generate all month keys between start and end inclusive. */
function getMonthRange(startMonth, endMonth) {
  const months = [];
  let current = normaliseMonthKey(startMonth, getCurrentMonthKey());
  const end = normaliseMonthKey(endMonth, getCurrentMonthKey());
  for (let i = 0; i < 120; i++) {
    months.push(current);
    if (current >= end) break;
    current = shiftMonthKey(current, 1);
  }
  return months;
}

export function makeSavingsTransaction(accountId = "", amount = 0, type = "deposit") {
  return { id: makeId("st"), accountId, amount: toNumber(amount), type };
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

export function makeFuelEntry({ cost = 0, litres = 0, costPerLitre = 0, date = "" } = {}) {
  return {
    id: makeId("fuel"),
    name: "Fuel",
    date,
    cost: roundMoney(cost),
    litres: Number(toNumber(litres, 0).toFixed(2)),
    costPerLitre: Number(toNumber(costPerLitre, 0).toFixed(3)),
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

// === Work profile adapter (merged from workDataAdapter.js) ===

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return null;
}

function getCurrentCycleBounds(referenceDate = new Date()) {
  const day = referenceDate.getDate();
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();

  if (day >= 26) {
    return {
      start: new Date(year, month, 26),
      end: new Date(year, month + 1, 25, 23, 59, 59, 999),
    };
  }

  return {
    start: new Date(year, month - 1, 26),
    end: new Date(year, month, 25, 23, 59, 59, 999),
  };
}

function countLeaveDays(leaveRequests = []) {
  return (leaveRequests || []).reduce(
    (sum, request) => sum + toNumber(request?.totalDays, 0),
    0
  );
}

export function adaptWorkProfileData(profilePayload = {}) {
  const profile = profilePayload?.profile || null;
  const attendanceLogs = Array.isArray(profilePayload?.attendanceLogs) ? profilePayload.attendanceLogs : [];
  const overtimeSessions = Array.isArray(profilePayload?.overtimeSessions) ? profilePayload.overtimeSessions : [];
  const leaveBalance = profilePayload?.leaveBalance || null;
  const leaveRequests = Array.isArray(profilePayload?.leaveRequests) ? profilePayload.leaveRequests : [];
  const { start, end } = getCurrentCycleBounds();

  let hoursWorked = 0;

  attendanceLogs.forEach((entry) => {
    if (!entry?.date) return;
    const entryDate = new Date(entry.date);
    if (Number.isNaN(entryDate.getTime()) || entryDate < start || entryDate > end) {
      return;
    }

    hoursWorked += toNumber(entry.totalHours, 0);
  });

  const overtimeHours = overtimeSessions.reduce((sum, session) => sum + toNumber(session?.totalHours, 0), 0);
  const hourlyRate = toNumber(profile?.hourlyRate, 0);
  const overtimeRate = toNumber(profile?.overtimeRate, 0);
  const annualSalary = toNumber(firstDefined(profile?.annualSalary, profile?.annual_salary), 0);
  const contractedWeeklyHours = toNumber(
    firstDefined(
      profile?.contractedWeeklyHours,
      profile?.contracted_hours_per_week,
      profile?.weeklyHours,
      profile?.hoursPerWeek
    ),
    0
  );
  const baseMonthlyFromSalary = annualSalary > 0 ? annualSalary / 12 : 0;
  const overtimeValue = overtimeHours * (overtimeRate || hourlyRate);
  const estimatedIncome = baseMonthlyFromSalary > 0
    ? baseMonthlyFromSalary + overtimeValue
    : (hoursWorked * hourlyRate) + overtimeValue;

  return {
    hoursWorked: Number(hoursWorked.toFixed(2)),
    overtimeHours: Number(overtimeHours.toFixed(2)),
    overtimeValue: Number(overtimeValue.toFixed(2)),
    estimatedIncome: Number(estimatedIncome.toFixed(2)),
    contractedWeeklyHours: Number(contractedWeeklyHours.toFixed(2)),
    hourlyRate: Number(hourlyRate.toFixed(2)),
    overtimeRate: Number(overtimeRate.toFixed(2)),
    annualSalary: Number(annualSalary.toFixed(2)),
    leaveRemaining: leaveBalance?.remaining ?? null,
    leaveTaken: leaveBalance?.taken ?? countLeaveDays(leaveRequests),
    leaveAllowance: leaveBalance?.entitlement ?? null,
    leaveRequests,
    overtimeSessions,
    attendanceLogs,
  };
}

// === Derived model selectors (merged from personalModel.js) ===

export function calculateExpectedWorkDays(monthKey = getCurrentMonthKey()) {
  const safe = normaliseMonthKey(monthKey, getCurrentMonthKey());
  const [yearStr, monthStr] = safe.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let weekdays = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dow = new Date(year, month, day).getDay();
    if (dow !== 0 && dow !== 6) weekdays += 1;
  }
  return weekdays;
}

export function calculateLeaveStats(workData = null) {
  const leaveRequests = Array.isArray(workData?.leaveRequests) ? workData.leaveRequests : [];
  const approved = leaveRequests.filter(
    (r) => String(r?.status || "").toLowerCase() === "approved"
  );

  const workDaysTaken = approved.reduce(
    (sum, r) => sum + toNumber(r?.totalDays, 0),
    0
  );

  const calendarDaysTaken = approved.reduce((sum, r) => {
    if (!r?.startDate || !r?.endDate) return sum;
    const start = new Date(r.startDate);
    const end = new Date(r.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return sum;
    return sum + Math.max(Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1, 0);
  }, 0);

  return {
    workDaysTaken: Number(workDaysTaken.toFixed(1)),
    calendarDaysTaken,
    remaining: workData?.leaveRemaining ?? null,
    allowance: workData?.leaveAllowance ?? null,
    taken: workData?.leaveTaken ?? workDaysTaken,
    approvedRequests: approved.slice(0, 6),
  };
}

export function buildDerivedModel({ financeModel = null, workData = null } = {}) {
  const monthKey = financeModel?.selectedMonthKey || getCurrentMonthKey();
  const currentMonth = financeModel?.currentMonth || null;
  const pay = currentMonth?.pay || {};
  const totals = currentMonth?.totals || {};

  const expectedWorkDays = calculateExpectedWorkDays(monthKey);
  const leaveStats = calculateLeaveStats(workData);

  return {
    expectedWorkDays,
    expectedHours: pay.expectedHours || 0,
    workedHours: pay.workedHours ?? null,
    actualHoursWorked: pay.actualHoursWorked ?? null,
    leaveDaysInMonth: pay.leaveDaysInMonth || 0,
    totalIncome: totals.totalIn || 0,
    basePay: pay.basePay || 0,
    overtimePay: pay.overtimePay || 0,
    overtimeHours: pay.overtimeHours || 0,
    afterTaxIncome: pay.afterTaxIncome || 0,
    tax: pay.tax || 0,
    nationalInsurance: pay.nationalInsurance || 0,
    totalOutgoings: totals.totalOut || 0,
    fixedOutgoings: totals.fixedOut || 0,
    plannedPayments: totals.plannedOut || 0,
    creditCardPayments: totals.creditCardOut || 0,
    totalCardBalances: totals.totalCardBalances || 0,
    savingsTotal: totals.savingsTotal || 0,
    netRemaining: totals.difference || 0,
    moneyLeftAfterTax: totals.moneyLeftAfterTax || 0,
    deltaFromPrevious: financeModel?.deltaFromPrevious || 0,
    leaveStats,
    yearTotalIn: financeModel?.yearTotals?.totalIn || 0,
    yearTotalOut: financeModel?.yearTotals?.totalOut || 0,
    yearDifference: financeModel?.yearTotals?.difference || 0,
    yearSavings: financeModel?.yearTotals?.savingsTotal || 0,
    yearAfterTaxIncome: financeModel?.yearTotals?.totalAfterTax || 0,
    yearTax: financeModel?.yearTotals?.totalTax || 0,
    yearNationalInsurance: financeModel?.yearTotals?.totalNationalInsurance || 0,
    yearWorkedHours: financeModel?.yearTotals?.workedHours || 0,
    yearOvertimeHours: financeModel?.yearTotals?.overtimeHours || 0,
    yearOvertimePay: financeModel?.yearTotals?.overtimePay || 0,
  };
}
