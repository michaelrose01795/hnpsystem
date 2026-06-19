// file location: src/components/reporting/accounts/accountsReportConfig.js
//
// Presentation grouping for the Accounts report package: which catalogue KPIs
// appear in which tab, and the display metadata (unit/format/readiness/drilldown)
// that mirrors the KPI definitions in src/lib/reporting/kpiDefinitions/accounts.js.
// This is LAYOUT ONLY — every value, formula and calculation still comes from the
// engine via /api/reports/*. The ids here are the contract; nothing is recomputed.
//
// Structure mirrors the Workshop and Parts packages: Overview · Revenue &
// Invoicing · Payments & Receivables · Financial Operations · Reporting Utilities.

export const ACCOUNTS_DEPARTMENT = { code: "accounts", label: "Accounts" };
export const ACCOUNTS_VIEW_TARGET = "reports:accounts";

// Each descriptor: { id, label, unit, format, readiness, hasDrilldown, description }
const K = (id, label, unit, format, readiness, hasDrilldown, description) => ({
  id,
  label,
  unit,
  format,
  readiness,
  hasDrilldown,
  description,
});

// --- Tab 1: Overview — department scorecard --------------------------------
export const OVERVIEW_SCORECARD = [
  K("acc.revenue", "Total Revenue", "currency", "£0,0.00", "R1", true, "Invoiced revenue in the period."),
  K("acc.labour_revenue", "Labour Revenue", "currency", "£0,0.00", "R1", true, "Σ invoices.labour_total."),
  K("acc.parts_revenue", "Parts Revenue", "currency", "£0,0.00", "R1", true, "Σ invoices.parts_total."),
  K("acc.payments_received", "Payments Received", "currency", "£0,0.00", "R1", true, "£ collected in the period."),
  K("acc.outstanding_invoices", "Outstanding Invoices", "count", "0,0", "R1", true, "Unpaid invoice pipeline."),
  K("acc.ar", "Accounts Receivable", "currency", "£0,0.00", "R1", true, "Net money owed."),
  K("acc.credit_exposure", "Credit Exposure", "count", "0,0", "R1", true, "Accounts ≥80% of limit."),
  K("acc.account_balances", "Account Balances", "currency", "£0,0.00", "R1", true, "Total active-account balance."),
];

// --- Tab 2: Revenue & Invoicing --------------------------------------------
// Revenue, invoice volume, outstanding invoices, revenue monitoring.
export const REVENUE_KPIS = [
  K("acc.revenue", "Total Revenue", "currency", "£0,0.00", "R1", true, "Grand total invoiced; invoice volume in the drill."),
  K("acc.labour_revenue", "Labour Revenue", "currency", "£0,0.00", "R1", true, "Labour invoiced."),
  K("acc.parts_revenue", "Parts Revenue", "currency", "£0,0.00", "R1", true, "Parts invoiced."),
];
// Invoice volume / outstanding pipeline — point-in-time unpaid invoices (the
// invoice volume awaiting collection); the drill lists the invoices themselves.
export const INVOICE_VOLUME = K(
  "acc.outstanding_invoices",
  "Outstanding Invoices (volume & value)",
  "count",
  "0,0",
  "R1",
  true,
  "Count and £ of invoices in Sent/Overdue — the live invoice pipeline (exact, not truncated)."
);

// --- Tab 3: Payments & Receivables -----------------------------------------
export const RECEIVABLES_KPIS = [
  K("acc.payments_received", "Payments Received", "currency", "£0,0.00", "R1", true, "£ collected in the period."),
  K("acc.ar", "Accounts Receivable", "currency", "£0,0.00", "R1", true, "Net owed = issued − collected."),
  K("acc.account_balances", "Account Balances", "currency", "£0,0.00", "R1", true, "Active-account balance total."),
  K("acc.credit_exposure", "Credit Exposure", "count", "0,0", "R1", true, "Accounts ≥80% of credit limit; total exposure."),
];

// --- Tab 4: Financial Operations -------------------------------------------
// Financial activity (the receivables/collection KPIs), invoice processing,
// revenue trends, payment trends. Plus the declared R2/R3 readiness indicators.
export const FINANCIAL_ACTIVITY = [
  K("acc.payments_received", "Payments Received", "currency", "£0,0.00", "R1", true, "Collection activity."),
  K("acc.outstanding_invoices", "Outstanding Invoices", "count", "0,0", "R1", true, "Open invoice pipeline."),
  K("acc.account_balances", "Account Balances", "currency", "£0,0.00", "R1", true, "Active-account balances."),
  K("acc.credit_exposure", "Credit Exposure", "count", "0,0", "R1", true, "Credit risk concentration."),
];
// Invoice processing & financial readiness — declared catalogue metrics that
// light up once invoice status-history accrues (R2) or COGS/opex modelling lands
// (R3). Shown so the gap is explicit, not hidden.
export const OPERATIONS_READINESS = [
  K("acc.dso", "Days Sales Outstanding", "duration", "0.0", "R2", false, "Mean issue→payment days."),
  K("acc.invoice_ageing", "Invoice Ageing", "currency", "£0,0.00", "R2", false, "AR bucketed by age."),
  K("acc.payment_conversion", "Payment Conversion", "percent", "0.0%", "R2", false, "Sent→Paid conversion."),
  K("acc.profitability", "Profitability by Dept", "currency", "£0,0.00", "R2", false, "Per-department revenue − cost."),
  K("acc.gross_profit", "Gross Profit", "currency", "£0,0.00", "R3", false, "Revenue − COGS (needs cost on lines)."),
  K("acc.net_profit", "Net Profit", "currency", "£0,0.00", "R3", false, "GP − opex (needs opex model)."),
];

// --- Tab 5: Reporting Utilities — every drillable/exportable Accounts KPI ---
export const ALL_EXPORTABLE = [
  K("acc.revenue", "Total Revenue", "currency", "£0,0.00", "R1", true, ""),
  K("acc.labour_revenue", "Labour Revenue", "currency", "£0,0.00", "R1", true, ""),
  K("acc.parts_revenue", "Parts Revenue", "currency", "£0,0.00", "R1", true, ""),
  K("acc.outstanding_invoices", "Outstanding Invoices", "count", "0,0", "R1", true, ""),
  K("acc.ar", "Accounts Receivable", "currency", "£0,0.00", "R1", true, ""),
  K("acc.payments_received", "Payments Received", "currency", "£0,0.00", "R1", true, ""),
  K("acc.credit_exposure", "Credit Exposure", "count", "0,0", "R1", true, ""),
  K("acc.account_balances", "Account Balances", "currency", "£0,0.00", "R1", true, ""),
].filter((k, i, arr) => k.hasDrilldown && arr.findIndex((x) => x.id === k.id) === i);

export const ACCOUNTS_TABS = [
  { value: "overview", label: "Overview" },
  { value: "revenue", label: "Revenue & Invoicing" },
  { value: "receivables", label: "Payments & Receivables" },
  { value: "operations", label: "Financial Operations" },
  { value: "utilities", label: "Reporting Utilities" },
];
