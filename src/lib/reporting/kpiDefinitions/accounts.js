// file location: src/lib/reporting/kpiDefinitions/accounts.js
//
// Accounts KPI definitions (Phase-3 §12, promoted for the Phase-8 Accounts report
// package). Every formula here is taken VERBATIM from the KPI catalogue
// (docs/Report System/reporting-kpi-catalogue-architecture.md §12) — no metric is
// invented and no calculation is bypassed. R1 metrics that compute trust-correctly
// today from operational tables carry a `resolver`; R2/R3 metrics are DECLARED
// (catalogue entry, no resolver) so they surface in the catalogue/UI as "declared,
// not yet implemented" with their exact blocker, rather than being silently
// omitted — exactly the discipline the Workshop (Phase 6) and Parts (Phase 7)
// packages established.
//
// All counting/summing goes through queryBuilder (exact counts, paginated sums —
// never `.limit()` as a total) so the numbers cannot regress to the D8 truncation
// bug the audit found. No financial figure is computed in the UI.
//
// EVERY Accounts KPI is FINANCIAL-GATED (Phase-1 §14.1 sensitive gate): the
// `permission` set is FINANCIAL_SENSITIVE_ROLES (Accounts + executives). The
// engine refuses these KPIs to any other role — even a department manager in
// scope — and execs (EXECUTIVE level) are allowed through. This is the highest
// permission tier in the reporting framework and is enforced server-side.
//
// Readiness gating (Phase-3 §0.3): R1 = all sources exist today (invoices,
// invoice_payments, accounts); R2 = blocked by missing invoice status-history
// (no paid_at / transition timestamps — only a `paid` bool + current
// payment_status); R3 = blocked by a missing input (no COGS on invoice lines, no
// opex model). The catalogue's readiness tag is the authority — it decides
// resolver vs declared, never a guess here.

import { defineKpi } from "../kpiCatalog";
import { applyDateRange, sumColumn, countRows, fetchRows } from "../queryBuilder";
import { FINANCIAL_SENSITIVE_ROLES } from "../permissionScope";

// Highest-tier permission: Accounts + executives only (Phase-1 §14.1).
const FINANCIAL_PERMISSION = [...FINANCIAL_SENSITIVE_ROLES];

// Round to pennies (presentation-safe; the value is still the engine's, not the
// UI's). One place so every £ KPI rounds identically (Principle 2).
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Unpaid invoice states (the AR pipeline). Mirrors the seed definition and the
// existing /api/accounts reporting view; both spellings carried because
// payment_status is free-text (status-normalisation lands with the CHECK
// constraints in a later phase — R3 data-quality).
const UNPAID_STATUSES = ["Sent", "Overdue", "sent", "overdue"];

export const accountsKpis = [
  // =========================================================================
  // REVENUE & INVOICING (R1, buildable now from invoices)
  // =========================================================================
  defineKpi({
    id: "acc.revenue",
    label: "Total Revenue",
    department: "accounts",
    relatedDepartments: ["workshop", "parts", "service"],
    description: "Invoiced revenue — grand total of invoices raised in the period (with invoice volume).",
    purpose: "Headline commercial output; the revenue-trend and invoice-volume base.",
    formula: "Σ invoices.grand_total (invoiced in period)",
    sourceTables: ["invoices"],
    sourceEvents: ["INVOICE_CREATED", "INVOICE_ISSUED"],
    tier: "executive",
    readiness: "R1",
    aggregation: "sum",
    unit: "currency",
    format: "£0,0.00",
    targetType: "higher_is_better",
    permission: FINANCIAL_PERMISSION,
    example: "£X/month",
    relatedReports: ["wsh.labour_sales", "prt.revenue"],
    futureNotes:
      "Prefer line-item recompute where the 7 denormalised invoice totals disagree (D12). `count` carries invoice volume (invoices raised in period) so a separate invoice-count KPI is not invented.",
    drilldown: async ({ filter }) =>
      fetchRows(
        "invoices",
        "id,invoice_number,job_number,account_number,payment_status,invoice_date,labour_total,parts_total,grand_total",
        (q) => applyDateRange(q, "invoice_date", filter),
        { orderBy: "invoice_date" }
      ),
    resolver: async ({ filter }) => {
      const [{ sum }, count] = await Promise.all([
        sumColumn("invoices", "grand_total", (q) => applyDateRange(q, "invoice_date", filter)),
        countRows("invoices", (q) => applyDateRange(q, "invoice_date", filter)),
      ]);
      const value = round2(sum);
      return { value, amountGbp: value, count, breakdown: { invoices: count, revenue: value } };
    },
  }),

  defineKpi({
    id: "acc.labour_revenue",
    label: "Labour Revenue",
    department: "accounts",
    relatedDepartments: ["workshop"],
    description: "£ value of labour invoiced in the period.",
    purpose: "Labour commercial output; cross-checks the Workshop sold-hours estimate.",
    formula: "Σ invoices.labour_total",
    sourceTables: ["invoices"],
    sourceEvents: ["INVOICE_CREATED"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "sum",
    unit: "currency",
    format: "£0,0.00",
    targetType: "higher_is_better",
    permission: FINANCIAL_PERMISSION,
    relatedReports: ["wsh.labour_sales"],
    futureNotes:
      "Invoiced labour (invoices.labour_total) is the trustworthy money; Workshop's wsh.labour_sales is a sold-hours × rate estimate. Divergence is a data-quality signal, not a second formula.",
    drilldown: async ({ filter }) =>
      fetchRows(
        "invoices",
        "id,invoice_number,job_number,account_number,invoice_date,labour_total,grand_total",
        (q) => applyDateRange(q.gt("labour_total", 0), "invoice_date", filter),
        { orderBy: "labour_total", ascending: false }
      ),
    resolver: async ({ filter }) => {
      const { sum } = await sumColumn("invoices", "labour_total", (q) => applyDateRange(q, "invoice_date", filter));
      const value = round2(sum);
      return { value, amountGbp: value };
    },
  }),

  defineKpi({
    id: "acc.parts_revenue",
    label: "Parts Revenue",
    department: "accounts",
    relatedDepartments: ["parts"],
    description: "£ value of parts invoiced in the period.",
    purpose: "Parts commercial output; cross-checks the Parts fitted-line revenue.",
    formula: "Σ invoices.parts_total",
    sourceTables: ["invoices"],
    sourceEvents: ["INVOICE_CREATED"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "sum",
    unit: "currency",
    format: "£0,0.00",
    targetType: "higher_is_better",
    permission: FINANCIAL_PERMISSION,
    relatedReports: ["prt.revenue"],
    futureNotes:
      "Invoiced parts (invoices.parts_total) is the trustworthy money; Parts' prt.revenue is the fitted-line value. They reconcile once counter sales are linked to revenue (Parts improvement).",
    drilldown: async ({ filter }) =>
      fetchRows(
        "invoices",
        "id,invoice_number,job_number,account_number,invoice_date,parts_total,grand_total",
        (q) => applyDateRange(q.gt("parts_total", 0), "invoice_date", filter),
        { orderBy: "parts_total", ascending: false }
      ),
    resolver: async ({ filter }) => {
      const { sum } = await sumColumn("invoices", "parts_total", (q) => applyDateRange(q, "invoice_date", filter));
      const value = round2(sum);
      return { value, amountGbp: value };
    },
  }),

  defineKpi({
    id: "acc.outstanding_invoices",
    label: "Outstanding Invoices",
    department: "accounts",
    description: "Count and value of invoices in Sent/Overdue (unpaid) state — the AR pipeline / invoice volume awaiting collection.",
    purpose: "Collection workload and the live invoice pipeline.",
    formula: "COUNT/Σ(invoices where payment_status in {Sent, Overdue})",
    sourceTables: ["invoices"],
    sourceEvents: ["INVOICE_STATUS_CHANGED"],
    tier: "operational",
    readiness: "R1",
    aggregation: "point_in_time",
    unit: "count",
    targetType: "lower_is_better",
    permission: FINANCIAL_PERMISSION,
    futureNotes:
      "Point-in-time (ignores the date range — it is the current unpaid pipeline). `amountGbp` carries the outstanding value alongside the count, per the catalogue's COUNT/Σ formula.",
    drilldown: async () =>
      fetchRows(
        "invoices",
        "id,invoice_number,job_number,account_number,payment_status,grand_total,due_date",
        (q) => q.in("payment_status", UNPAID_STATUSES),
        { orderBy: "due_date", ascending: true }
      ),
    resolver: async () => {
      const [count, { sum }] = await Promise.all([
        countRows("invoices", (q) => q.in("payment_status", UNPAID_STATUSES)),
        sumColumn("invoices", "grand_total", (q) => q.in("payment_status", UNPAID_STATUSES)),
      ]);
      const amount = round2(sum);
      return { value: count, count, amountGbp: amount, breakdown: { outstanding_invoices: count, outstanding_value: amount } };
    },
  }),

  // =========================================================================
  // PAYMENTS & RECEIVABLES (R1)
  // =========================================================================
  defineKpi({
    id: "acc.ar",
    label: "Accounts Receivable",
    department: "accounts",
    description: "Net money owed to the business — total invoiced (issued) less total collected.",
    purpose: "The receivables book balance; collection health.",
    formula: "Σ unpaid invoice balances",
    numerator: "Σ invoices.grand_total (issued)",
    denominator: "Σ invoice_payments.amount (collected)",
    sourceTables: ["invoices", "invoice_payments"],
    sourceEvents: ["INVOICE_CREATED", "PAYMENT_RECEIVED"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "point_in_time",
    unit: "currency",
    format: "£0,0.00",
    targetType: "lower_is_better",
    permission: FINANCIAL_PERMISSION,
    futureNotes:
      "Point-in-time net receivable = Σ issued (non-Draft) grand_total − Σ invoice_payments.amount, so partial payments are netted (the catalogue's R1 path via invoice_payments). Per-invoice payment application and a precise as-of-date balance arrive with invoice_status_history (R2). Denormalised totals (D12) and any invoice marked paid without a payment row can skew the figure — flagged, not silent.",
    drilldown: async () =>
      fetchRows(
        "invoices",
        "id,invoice_number,account_number,payment_status,grand_total,due_date,invoice_date",
        (q) => q.in("payment_status", UNPAID_STATUSES),
        { orderBy: "due_date", ascending: true }
      ),
    resolver: async () => {
      const [{ sum: billed }, { sum: collected }] = await Promise.all([
        sumColumn("invoices", "grand_total", (q) => q.not("payment_status", "in", "(Draft,draft,DRAFT)")),
        sumColumn("invoice_payments", "amount"),
      ]);
      const value = round2(billed - collected);
      return { value, amountGbp: value, breakdown: { billed: round2(billed), collected: round2(collected) } };
    },
  }),

  defineKpi({
    id: "acc.payments_received",
    label: "Payments Received",
    department: "accounts",
    description: "£ collected in the period (invoice payments) and payment count.",
    purpose: "Cash collection throughput; the payment-trend base.",
    formula: "Σ invoice_payments.amount in period",
    sourceTables: ["invoice_payments"],
    sourceEvents: ["PAYMENT_RECEIVED", "INVOICE_PAID"],
    tier: "operational",
    readiness: "R1",
    aggregation: "sum",
    unit: "currency",
    format: "£0,0.00",
    targetType: "higher_is_better",
    permission: FINANCIAL_PERMISSION,
    drilldown: async ({ filter }) =>
      fetchRows(
        "invoice_payments",
        "payment_id,invoice_id,amount,payment_method,reference,payment_date",
        (q) => applyDateRange(q, "payment_date", filter),
        { orderBy: "payment_date" }
      ),
    resolver: async ({ filter }) => {
      const [{ sum }, count] = await Promise.all([
        sumColumn("invoice_payments", "amount", (q) => applyDateRange(q, "payment_date", filter)),
        countRows("invoice_payments", (q) => applyDateRange(q, "payment_date", filter)),
      ]);
      const value = round2(sum);
      return { value, amountGbp: value, count, breakdown: { payments: count, amount: value } };
    },
  }),

  defineKpi({
    id: "acc.account_balances",
    label: "Account Balances",
    department: "accounts",
    description: "Point-in-time total balance across active customer accounts.",
    purpose: "Capital outstanding on credit accounts.",
    formula: "accounts.balance (point-in-time)",
    sourceTables: ["accounts"],
    sourceEvents: ["TRANSACTION_POSTED"],
    tier: "operational",
    readiness: "R1",
    aggregation: "point_in_time",
    unit: "currency",
    format: "£0,0.00",
    targetType: "informational",
    permission: FINANCIAL_PERMISSION,
    futureNotes:
      "`accounts.balance` is denormalised — reconcile against account_transactions (D12). Point-in-time (ignores the date range). Active accounts only.",
    drilldown: async () =>
      fetchRows(
        "accounts",
        "account_id,billing_name,account_type,balance,credit_limit,status",
        (q) => q.eq("status", "Active").neq("balance", 0),
        { orderBy: "balance", ascending: false }
      ),
    resolver: async () => {
      const [{ sum }, count] = await Promise.all([
        sumColumn("accounts", "balance", (q) => q.eq("status", "Active")),
        countRows("accounts", (q) => q.eq("status", "Active").neq("balance", 0)),
      ]);
      const value = round2(sum);
      return { value, amountGbp: value, count, breakdown: { total_balance: value, accounts_with_balance: count } };
    },
  }),

  defineKpi({
    id: "acc.credit_exposure",
    label: "Credit Exposure",
    department: "accounts",
    description: "Total credit-account balance, and the count of accounts at ≥80% of their credit limit.",
    purpose: "Credit risk concentration; the over-limit watchlist.",
    formula: "Σ(account balance); COUNT(accounts ≥80% of credit_limit)",
    numerator: "COUNT(accounts where balance ≥ 0.8 × credit_limit)",
    denominator: "Σ accounts.balance (active)",
    sourceTables: ["accounts"],
    sourceEvents: ["CREDIT_LIMIT_CHANGED", "TRANSACTION_POSTED"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "point_in_time",
    unit: "count",
    targetType: "lower_is_better",
    permission: FINANCIAL_PERMISSION,
    example: "£42k exposure; 3 accounts ≥80%",
    futureNotes:
      "Σ balance is an exact paginated column sum; the ≥80% at-risk count needs a balance-vs-credit_limit comparison, computed over active accounts (a small dimension table) — the same approach the existing /api/accounts reporting view uses. `value` is the at-risk count; `amountGbp` is total exposure.",
    drilldown: async () =>
      fetchRows(
        "accounts",
        "account_id,billing_name,account_type,balance,credit_limit,status",
        (q) => q.eq("status", "Active").gt("credit_limit", 0),
        { orderBy: "balance", ascending: false, limit: 1000 }
      ),
    resolver: async () => {
      const { sum } = await sumColumn("accounts", "balance", (q) => q.eq("status", "Active"));
      // Cross-column comparison (balance vs credit_limit) is not expressible as a
      // single PostgREST count; compute it over the (small) active-accounts set.
      const rows = await fetchRows(
        "accounts",
        "account_id,balance,credit_limit,status",
        (q) => q.eq("status", "Active"),
        { limit: 1000, orderBy: "balance", ascending: false }
      );
      let atRisk = 0;
      for (const a of rows) {
        const limit = Number(a.credit_limit || 0);
        if (limit > 0 && Number(a.balance || 0) / limit >= 0.8) atRisk += 1;
      }
      const exposure = round2(sum);
      return { value: atRisk, count: atRisk, amountGbp: exposure, breakdown: { total_exposure: exposure, accounts_at_risk: atRisk } };
    },
  }),

  // =========================================================================
  // DECLARED — not yet implemented (R2/R3 blockers documented). NO resolver:
  // the engine reports them as "declared, readiness Rn" so the UI / catalogue
  // lists the metric and its exact blocker honestly, lighting up in a later phase
  // once the prerequisite lands. All remain FINANCIAL-GATED.
  // =========================================================================

  // ---- R2: need invoice_status_history accrual (P4 priority 3) -------------
  defineKpi({
    id: "acc.dso",
    label: "Days Sales Outstanding",
    department: "accounts",
    description: "Mean days from invoice issue to payment, value-weighted.",
    formula: "mean(paid_at − issued_at) weighted by value",
    sourceTables: ["invoices", "invoice_payments"],
    sourceEvents: ["INVOICE_ISSUED", "INVOICE_PAID"],
    sourceHistories: ["invoice_status_history"],
    tier: "strategic",
    readiness: "R2",
    aggregation: "duration",
    unit: "duration",
    targetType: "lower_is_better",
    permission: FINANCIAL_PERMISSION,
    futureNotes:
      "R2 — there is no paid_at today (only a `paid` bool + current payment_status); issue→payment latency needs invoice_status_history transitions (emits ON).",
  }),
  defineKpi({
    id: "acc.invoice_ageing",
    label: "Invoice Ageing",
    department: "accounts",
    description: "Accounts receivable bucketed 0-30 / 31-60 / 61-90 / 90+ days.",
    formula: "AR bucketed by age (0-30/31-60/61-90/90+ days)",
    sourceTables: ["invoices"],
    sourceEvents: ["INVOICE_STATUS_CHANGED"],
    sourceHistories: ["invoice_status_history"],
    snapshotSource: "report_entity_state_snapshot",
    tier: "tactical",
    readiness: "R2",
    aggregation: "distinct",
    unit: "currency",
    format: "£0,0.00",
    targetType: "lower_is_better",
    permission: FINANCIAL_PERMISSION,
    futureNotes:
      "R2 — coarse ageing by due_date is possible, but trustworthy ageing-by-transition (and an ar_ageing_snapshot) needs invoice_status_history. Declared until the history accrues.",
  }),
  defineKpi({
    id: "acc.payment_conversion",
    label: "Payment Conversion",
    department: "accounts",
    description: "Share of Sent invoices that reach Paid.",
    formula: "COUNT(Sent invoices → Paid) ÷ COUNT(Sent) × 100",
    sourceTables: ["invoices"],
    sourceEvents: ["INVOICE_PAID", "INVOICE_STATUS_CHANGED"],
    sourceHistories: ["invoice_status_history"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    permission: FINANCIAL_PERMISSION,
    futureNotes:
      "R2 — the Sent→Paid transition denominator/numerator needs invoice_status_history; the current payment_status snapshot loses the transition path.",
  }),
  defineKpi({
    id: "acc.profitability",
    label: "Profitability by Department",
    department: "accounts",
    relatedDepartments: ["workshop", "parts"],
    description: "Per-department revenue less cost.",
    formula: "per-department (revenue − cost)",
    dependsOn: ["acc.revenue", "prt.margin", "wsh.profitability"],
    sourceTables: ["invoices"],
    tier: "strategic",
    readiness: "R2",
    aggregation: "sum",
    unit: "currency",
    format: "£0,0.00",
    targetType: "higher_is_better",
    permission: FINANCIAL_PERMISSION,
    futureNotes:
      "R2 — needs the department dimension stamped on invoice/revenue events plus cost inputs. Labour/parts gross profit is available department-side; full GP needs COGS (R3).",
  }),

  // ---- R3: need missing financial inputs (COGS / opex) ---------------------
  defineKpi({
    id: "acc.gross_profit",
    label: "Gross Profit",
    department: "accounts",
    description: "Revenue less cost of goods sold.",
    formula: "revenue − COGS",
    dependsOn: ["acc.revenue"],
    sourceTables: ["invoices", "invoice_items"],
    tier: "executive",
    readiness: "R3",
    aggregation: "sum",
    unit: "currency",
    format: "£0,0.00",
    targetType: "higher_is_better",
    permission: FINANCIAL_PERMISSION,
    futureNotes:
      "R3 — no COGS on invoice snapshots (needs cost on invoice lines). Until then GP is approximated from prt.margin + labour GP (wsh.profitability). Requires profitability modelling.",
  }),
  defineKpi({
    id: "acc.net_profit",
    label: "Net Profit",
    department: "accounts",
    description: "Gross profit less operating costs.",
    formula: "gross_profit − operating costs",
    dependsOn: ["acc.gross_profit"],
    sourceTables: ["invoices"],
    tier: "executive",
    readiness: "R3",
    aggregation: "sum",
    unit: "currency",
    format: "£0,0.00",
    targetType: "higher_is_better",
    permission: FINANCIAL_PERMISSION,
    futureNotes:
      "R3 — depends on gross profit (R3) and an operating-cost (opex) model; likely needs an accounting-system integration. Requires additional financial entities.",
  }),
];

export default accountsKpis;
