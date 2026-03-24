// Shared utility functions for recurring overtime rule matching, grouping, and summaries
// Pure functions — no DB imports — usable by both frontend (modal) and backend (cron)
// file location: src/lib/overtime/recurringUtils.js

// Day-of-week constants (JS convention: 0=Sun … 6=Sat)
const DAY_SHORT = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" }; // short labels
const DAY_FULL = { 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday" }; // full labels

function normalizeRuleGroupLabel(label) {
  return typeof label === "string" && label.trim() ? label.trim() : null;
}

function getLegacyGroupKey(rule) {
  const pt = rule.pattern_type || rule.patternType || "weekly";
  const wp = rule.week_parity || rule.weekParity || "";
  const active = rule.active !== false;
  return `${Number(rule.hours).toFixed(2)}|${pt}|${wp}|${active}`;
}

export function getRuleGroupKey(rule) {
  return normalizeRuleGroupLabel(rule?.label) || getLegacyGroupKey(rule);
}

// ─── Overtime Cycle Helpers ──────────────────────────────────────────────────

// Get the start date (26th) of the overtime cycle containing `date`
// If date is on/after 26th → 26th of same month; if before 26th → 26th of previous month
export function getOvertimeCycleStart(date = new Date()) {
  const d = new Date(date); // clone to avoid mutation
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed
  const day = d.getDate();
  return day >= 26
    ? new Date(year, month, 26) // 26th of current month
    : new Date(year, month - 1, 26); // 26th of previous month
}

// Get the end date (25th) of the overtime cycle containing `date`
export function getOvertimeCycleEnd(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  return day >= 26
    ? new Date(year, month + 1, 25) // 25th of next month
    : new Date(year, month, 25); // 25th of current month
}

// 0-based week index within the current 26th-to-25th overtime cycle
// Week 0 = first 7 days from cycle start, Week 1 = next 7, etc.
export function getCycleWeekIndex(date = new Date()) {
  const cycleStart = getOvertimeCycleStart(date);
  const d = new Date(date);
  // Zero out time components for clean day diff
  cycleStart.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diffMs = d.getTime() - cycleStart.getTime(); // ms since cycle start
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)); // whole days
  return Math.floor(diffDays / 7); // 0-based week index
}

// ─── Rule Matching ───────────────────────────────────────────────────────────

// Check if a single rule matches a given date based on day_of_week + pattern_type + week_parity
export function doesRuleMatchDate(rule, date = new Date()) {
  const d = new Date(date);
  if (d.getDay() !== rule.day_of_week) return false; // wrong day of week
  const patternType = rule.pattern_type || "weekly"; // default to weekly for backward compat
  if (patternType === "weekly") return true; // weekly rules always match their day
  if (patternType === "alternate") {
    const weekIndex = getCycleWeekIndex(d); // position within 26-25 cycle
    const isEvenWeek = weekIndex % 2 === 0;
    return rule.week_parity === "even" ? isEvenWeek : !isEvenWeek; // match parity
  }
  return false; // unknown pattern — safety fallback
}

// Filter active rules that match a date and sum their hours
export function sumMatchingRuleHours(rules, date = new Date()) {
  return rules
    .filter((r) => r.active && doesRuleMatchDate(r, date))
    .reduce((sum, r) => sum + Number(r.hours), 0); // additive total
}

// ─── Grouping ────────────────────────────────────────────────────────────────

// Group rules by hours + patternType + weekParity + active for display rows
// Returns array of { hours, patternType, weekParity, active, rules[] }
export function groupRulesSmartly(rules) {
  const groups = {};
  rules.forEach((r) => {
    const pt = r.pattern_type || "weekly";
    const wp = r.week_parity || "";
    const key = getRuleGroupKey(r);
    if (!groups[key]) {
      groups[key] = {
        key,
        label: normalizeRuleGroupLabel(r.label),
        hours: Number(r.hours),
        patternType: pt,
        weekParity: r.week_parity || null,
        active: r.active,
        rules: [],
      };
    }
    groups[key].rules.push(r);
  });
  // Sort days within each group, then sort groups: active first, then by lowest day
  return Object.values(groups)
    .map((g) => {
      g.rules.sort((a, b) => a.day_of_week - b.day_of_week); // day order within group
      return g;
    })
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1; // active groups first
      return a.rules[0].day_of_week - b.rules[0].day_of_week; // then by first day
    });
}

// Build the composite key string for a group (used for editingGroupKey tracking)
export function getGroupKey(group) {
  return group?.key || normalizeRuleGroupLabel(group?.label) || getLegacyGroupKey(group || {});
}

// ─── Smart Summary ───────────────────────────────────────────────────────────

// Generate summary stats from all rules (active and inactive)
// Returns { totalWeeklyHours, activePatterns, summaryLines[] }
export function generateSmartSummary(rules) {
  const active = rules.filter((r) => r.active);
  if (active.length === 0) return { totalWeeklyHours: 0, activePatterns: 0, summaryLines: [] };

  // Weekly hours: weekly rules contribute full hours, alternate contribute half (fire every other week)
  let totalWeeklyHours = 0;
  active.forEach((r) => {
    const pt = r.pattern_type || "weekly";
    totalWeeklyHours += pt === "alternate" ? Number(r.hours) / 2 : Number(r.hours); // half for alternate
  });

  // Count distinct pattern groups
  const grouped = groupRulesSmartly(active);
  const activePatterns = grouped.length;

  // Build natural language summary lines per group
  const summaryLines = grouped.map((g) => {
    const days = g.rules.map((r) => DAY_SHORT[r.day_of_week]).join(", "); // "Mon, Tue, Wed"
    const hrs = Number(g.hours).toFixed(2);
    if (g.patternType === "alternate") {
      return `${days} — ${hrs}h every other week (${g.weekParity} weeks)`;
    }
    return `${days} — ${hrs}h every week`;
  });

  return { totalWeeklyHours, activePatterns, summaryLines };
}

// ─── Upcoming Entries ────────────────────────────────────────────────────────

// Find the next date (from tomorrow) when at least one active rule fires
export function getNextMatchingDay(rules, fromDate = new Date()) {
  const active = rules.filter((r) => r.active);
  if (active.length === 0) return null;
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);
  for (let i = 1; i <= 60; i++) { // look ahead up to 60 days (covers 2 full cycles)
    const candidate = new Date(start);
    candidate.setDate(candidate.getDate() + i);
    if (candidate.getDay() === 0) continue; // skip Sundays
    const matches = active.some((r) => doesRuleMatchDate(r, candidate));
    if (matches) return candidate; // first matching date
  }
  return null; // no match within 60 days
}

// Get the next N upcoming entries with their total hours
// Returns [{ date: Date, totalHours: number, dayLabel: string }]
export function getUpcomingEntries(rules, count = 3, fromDate = new Date()) {
  const active = rules.filter((r) => r.active);
  if (active.length === 0) return [];
  const results = [];
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);
  for (let i = 1; i <= 60 && results.length < count; i++) {
    const candidate = new Date(start);
    candidate.setDate(candidate.getDate() + i);
    if (candidate.getDay() === 0) continue; // skip Sundays
    const totalHours = sumMatchingRuleHours(active, candidate); // additive sum for this date
    if (totalHours > 0) {
      results.push({
        date: new Date(candidate),
        totalHours,
        dayLabel: DAY_SHORT[candidate.getDay()] || "", // "Mon", "Tue", etc.
      });
    }
  }
  return results;
}

// ─── Overlap Detection ───────────────────────────────────────────────────────

// Detect if proposed rule overlaps with existing saved rules
// Returns array of warning strings (empty if no overlaps)
export function detectOverlaps(existingRules, newRule, editingGroupKey = null) {
  const warnings = [];
  const active = existingRules.filter((r) => r.active);
  const newPt = newRule.patternType || "weekly";
  const newWp = newRule.weekParity || null;

  // Get selected days from the form
  const selectedDays = Object.keys(newRule.days || {})
    .filter((d) => newRule.days[d])
    .map(Number);

  for (const dow of selectedDays) {
    // Find existing rules for the same day, excluding the group being edited
    const existing = active.filter((r) => {
      if (r.day_of_week !== dow) return false;
      // Exclude rules from the editing group so we don't warn about self-overlap
      if (editingGroupKey) {
        const rKey = getRuleGroupKey(r);
        if (rKey === editingGroupKey) return false; // skip own group
      }
      return true;
    });

    for (const r of existing) {
      const rPt = r.pattern_type || "weekly";
      const rWp = r.week_parity || null;
      const dayName = DAY_FULL[dow] || `Day ${dow}`;

      // Determine overlap type based on pattern combinations
      if (newPt === "weekly" && rPt === "weekly") {
        // Both weekly on same day — hours will always add
        warnings.push(`${dayName}: hours will combine with existing ${Number(r.hours).toFixed(2)}h weekly rule`);
      } else if (newPt === "weekly" && rPt === "alternate") {
        // New weekly + existing alternate — overlap on alternate's matching weeks
        warnings.push(`${dayName}: will overlap with existing ${Number(r.hours).toFixed(2)}h alternate (${rWp} weeks) rule on matching weeks`);
      } else if (newPt === "alternate" && rPt === "weekly") {
        // New alternate + existing weekly — overlap on new rule's matching weeks
        warnings.push(`${dayName}: will overlap with existing ${Number(r.hours).toFixed(2)}h weekly rule on your matching weeks`);
      } else if (newPt === "alternate" && rPt === "alternate") {
        if (newWp === rWp) {
          // Same parity — always overlap
          warnings.push(`${dayName}: same parity as existing ${Number(r.hours).toFixed(2)}h alternate (${rWp} weeks) rule — hours will combine`);
        }
        // Different parity — no overlap, no warning needed
      }
    }
  }

  return warnings;
}
