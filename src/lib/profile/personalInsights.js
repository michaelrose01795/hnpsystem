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
 *   action   — optional lightweight cue ("Check settings", etc.)
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

  if (totalIn <= 0) return results;

  if (net > 0 && afterTax > 0) {
    results.push({
      type: "positive",
      category: "net-surplus",
      message: `You have ${fmt(afterTax)} left after tax and all outgoings this month.`,
      score: 60 + Math.min(pct(afterTax, totalIn), 30),
    });
  }

  if (afterTax < 0) {
    results.push({
      type: "warning",
      category: "net-deficit",
      message: `Outgoings exceed after-tax income by ${fmt(afterTax)} this month.`,
      score: 85,
      action: "Review outgoings in Settings",
    });
  }

  if (net > 0 && afterTax <= 0) {
    results.push({
      type: "warning",
      category: "net-tax-squeeze",
      message: "Before tax you're in surplus, but after deductions you're in the red.",
      score: 78,
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
  const expectedHours = derived.expectedHours || 0;

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

  if (actualHours !== null && expectedHours > 0 && isCurrentMonth(model?.selectedMonthKey)) {
    const progress = dayProgress();
    const expectedSoFar = expectedHours * progress;
    const diff = actualHours - expectedSoFar;

    if (diff > 2) {
      results.push({
        type: "positive",
        category: "hours-ahead",
        message: `You're ${diff.toFixed(1)}h ahead of expected hours for this point in the month.`,
        score: 52,
      });
    } else if (diff < -4) {
      results.push({
        type: "info",
        category: "hours-behind",
        message: `You're ${Math.abs(diff).toFixed(1)}h behind expected hours — leave or short weeks may account for this.`,
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
      action: "Open Settings → Pay and Work",
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
    results.push({
      type: "warning",
      category: "card-vs-savings",
      message: "Credit card payments are taking a bigger share of outgoings than savings this month.",
      score: 72,
    });
  }

  if (cardBalances > 0 && totalOut > 0 && pct(cardPayments, totalOut) > 30) {
    results.push({
      type: "warning",
      category: "card-pressure",
      message: `Credit card payments account for ${pct(cardPayments, totalOut).toFixed(0)}% of total outgoings.`,
      score: 70,
    });
  }

  if (cardBalances > 0 && cardPayments <= 0) {
    results.push({
      type: "info",
      category: "card-no-payment",
      message: `You have ${fmt(cardBalances)} in card balances but no monthly payment set.`,
      score: 60,
      action: "Set payments in Settings → Credit Cards",
    });
  }

  return results;
}

function savingsRules(derived) {
  const results = [];
  const monthSavings = derived.savingsTotal || 0;
  const yearSavings = derived.yearSavings || 0;
  const totalIn = derived.totalIncome || 0;

  if (monthSavings > 0 && totalIn > 0) {
    const saveRate = pct(monthSavings, totalIn);
    if (saveRate >= 20) {
      results.push({
        type: "positive",
        category: "savings-strong",
        message: `You're saving ${saveRate.toFixed(0)}% of income this month — solid progress.`,
        score: 65,
      });
    } else if (saveRate >= 10) {
      results.push({
        type: "positive",
        category: "savings-decent",
        message: `Saving ${saveRate.toFixed(0)}% of income this month.`,
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
      action: "Add a savings bucket in Settings",
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
      score: 62,
    });
  }

  return results;
}

function trendRules(derived, model) {
  const results = [];
  const delta = derived.deltaFromPrevious || 0;
  const prevDiff = model?.previousMonth?.totals?.difference;

  if (Math.abs(delta) < 1) return results;

  if (delta > 0) {
    results.push({
      type: "positive",
      category: "trend-up",
      message: `${fmt(delta)} more left over compared to last month.`,
      score: 50 + Math.min(Math.abs(delta) / 10, 20),
    });
  } else {
    results.push({
      type: "warning",
      category: "trend-down",
      message: `${fmt(delta)} less left over compared to last month.`,
      score: 50 + Math.min(Math.abs(delta) / 10, 20),
    });
  }

  return results;
}

// ─── Main entry point ────────────────────────────────────────────

/**
 * Generate prioritised insights from the Personal tab finance state.
 *
 * @param {{ derived: object, model: object }} params
 * @returns {Array<{ type: string, category: string, message: string, score: number, action?: string }>}
 */
export function generateInsights({ derived, model } = {}) {
  if (!derived || !model) {
    return [{
      type: "info",
      category: "no-data",
      message: "Add your pay settings and outgoings in Settings to unlock personalised insights.",
      score: 100,
      action: "Open Settings",
    }];
  }

  const allRules = [
    ...netPositionRules(derived, model),
    ...workPayRules(derived, model),
    ...creditCardRules(derived),
    ...savingsRules(derived),
    ...calendarRules(derived),
    ...trendRules(derived, model),
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
 */
export function generateHeadline(insights = []) {
  if (insights.length === 0) return "No data to analyse yet.";

  const warnings = insights.filter((i) => i.type === "warning");
  const positives = insights.filter((i) => i.type === "positive");

  if (warnings.length >= 2) return "A few areas need attention this month.";
  if (warnings.length === 1 && positives.length >= 1) return "Mostly on track, with one thing to watch.";
  if (positives.length >= 2) return "Looking healthy this month.";
  if (warnings.length === 1) return "One area to keep an eye on.";
  if (positives.length === 1) return "Things are ticking along.";
  return "Here's your monthly snapshot.";
}
