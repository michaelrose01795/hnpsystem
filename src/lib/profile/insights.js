import {
  calculateBillsForMonth,
  calculateFuelForMonth,
  calculateIncomeForMonth,
  calculateNetPositionForMonth,
  calculateProjectedTimeline,
  calculateSavingsForMonth,
  calculateSpendingForMonth,
} from "@/lib/profile/calculations";
import { formatMonthLabel, getCurrentMonthKey, shiftMonthKey } from "@/lib/profile/monthPlanning";

function formatMoney(value) {
  return `£${Number(value || 0).toFixed(2)}`;
}

export function buildPersonalInsights({
  transactions = [],
  bills = [],
  savings = null,
  goals = [],
  workData = null,
  widgetData = {},
  monthKey = getCurrentMonthKey(),
} = {}) {
  const insights = [];
  const currentMonthKey = getCurrentMonthKey();

  const incomeView = calculateIncomeForMonth({
    monthKey,
    transactions,
    widgetData: widgetData?.income?.data || widgetData?.income || {},
    workData,
    referenceMonthKey: currentMonthKey,
  });
  const spendingView = calculateSpendingForMonth({
    monthKey,
    transactions,
    bills,
    widgetData: widgetData?.spending?.data || widgetData?.spending || {},
    referenceMonthKey: currentMonthKey,
  });
  const savingsView = calculateSavingsForMonth({
    monthKey,
    savings,
    goals,
    widgetData: widgetData?.savings?.data || widgetData?.savings || {},
    referenceMonthKey: currentMonthKey,
  });
  const billsView = calculateBillsForMonth({
    monthKey,
    bills,
    widgetData: widgetData?.bills?.data || widgetData?.bills || {},
    referenceMonthKey: currentMonthKey,
  });
  const fuelView = calculateFuelForMonth({
    monthKey,
    transactions,
    widgetData: widgetData?.fuel?.data || widgetData?.fuel || {},
    referenceMonthKey: currentMonthKey,
  });
  const netView = calculateNetPositionForMonth({
    monthKey,
    transactions,
    bills,
    savings,
    goals,
    widgetData: widgetData?.["net-position"]?.data || widgetData?.["net-position"] || {},
    widgetDataMap: widgetData,
    workData,
    referenceMonthKey: currentMonthKey,
  });

  const previousMonthKey = shiftMonthKey(monthKey, -1);
  const previousSpending = calculateSpendingForMonth({
    monthKey: previousMonthKey,
    transactions,
    bills,
    widgetData: widgetData?.spending?.data || widgetData?.spending || {},
    referenceMonthKey: currentMonthKey,
  });
  const previousFuel = calculateFuelForMonth({
    monthKey: previousMonthKey,
    transactions,
    widgetData: widgetData?.fuel?.data || widgetData?.fuel || {},
    referenceMonthKey: currentMonthKey,
  });

  if (previousSpending.total > 0 && spendingView.total > previousSpending.total * 1.12) {
    insights.push({
      type: "warning",
      monthLabel: formatMonthLabel(monthKey),
      message: `Spending in ${formatMonthLabel(monthKey)} is up ${Math.round(((spendingView.total - previousSpending.total) / previousSpending.total) * 100)}% versus the previous month.`,
    });
  }

  if (incomeView.total > 0 && netView.total < 0) {
    insights.push({
      type: "warning",
      monthLabel: formatMonthLabel(monthKey),
      message: `Your projected leftover for ${formatMonthLabel(monthKey)} drops to ${formatMoney(netView.total)}.`,
    });
  }

  if (savingsView.total > 0) {
    insights.push({
      type: "positive",
      monthLabel: formatMonthLabel(monthKey),
      message: `Savings planned for ${formatMonthLabel(monthKey)} total ${formatMoney(savingsView.total)}.`,
    });
  }

  if (billsView.total > incomeView.total * 0.35 && incomeView.total > 0) {
    insights.push({
      type: "info",
      monthLabel: formatMonthLabel(monthKey),
      message: `Bills in ${formatMonthLabel(monthKey)} are taking more than a third of planned income.`,
    });
  }

  if (previousFuel.total > 0 && fuelView.total > previousFuel.total * 1.2) {
    insights.push({
      type: "info",
      monthLabel: formatMonthLabel(monthKey),
      message: `Fuel budget is unusually high in ${formatMonthLabel(monthKey)} compared with the previous month.`,
    });
  }

  if ((workData?.overtimeHours || 0) >= 8 && (workData?.overtimeValue || 0) > 0 && monthKey === currentMonthKey) {
    insights.push({
      type: "positive",
      monthLabel: formatMonthLabel(monthKey),
      message: `Overtime is adding roughly ${formatMoney(workData.overtimeValue)} this cycle.`,
    });
  }

  const sixMonthTimeline = calculateProjectedTimeline({
    startMonth: monthKey,
    endMonth: shiftMonthKey(monthKey, 5),
    datasets: { transactions, bills, savings, goals, workData },
    widgetDataMap: widgetData,
    referenceMonthKey: currentMonthKey,
  });
  const underfundedMonths = sixMonthTimeline.filter((entry) => entry.net < 0);
  if (underfundedMonths.length >= 3) {
    insights.push({
      type: "warning",
      monthLabel: formatMonthLabel(monthKey),
      message: `You have ${underfundedMonths.length} months in the next six where planned spend exceeds projected income.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: "info",
      monthLabel: formatMonthLabel(monthKey),
      message: "This month looks steady. Add more recurring rules or overrides to unlock deeper planning insights.",
    });
  }

  return insights.slice(0, 4);
}

export default buildPersonalInsights;
