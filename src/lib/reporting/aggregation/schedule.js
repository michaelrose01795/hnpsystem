// file location: src/lib/reporting/aggregation/schedule.js
//
// Helpers that turn "run the <cadence> aggregation now" into the concrete window
// runAggregation() needs (Phase-2 §10.1 cadence table). Each cron processes the
// most recently COMPLETED period by default, or an explicit override.
//
// daily     → yesterday (compute from source)
// weekly    → last complete ISO week (rollup from daily)
// monthly   → last complete month   (rollup from daily)
// quarterly → last complete quarter (rollup from monthly)
// yearly    → last complete year    (rollup from monthly)

const pad2 = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function isoWeekKey(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${pad2(week)}`;
}

// Build the runAggregation() options for a cadence relative to `now`.
export function aggregationWindow(cadence, now = new Date()) {
  const d = new Date(now);

  if (cadence === "daily") {
    const y = new Date(d);
    y.setDate(y.getDate() - 1);
    return { cadence: "daily", day: dayKey(y) };
  }

  if (cadence === "weekly") {
    // Last complete week = the week containing (today - 7 days), Mon..Sun.
    const ref = new Date(d);
    ref.setDate(ref.getDate() - 7);
    const dow = (ref.getDay() + 6) % 7; // Monday = 0
    const monday = new Date(ref);
    monday.setDate(ref.getDate() - dow);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { cadence: "weekly", periodKey: isoWeekKey(monday), lowerFrom: dayKey(monday), lowerTo: dayKey(sunday) };
  }

  if (cadence === "monthly") {
    const firstThis = new Date(d.getFullYear(), d.getMonth(), 1);
    const lastMonthEnd = new Date(firstThis.getTime() - 1);
    const firstLast = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
    return {
      cadence: "monthly",
      periodKey: `${firstLast.getFullYear()}-${pad2(firstLast.getMonth() + 1)}`,
      lowerFrom: dayKey(firstLast),
      lowerTo: dayKey(lastMonthEnd),
    };
  }

  if (cadence === "quarterly") {
    // Previous quarter; rollup from monthly snapshots (year_month keys).
    const q = Math.floor(d.getMonth() / 3);
    const prevQ = q === 0 ? 3 : q - 1;
    const year = q === 0 ? d.getFullYear() - 1 : d.getFullYear();
    const startMonth = prevQ * 3;
    return {
      cadence: "quarterly",
      periodKey: `${year}-Q${prevQ + 1}`,
      lowerFrom: `${year}-${pad2(startMonth + 1)}`,
      lowerTo: `${year}-${pad2(startMonth + 3)}`,
    };
  }

  if (cadence === "yearly") {
    const year = d.getFullYear() - 1;
    return { cadence: "yearly", periodKey: String(year), lowerFrom: `${year}-01`, lowerTo: `${year}-12` };
  }

  return { cadence: "daily", day: dayKey(d) };
}

export default aggregationWindow;
