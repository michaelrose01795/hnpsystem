import { getCurrentMonthKey, normaliseMonthKey } from "@/lib/profile/calculations";

/**
 * Rule-based insight engine for the Personal tab.
 *
 * Reads the finance model + derived values, evaluates a set of rules,
 * scores and de-duplicates the results, and returns the top 3-6 insights.
 *
 * Each insight has: { type, category, message, score, action? }
 *   type     — "positive" | "warning" | "info"
 *   category — dedup key (only one insight per category is kept)
 *   message  — short, plain-English sentence
 *   score    — 0-100, higher = more relevant
 *   action   — optional structured action { label, target, section }
 */

function pct(part, whole) {
  if (!whole || whole === 0) return 0;
  return (part / whole) * 100;
}

function fmt(value) {
  return `£${Math.abs(Number(value || 0)).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dayProgress() {
  const now = new Date();
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return day / daysInMonth;
}

function isCurrentMonth(monthKey) {
  return normaliseMonthKey(monthKey) === getCurrentMonthKey();
}

// ─── Individual rule functions ───────────────────────────────────

function netPositionRules(derived, model) {
  const results = [];
  const net = derived.netRemaining || 0;
  const afterTax = derived.moneyLeftAfterTax || 0;
  const totalIn = derived.totalIncome || 0;
  const afterTaxIncome = derived.afterTaxIncome || 0;
  const savingsAllocated = derived.savingsAllocatedTotal || derived.savingsTotal || 0;

  if (totalIn <= 0) return results;

  if (net > 0 && afterTax > 0) {
    const savingsSuffix = savingsAllocated > 0
      ? ` ${fmt(savingsAllocated)} of your outgoings this month is going to savings.`
      : "";
    results.push({
      type: "positive",
      category: "net-surplus",
      message: `You have ${fmt(afterTax)} left after tax and all outgoings this month.${savingsSuffix}`,
      score: 60 + Math.min(pct(afterTax, totalIn), 30),
    });
  }

  if (afterTax < 0) {
    const deficitPct = afterTaxIncome > 0 ? pct(Math.abs(afterTax), afterTaxIncome) : 50;
    results.push({
      type: "warning",
      category: "net-deficit",
      message: `Outgoings exceed after-tax income by ${fmt(afterTax)} this month.`,
      score: 70 + Math.min(deficitPct / 2, 25),
      action: { label: "Review outgoings", target: "settings", section: "payments" },
    });
  }

  if (net > 0 && afterTax <= 0) {
    const squeezePct = totalIn > 0 ? pct(Math.abs(afterTax), totalIn) : 20;
    results.push({
      type: "warning",
      category: "net-tax-squeeze",
      message: "Before tax you're in surplus, but after deductions you're in the red.",
      score: 70 + Math.min(squeezePct / 3, 20),
    });
  }

  return results;
}

function workPayRules(derived, model) {
  const results = [];
  const otPay = derived.overtimePay || 0;
  const basePay = derived.basePay || 0;
  const totalIn = derived.totalIncome || 0;
  const actualHours = derived.actualHoursWorked;
  const contractedHours = derived.hoursWorked || 0;

  if (otPay > 0 && totalIn > 0) {
    const otShare = pct(otPay, totalIn);
    if (otShare >= 25) {
      results.push({
        type: "info",
        category: "overtime-heavy",
        message: `Overtime is contributing ${otShare.toFixed(0)}% of total income this month.`,
        score: 65 + Math.min(otShare, 20),
      });
    } else if (otShare >= 10) {
      results.push({
        type: "positive",
        category: "overtime-boost",
        message: "Overtime is adding a noticeable boost to this month's pay.",
        score: 55,
      });
    }
  }

  if (actualHours !== null && contractedHours > 0 && isCurrentMonth(model?.selectedMonthKey)) {
    const progress = dayProgress();
    const contractedSoFar = contractedHours * progress;
    const diff = actualHours - contractedSoFar;

    if (diff > 2) {
      results.push({
        type: "positive",
        category: "hours-ahead",
        message: `You're ${diff.toFixed(1)}h ahead of contracted hours for this point in the month.`,
        score: 52,
      });
    } else if (diff < -4) {
      results.push({
        type: "info",
        category: "hours-behind",
        message: `You're ${Math.abs(diff).toFixed(1)}h behind contracted hours — leave or short weeks may account for this.`,
        score: 50,
      });
    }
  }

  if (basePay <= 0 && totalIn <= 0) {
    results.push({
      type: "info",
      category: "no-pay-data",
      message: "No pay data configured yet — set your hourly rate or salary in Settings to see projections.",
      score: 90,
      action: { label: "Set up pay", target: "settings", section: "pay" },
    });
  }

  return results;
}

function creditCardRules(derived) {
  const results = [];
  const cardPayments = derived.creditCardPayments || 0;
  const cardBalances = derived.totalCardBalances || 0;
  const savings = derived.savingsTotal || 0;
  const totalOut = derived.totalOutgoings || 0;

  if (cardPayments > 0 && savings > 0 && cardPayments > savings) {
    const gapPct = totalOut > 0 ? pct(cardPayments - savings, totalOut) : 10;
    results.push({
      type: "warning",
      category: "card-vs-savings",
      message: "Credit card payments are taking a bigger share of outgoings than savings this month.",
      score: 60 + Math.min(gapPct, 20),
    });
  }

  if (cardBalances > 0 && totalOut > 0) {
    const cardPct = pct(cardPayments, totalOut);
    if (cardPct > 30) {
      results.push({
        type: "warning",
        category: "card-pressure",
        message: `Credit card payments account for ${cardPct.toFixed(0)}% of total outgoings.`,
        score: 60 + Math.min(cardPct - 30, 25),
      });
    }
  }

  if (cardBalances > 0 && cardPayments <= 0) {
    results.push({
      type: "info",
      category: "card-no-payment",
      message: `You have ${fmt(cardBalances)} in card balances but no monthly payment set.`,
      score: 60,
      action: { label: "Set card payments", target: "settings", section: "credit-cards" },
    });
  }

  // Credit payoff estimation
  if (cardBalances > 0 && cardPayments > 0) {
    const monthsToPayoff = Math.ceil(cardBalances / cardPayments);
    if (monthsToPayoff <= 3) {
      results.push({
        type: "positive",
        category: "card-payoff",
        message: `At current payments, card balances could be cleared in ~${monthsToPayoff} month${monthsToPayoff !== 1 ? "s" : ""}.`,
        score: 50,
      });
    } else if (monthsToPayoff <= 12) {
      results.push({
        type: "info",
        category: "card-payoff",
        message: `At current payments, card balances would take ~${monthsToPayoff} months to clear.`,
        score: 45,
      });
    } else {
      results.push({
        type: "warning",
        category: "card-payoff",
        message: `At current payments, clearing card balances would take over a year (~${monthsToPayoff} months).`,
        score: 68,
      });
    }
  }

  return results;
}

function savingsRules(derived) {
  const results = [];
  const monthSavings = derived.savingsTotal || 0;
  const yearSavings = derived.yearSavings || 0;
  const totalIn = derived.totalIncome || 0;
  const afterTaxIncome = derived.afterTaxIncome || 0;
  const savingsBase = afterTaxIncome > 0 ? afterTaxIncome : totalIn;

  if (monthSavings > 0 && savingsBase > 0) {
    const saveRate = pct(monthSavings, savingsBase);
    if (saveRate >= 20) {
      results.push({
        type: "positive",
        category: "savings-strong",
        message: `You're saving ${saveRate.toFixed(0)}% of after-tax income this month — solid progress.`,
        score: 55 + Math.min(saveRate - 20, 20),
      });
    } else if (saveRate >= 10) {
      results.push({
        type: "positive",
        category: "savings-decent",
        message: `Saving ${saveRate.toFixed(0)}% of after-tax income this month.`,
        score: 45,
      });
    }
  }

  if (monthSavings <= 0 && totalIn > 0) {
    results.push({
      type: "info",
      category: "savings-zero",
      message: "No savings allocated this month — consider setting aside even a small amount.",
      score: 40,
      action: { label: "Add savings", target: "settings", section: "savings" },
    });
  }

  if (yearSavings > 0) {
    results.push({
      type: "positive",
      category: "year-savings",
      message: `${fmt(yearSavings)} saved across the finance year so far.`,
      score: 35,
    });
  }

  return results;
}

function calendarRules(derived) {
  const results = [];
  const leaveDays = derived.leaveDaysInMonth || 0;
  const leaveRemaining = derived.leaveStats?.remaining;
  const expectedDays = derived.expectedWorkDays || 0;

  if (leaveDays > 0) {
    results.push({
      type: "info",
      category: "leave-this-month",
      message: `${leaveDays} approved leave day${leaveDays !== 1 ? "s" : ""} this month — that's ${expectedDays > 0 ? `${(expectedDays - leaveDays)} effective work days` : "factored in"}.`,
      score: 48,
    });
  }

  if (leaveRemaining !== null && leaveRemaining !== undefined && leaveRemaining <= 3 && leaveRemaining >= 0) {
    results.push({
      type: "warning",
      category: "leave-low",
      message: `Only ${leaveRemaining} leave day${leaveRemaining !== 1 ? "s" : ""} remaining for the year.`,
      score: 55 + (3 - leaveRemaining) * 8,
    });
  }

  return results;
}

function vehicleDeductionRules(derived, model) {
  const results = [];
  const workDeductions = derived.workDeductions || 0;
  const afterTaxIncome = derived.afterTaxIncome || 0;
  const deductionEntries = model?.currentMonth?.pay?.workDeductionEntries || [];

  if (workDeductions > 0 && afterTaxIncome > 0) {
    const deductionPct = pct(workDeductions, afterTaxIncome);
    if (deductionPct >= 15) {
      results.push({
        type: "warning",
        category: "vehicle-deduction-heavy",
        message: `Vehicle deductions are taking ${deductionPct.toFixed(0)}% of your after-tax income this month.`,
        score: 60 + Math.min(deductionPct - 15, 20),
      });
    } else {
      results.push({
        type: "info",
        category: "vehicle-deduction-present",
        message: `${fmt(workDeductions)} in vehicle payroll deductions this month.`,
        score: 35,
      });
    }
  }

  if (deductionEntries.length >= 2) {
    results.push({
      type: "info",
      category: "vehicle-deduction-multiple",
      message: `Deductions across ${deductionEntries.length} vehicle entries this month.`,
      score: 38,
    });
  }

  return results;
}

function trendRules(derived, model) {
  const results = [];
  const delta = derived.deltaFromPrevious || 0;
  const afterTaxIncome = derived.afterTaxIncome || 0;

  if (Math.abs(delta) < 1) return results;

  if (delta > 0) {
    results.push({
      type: "positive",
      category: "trend-up",
      message: `${fmt(delta)} more left over compared to last month.`,
      score: 50 + Math.min(afterTaxIncome > 0 ? pct(Math.abs(delta), afterTaxIncome) : Math.abs(delta) / 10, 30),
    });
  } else {
    results.push({
      type: "warning",
      category: "trend-down",
      message: `${fmt(delta)} less left over compared to last month.`,
      score: 50 + Math.min(afterTaxIncome > 0 ? pct(Math.abs(delta), afterTaxIncome) : Math.abs(delta) / 10, 30),
    });
  }

  return results;
}

function threeMonthTrendRules(derived, model) {
  const results = [];
  const afterTaxIncome = derived.afterTaxIncome || 0;
  const yearRows = model?.yearRows;
  const selectedKey = model?.selectedMonthKey;

  if (!Array.isArray(yearRows) || !selectedKey) return results;

  // Get up to the selected month from yearRows
  const selectedIndex = yearRows.findIndex((row) => row.monthKey === selectedKey);
  if (selectedIndex < 2) return results;

  const recent = yearRows.slice(selectedIndex - 2, selectedIndex + 1);
  // Need all 3 months to have income data
  if (recent.length < 3 || recent.some((row) => (row.totals?.totalIn || 0) <= 0)) return results;

  const values = recent.map((row) => row.totals?.moneyLeftAfterTax || 0);
  const allRising = values[1] > values[0] && values[2] > values[1];
  const allFalling = values[1] < values[0] && values[2] < values[1];

  if (!allRising && !allFalling) return results;

  const direction = values[2] - values[0];

  if (allRising) {
    results.push({
      type: "positive",
      category: "trend-3m",
      message: "Take-home surplus has improved for 3 consecutive months.",
      score: 55 + Math.min(afterTaxIncome > 0 ? pct(Math.abs(direction), afterTaxIncome) : 10, 25),
    });
  } else {
    results.push({
      type: "warning",
      category: "trend-3m",
      message: "Take-home surplus has declined for 3 consecutive months.",
      score: 65 + Math.min(afterTaxIncome > 0 ? pct(Math.abs(direction), afterTaxIncome) : 10, 25),
    });
  }

  return results;
}

// ─── Main entry point ────────────────────────────────────────────

/**
 * Generate prioritised insights from the Personal tab finance state.
 *
 * @param {{ derived: object, model: object }} params
 * @returns {Array<{ type: string, category: string, message: string, score: number, action?: object }>}
 */
export function generateInsights({ derived, model } = {}) {
  if (!derived || !model) {
    return [{
      type: "info",
      category: "no-data",
      message: "Add your pay settings and outgoings in Settings to unlock personalised insights.",
      score: 100,
      action: { label: "Open Settings", target: "settings", section: "pay" },
    }];
  }

  const allRules = [
    ...netPositionRules(derived, model),
    ...workPayRules(derived, model),
    ...creditCardRules(derived),
    ...savingsRules(derived),
    ...calendarRules(derived),
    ...vehicleDeductionRules(derived, model),
    ...trendRules(derived, model),
    ...threeMonthTrendRules(derived, model),
  ];

  // De-duplicate by category — keep highest-scored insight per category
  const byCategory = new Map();
  for (const insight of allRules) {
    const existing = byCategory.get(insight.category);
    if (!existing || insight.score > existing.score) {
      byCategory.set(insight.category, insight);
    }
  }

  const sorted = Array.from(byCategory.values()).sort((a, b) => b.score - a.score);

  // Return 3–6 insights
  if (sorted.length === 0) {
    return [{
      type: "positive",
      category: "balanced",
      message: "Everything looks balanced — no warnings or standout items this month.",
      score: 20,
    }];
  }

  return sorted.slice(0, 6);
}

/**
 * Generate a one-line headline summary from insights.
 * Uses the highest-scoring insight to drive the headline.
 */
export function generateHeadline(insights = []) {
  if (insights.length === 0) return "No data to analyse yet.";

  const top = insights[0];
  if (!top) return "Here's your monthly snapshot.";

  if (top.type === "warning" && top.score >= 80) return "Something important needs your attention this month.";
  if (top.type === "warning" && top.score >= 65) return "One area to keep an eye on this month.";
  if (top.type === "warning") return "A couple of things to watch.";
  if (top.type === "positive" && top.score >= 70) return "Looking strong this month.";
  if (top.type === "positive") return "Things are on track.";
  if (top.type === "info" && top.category === "no-pay-data") return "Set up your pay details to get started.";
  return "Here's your monthly snapshot.";
}
