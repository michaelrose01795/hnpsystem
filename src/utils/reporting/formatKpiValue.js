// file location: src/utils/reporting/formatKpiValue.js
//
// Presentation-only formatting for reporting KPI values. The reporting engine
// returns each value plus its `unit` and `format`; this turns that into the
// display string. It performs NO calculation — it never derives a metric, only
// renders the number the framework already computed (Phase-6 rule: no KPI maths
// in the UI).

const GBP = (n, dp = 2) =>
  "£" + Number(n).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });

export function formatKpiValue(value, unit = "count", format = "0,0") {
  if (value === null || value === undefined || (typeof value === "number" && Number.isNaN(value))) {
    return "—";
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";

  switch (unit) {
    case "currency":
      return GBP(n, 2);
    case "percent":
      return n.toLocaleString("en-GB", { maximumFractionDigits: 1 }) + "%";
    case "hours":
      return n.toLocaleString("en-GB", { maximumFractionDigits: 1 }) + "h";
    case "duration":
      return n.toLocaleString("en-GB", { maximumFractionDigits: 1 });
    case "count":
    default: {
      const wantsDecimals = typeof format === "string" && format.includes(".");
      return wantsDecimals
        ? n.toLocaleString("en-GB", { maximumFractionDigits: 1 })
        : Math.round(n).toLocaleString("en-GB");
    }
  }
}

// Direction glyph + sentiment for a target type (purely cosmetic; the value is
// authoritative). Returns { glyph, tone } where tone ∈ good|bad|neutral.
export function targetHint(targetType) {
  switch (targetType) {
    case "higher_is_better":
      return { glyph: "▲", tone: "good" };
    case "lower_is_better":
      return { glyph: "▼", tone: "good" };
    case "band":
      return { glyph: "≈", tone: "neutral" };
    default:
      return { glyph: "", tone: "neutral" };
  }
}

export default formatKpiValue;
