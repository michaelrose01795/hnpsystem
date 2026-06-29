// file location: src/lib/reporting/kpiDefinitions/parts.js
//
// Parts KPI definitions (Phase-3 §6, promoted for the Phase-7 Parts report
// package). Every formula here is taken VERBATIM from the KPI catalogue
// (docs/Report System/reporting-kpi-catalogue-architecture.md §6) — no metric is
// invented and no calculation is bypassed. R1 metrics that compute trust-correctly
// today from operational tables carry a `resolver`; R2/R3 metrics are DECLARED
// (catalogue entry, no resolver) so they surface in the catalogue/UI as "declared,
// not yet implemented" with their exact blocker, rather than being silently
// omitted — exactly the discipline the Workshop package (Phase 6) established.
//
// All counting/summing/grouping goes through queryBuilder (exact counts, paginated
// sums, paginated product-sums — never `.limit()` as a total) so the numbers cannot
// regress to the D8 truncation bug the audit found ("open parts by status" was the
// canonical example of a list truncated by .limit()).
//
// Readiness gating (Phase-3 §0.3): R1 = all sources exist today; R2 = blocked by
// missing history/events (no parts_job_items_status_history accrued yet, no
// per-line ordered/approved transition); R3 = blocked by a missing entity (no
// `suppliers` master). The catalogue's readiness tag is the authority — it decides
// resolver vs declared, never a guess here.

import { defineKpi } from "../kpiCatalog";
import { applyDateRange, countRows, sumColumn, sumProduct, groupCount, fetchRows } from "../queryBuilder";
import { normaliseStatus } from "../config/statusMaps";

// ---------------------------------------------------------------------------
// Shared helpers (kept faithful to the catalogue formulas).
// ---------------------------------------------------------------------------

// Terminal part-line statuses excluded from the "open" backlog (Phase-3 §6
// prt.open_by_status; matches the seed definition this file expands).
const TERMINAL_PART_STATES = ["fitted", "cancelled", "removed"];

// Fitted/sold part lines used by the value family (revenue, margin, profitability,
// stock_turn COGS). The catalogue formulas all read parts_job_items.qty_fitted on
// fitted/sold lines (Σ unit_price × qty_fitted etc.). Until parts status-history
// accrues a true PART_FITTED timestamp (R2), fitting time is proxied by the row's
// updated_at — the same documented proxy the Workshop package used for "released"
// (completed_at). Flagged in every dependent KPI's futureNotes, never silent.
const fittedLineBuild = (filter) => (q) =>
  applyDateRange(q.eq("status", "fitted"), "updated_at", filter);

// parts_job_items revenue (Σ unit_price × quantity_fitted) and cost
// (Σ unit_cost × quantity_fitted) over fitted lines in the period. One place so
// revenue / margin / profitability / stock_turn all agree (Principle 2).
async function sumFittedValue(filter) {
  const [revenue, cost] = await Promise.all([
    sumProduct("parts_job_items", "unit_price", "quantity_fitted", fittedLineBuild(filter)),
    sumProduct("parts_job_items", "unit_cost", "quantity_fitted", fittedLineBuild(filter)),
  ]);
  return { revenue: revenue.sum || 0, cost: cost.sum || 0 };
}

// Point-in-time stock value: Σ qty_in_stock × unit_cost over the catalogue
// (prt.stock_value). No date filter — it is a snapshot of "now".
async function currentStockValue() {
  const { sum } = await sumProduct("parts_catalog", "qty_in_stock", "unit_cost", (q) =>
    q.gt("qty_in_stock", 0)
  );
  return sum || 0;
}

export const partsKpis = [
  // =========================================================================
  // OPERATIONAL — demand & pipeline (R1, buildable now)
  // =========================================================================
  defineKpi({
    id: "prt.requests",
    label: "Parts Requests",
    department: "parts",
    relatedDepartments: ["workshop", "vhc"],
    description: "Part lines created/requested in the period.",
    purpose: "Demand volume; the VHC→parts conversion denominator.",
    formula: "COUNT(parts_job_items created in period)",
    sourceTables: ["parts_job_items"],
    sourceEvents: ["PART_REQUESTED"],
    tier: "operational",
    readiness: "R1",
    aggregation: "sum",
    unit: "count",
    targetType: "informational",
    example: "42/day",
    relatedReports: ["prt.vhc_conversion"],
    drilldown: async ({ filter }) =>
      fetchRows(
        "parts_job_items",
        "id,job_id,part_id,status,quantity_requested,origin,created_at",
        (q) => applyDateRange(q, "created_at", filter),
        { orderBy: "created_at" }
      ),
    resolver: async ({ filter }) => {
      const count = await countRows("parts_job_items", (q) => applyDateRange(q, "created_at", filter));
      return { value: count, count };
    },
  }),

  defineKpi({
    id: "prt.open_by_status",
    label: "Open Parts by Status",
    department: "parts",
    relatedDepartments: ["workshop"],
    description: "Point-in-time distribution of open part lines across the 14-status model.",
    purpose: "Backlog & pipeline visibility per status (dwell candidates).",
    formula: "COUNT(parts_job_items) grouped by status (excluding terminal states)",
    sourceTables: ["parts_job_items"],
    sourceEvents: ["PART_STATUS_CHANGED"],
    snapshotSource: "report_entity_state_snapshot",
    tier: "operational",
    readiness: "R1",
    aggregation: "point_in_time",
    unit: "count",
    targetType: "informational",
    drilldown: async () =>
      fetchRows(
        "parts_job_items",
        "id,job_id,status,quantity_requested,created_at",
        (q) => q.not("status", "in", "(fitted,cancelled,removed)"),
        { orderBy: "created_at", ascending: true }
      ),
    // Returns the headline open count as `value` and the full distribution in
    // `breakdown` (status-normalised so authorize/authorise-style drift collapses).
    resolver: async () => {
      const raw = await groupCount("parts_job_items", "status");
      const breakdown = {};
      let open = 0;
      for (const [status, n] of Object.entries(raw)) {
        if (status === "(null)") continue;
        const canonical = normaliseStatus("part", status) || status;
        breakdown[canonical] = (breakdown[canonical] || 0) + n;
        if (!TERMINAL_PART_STATES.includes(canonical)) open += n;
      }
      return { value: open, count: open, breakdown };
    },
  }),

  defineKpi({
    id: "prt.ordered",
    label: "Parts Ordered",
    department: "parts",
    relatedDepartments: ["accounts"],
    description: "Supplier order lines placed in the period, with on-order value.",
    purpose: "Ordering throughput and committed spend.",
    formula: "COUNT(status→on_order) / Σ on-order value",
    sourceTables: ["parts_job_items", "parts_deliveries", "parts_delivery_items"],
    sourceEvents: ["PART_ORDERED"],
    tier: "operational",
    readiness: "R1",
    aggregation: "sum",
    unit: "count",
    targetType: "informational",
    example: "17 lines, £1,240 on order",
    futureNotes:
      "Counts parts_delivery_items created in the period (an order line = a part placed on order). Precise per-line status→on_order transition timing arrives at R2 once parts_job_items_status_history accrues.",
    drilldown: async ({ filter }) =>
      fetchRows(
        "parts_delivery_items",
        "id,delivery_id,part_id,job_id,quantity_ordered,unit_cost,status,created_at",
        (q) => applyDateRange(q, "created_at", filter),
        { orderBy: "created_at" }
      ),
    resolver: async ({ filter }) => {
      const [count, value] = await Promise.all([
        countRows("parts_delivery_items", (q) => applyDateRange(q, "created_at", filter)),
        sumProduct("parts_delivery_items", "quantity_ordered", "unit_cost", (q) =>
          applyDateRange(q, "created_at", filter)
        ),
      ]);
      const onOrderValue = Math.round((value.sum || 0) * 100) / 100;
      return { value: count, count, amountGbp: onOrderValue, breakdown: { lines: count, on_order_value: onOrderValue } };
    },
  }),

  defineKpi({
    id: "prt.received",
    label: "Parts Received",
    department: "parts",
    relatedDepartments: ["workshop"],
    description: "Goods received into stock in the period (delivery movements).",
    purpose: "Goods-in throughput; closes the order→receive loop.",
    formula: "COUNT/Σqty received",
    sourceTables: ["parts_deliveries", "parts_delivery_items", "parts_stock_movements"],
    sourceEvents: ["PART_RECEIVED", "STOCK_RECEIVED"],
    tier: "operational",
    readiness: "R1",
    aggregation: "sum",
    unit: "count",
    targetType: "informational",
    futureNotes:
      "Uses parts_stock_movements (movement_type='delivery') as the dated receipt event — the inventory ledger is the trustworthy received-in-period source today.",
    drilldown: async ({ filter }) =>
      fetchRows(
        "parts_stock_movements",
        "id,part_id,delivery_item_id,movement_type,quantity,unit_cost,reference,created_at",
        (q) => applyDateRange(q.eq("movement_type", "delivery"), "created_at", filter),
        { orderBy: "created_at" }
      ),
    resolver: async ({ filter }) => {
      const [count, qty] = await Promise.all([
        countRows("parts_stock_movements", (q) =>
          applyDateRange(q.eq("movement_type", "delivery"), "created_at", filter)
        ),
        sumColumn("parts_stock_movements", "quantity", (q) =>
          applyDateRange(q.eq("movement_type", "delivery"), "created_at", filter)
        ),
      ]);
      const qtyReceived = qty.sum || 0;
      return { value: count, count, breakdown: { receipt_lines: count, quantity_received: qtyReceived } };
    },
  }),

  defineKpi({
    id: "prt.fitted",
    label: "Parts Fitted",
    department: "parts",
    relatedDepartments: ["workshop"],
    description: "Part lines fitted to vehicles in the period.",
    purpose: "Consumption / fulfilment output; basis of parts revenue.",
    formula: "COUNT(status→fitted) / Σ quantity_fitted",
    sourceTables: ["parts_job_items"],
    sourceEvents: ["PART_FITTED"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "sum",
    unit: "count",
    targetType: "higher_is_better",
    futureNotes:
      "Counts parts_job_items with status='fitted' dated by updated_at (the fitting proxy until PART_FITTED status-history accrues at R2 — the same documented proxy Workshop used for 'released').",
    drilldown: async ({ filter }) =>
      fetchRows(
        "parts_job_items",
        "id,job_id,part_id,status,quantity_fitted,unit_price,updated_at",
        (q) => applyDateRange(q.eq("status", "fitted"), "updated_at", filter),
        { orderBy: "updated_at" }
      ),
    resolver: async ({ filter }) => {
      const [count, qty] = await Promise.all([
        countRows("parts_job_items", (q) => applyDateRange(q.eq("status", "fitted"), "updated_at", filter)),
        sumColumn("parts_job_items", "quantity_fitted", (q) =>
          applyDateRange(q.eq("status", "fitted"), "updated_at", filter)
        ),
      ]);
      return { value: count, count, breakdown: { fitted_lines: count, quantity_fitted: qty.sum || 0 } };
    },
  }),

  defineKpi({
    id: "prt.vhc_conversion",
    label: "VHC→Parts Conversion",
    department: "parts",
    relatedDepartments: ["vhc", "workshop"],
    description: "Authorised-VHC part lines against authorised VHC items.",
    purpose: "How much identified VHC work converts into ordered/fitted parts.",
    formula: "COUNT(part lines from authorised VHC) ÷ COUNT(authorised VHC items needing parts) × 100",
    numerator: "COUNT(parts_job_items linked to a VHC item and authorised)",
    denominator: "COUNT(authorised vhc_checks)",
    sourceTables: ["parts_job_items", "vhc_checks"],
    sourceEvents: ["VHC_AUTHORISED"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    futureNotes:
      "Denominator is all authorised VHC items in the period; a precise 'needing parts' filter on the VHC item arrives once the VHC item model carries a needs-parts signal (improvement). Ratio is lines÷items per the catalogue formula, so it can exceed 100% (multiple part lines per VHC item).",
    // Ratio KPI: drill-down shows the NUMERATOR — authorised part lines linked to a
    // VHC item. The denominator (authorised vhc_checks) is counted separately, so
    // the row count reconciles with `numerator`, not the percentage.
    drilldown: async ({ filter }) =>
      fetchRows(
        "parts_job_items",
        "id,job_id,part_id,vhc_item_id,status,quantity_requested,authorised,created_at",
        (q) => applyDateRange(q.not("vhc_item_id", "is", null).eq("authorised", true), "created_at", filter),
        { orderBy: "created_at" }
      ),
    resolver: async ({ filter }) => {
      const [linkedAuthorised, authorisedVhc] = await Promise.all([
        countRows("parts_job_items", (q) =>
          applyDateRange(q.not("vhc_item_id", "is", null).eq("authorised", true), "created_at", filter)
        ),
        countRows("vhc_checks", (q) =>
          applyDateRange(q.in("approval_status", ["authorized", "authorised"]), "created_at", filter)
        ),
      ]);
      const value = authorisedVhc > 0 ? Math.round((linkedAuthorised / authorisedVhc) * 1000) / 10 : null;
      return { value, numerator: linkedAuthorised, denominator: authorisedVhc };
    },
  }),

  // =========================================================================
  // STOCK & INVENTORY (R1)
  // =========================================================================
  defineKpi({
    id: "prt.stock_value",
    label: "Stock Value",
    department: "parts",
    description: "Point-in-time valuation of parts in stock.",
    purpose: "Capital tied up in inventory; over/under-stock signal.",
    formula: "Σ qty_in_stock × unit_cost (point-in-time)",
    sourceTables: ["parts_catalog"],
    snapshotSource: "report_entity_state_snapshot",
    tier: "strategic",
    readiness: "R1",
    aggregation: "point_in_time",
    unit: "currency",
    format: "£0,0.00",
    targetType: "band",
    example: "current valuation of all in-stock lines",
    drilldown: async () =>
      fetchRows(
        "parts_catalog",
        "id,part_number,name,category,qty_in_stock,unit_cost,reorder_level",
        (q) => q.gt("qty_in_stock", 0),
        { orderBy: "qty_in_stock", ascending: false }
      ),
    resolver: async () => {
      const value = Math.round((await currentStockValue()) * 100) / 100;
      return { value, amountGbp: value, count: null };
    },
  }),

  defineKpi({
    id: "prt.stock_turn",
    label: "Stock Turnover",
    department: "parts",
    description: "Cost of parts sold over the period against average stock value.",
    purpose: "Inventory efficiency — how many times stock turns over.",
    formula: "COGS over period ÷ average stock value",
    numerator: "Σ cost of fitted/sold parts (unit_cost × quantity_fitted)",
    denominator: "average stock value (Σ qty_in_stock × unit_cost)",
    sourceTables: ["parts_stock_movements", "parts_catalog", "parts_job_items"],
    tier: "strategic",
    readiness: "R1",
    aggregation: "ratio",
    unit: "ratio",
    format: "0.0",
    targetType: "higher_is_better",
    example: "£18k ÷ £30k = 0.6 (×7.2 annualised)",
    permission: ["MANAGER_SCOPED_ROLES", "parts manager"],
    futureNotes:
      "Average stock value is approximated by the current point-in-time stock value until daily stock snapshots accrue (then the true period-average denominator is used — no formula change, snapshot-fed).",
    // Composite ratio (COGS over period ÷ avg stock value). Drill-down shows the
    // COGS side — the fitted/sold lines whose unit_cost × quantity_fitted form the
    // numerator. The denominator is a point-in-time stock snapshot, so the rows
    // reconcile with `numerator` (COGS), not the ratio.
    drilldown: async ({ filter }) =>
      fetchRows(
        "parts_job_items",
        "id,job_id,part_id,status,quantity_fitted,unit_cost,unit_price,updated_at",
        fittedLineBuild(filter),
        { orderBy: "updated_at" }
      ),
    resolver: async ({ filter }) => {
      const [{ cost }, stockValue] = await Promise.all([sumFittedValue(filter), currentStockValue()]);
      const cogs = Math.round(cost * 100) / 100;
      const value = stockValue > 0 ? Math.round((cogs / stockValue) * 100) / 100 : null;
      return { value, numerator: cogs, denominator: Math.round(stockValue * 100) / 100 };
    },
  }),

  // =========================================================================
  // COMMERCIAL — revenue / margin / profit (R1)
  // =========================================================================
  defineKpi({
    id: "prt.revenue",
    label: "Parts Revenue",
    department: "parts",
    relatedDepartments: ["accounts"],
    description: "£ value of parts fitted/sold in the period.",
    purpose: "Commercial output of the parts department.",
    formula: "Σ unit_price × qty_fitted (+ counter sales)",
    sourceTables: ["parts_job_items", "invoices", "parts_order_cards"],
    sourceEvents: ["INVOICE_CREATED"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "sum",
    unit: "currency",
    format: "£0,0.00",
    targetType: "higher_is_better",
    relatedReports: ["acc.revenue"],
    futureNotes:
      "Counter orders (parts_order_cards) are not yet linked to revenue — fitted job-line revenue only (catalogue improvement). Cross-check against invoiced invoices.parts_total belongs to the Accounts package.",
    // Drill-down shows the fitted part lines behind the revenue (totalling
    // unit_price × quantity_fitted reconciles with the headline value).
    drilldown: async ({ filter }) =>
      fetchRows(
        "parts_job_items",
        "id,job_id,part_id,status,quantity_fitted,unit_price,unit_cost,updated_at",
        fittedLineBuild(filter),
        { orderBy: "updated_at" }
      ),
    resolver: async ({ filter }) => {
      const { revenue } = await sumFittedValue(filter);
      const value = Math.round(revenue * 100) / 100;
      return { value, amountGbp: value, count: null };
    },
  }),

  defineKpi({
    id: "prt.margin",
    label: "Parts Margin",
    department: "parts",
    description: "Gross margin % on fitted/sold parts.",
    purpose: "Pricing health of parts sales.",
    formula: "(Σ unit_price − Σ unit_cost) ÷ Σ unit_price × 100 on fitted/sold lines",
    numerator: "Σ (unit_price − unit_cost) × quantity_fitted",
    denominator: "Σ unit_price × quantity_fitted",
    sourceTables: ["parts_job_items", "parts_stock_movements"],
    tier: "strategic",
    readiness: "R1",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "band",
    example: "(£1,000 − £640) ÷ £1,000 = 36%",
    permission: ["MANAGER_SCOPED_ROLES", "parts manager"],
    // Ratio KPI: drill-down shows the fitted lines (unit_price + unit_cost) the
    // margin is computed from. Margin % itself doesn't sum, but per-line price/cost
    // make the rate auditable.
    drilldown: async ({ filter }) =>
      fetchRows(
        "parts_job_items",
        "id,job_id,part_id,status,quantity_fitted,unit_price,unit_cost,updated_at",
        fittedLineBuild(filter),
        { orderBy: "updated_at" }
      ),
    resolver: async ({ filter }) => {
      const { revenue, cost } = await sumFittedValue(filter);
      const value = revenue > 0 ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : null;
      return {
        value,
        numerator: Math.round((revenue - cost) * 100) / 100,
        denominator: Math.round(revenue * 100) / 100,
        breakdown: { revenue: Math.round(revenue * 100) / 100, cost: Math.round(cost * 100) / 100 },
      };
    },
  }),

  defineKpi({
    id: "prt.profitability",
    label: "Parts Profitability",
    department: "parts",
    description: "Gross profit (£) on fitted/sold parts.",
    purpose: "Absolute parts contribution; feeds department/executive profitability.",
    formula: "parts_revenue − parts_cost",
    numerator: "Σ unit_price × quantity_fitted",
    denominator: "Σ unit_cost × quantity_fitted",
    dependsOn: ["prt.revenue", "prt.margin"],
    sourceTables: ["parts_job_items", "parts_stock_movements"],
    tier: "strategic",
    readiness: "R1",
    aggregation: "sum",
    unit: "currency",
    format: "£0,0.00",
    targetType: "higher_is_better",
    permission: ["MANAGER_SCOPED_ROLES", "parts manager"],
    // Drill-down shows the fitted lines (unit_price + unit_cost) whose price−cost
    // gross profit sums to the value.
    drilldown: async ({ filter }) =>
      fetchRows(
        "parts_job_items",
        "id,job_id,part_id,status,quantity_fitted,unit_price,unit_cost,updated_at",
        fittedLineBuild(filter),
        { orderBy: "updated_at" }
      ),
    resolver: async ({ filter }) => {
      const { revenue, cost } = await sumFittedValue(filter);
      const value = Math.round((revenue - cost) * 100) / 100;
      return { value, amountGbp: value, breakdown: { revenue: Math.round(revenue * 100) / 100, cost: Math.round(cost * 100) / 100 } };
    },
  }),

  // =========================================================================
  // DECLARED — not yet implemented (R2/R3 blockers documented). These carry NO
  // resolver: the engine reports them as "declared, readiness Rn" so the UI /
  // catalogue lists the metric and its exact blocker honestly, lighting up in a
  // later phase once the prerequisite lands.
  // =========================================================================

  // ---- R2: need parts_job_items_status_history accrual (P4 priority 1) -----
  defineKpi({
    id: "prt.approved",
    label: "Parts Approved",
    department: "parts",
    relatedDepartments: ["workshop"],
    description: "Part lines approved, and approved ÷ requested.",
    formula: "COUNT(PART_APPROVED); ratio approved ÷ requested",
    sourceTables: ["parts_job_items"],
    sourceEvents: ["PART_APPROVED"],
    sourceHistories: ["parts_job_items_status_history"],
    tier: "operational",
    readiness: "R2",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "informational",
    futureNotes:
      "R2 — approval is a transition; the count and especially approval latency need parts_job_items_status_history (emits ON). A current authorised-flag snapshot is not a period-of-approval measure.",
  }),
  defineKpi({
    id: "prt.cancelled",
    label: "Parts Cancelled",
    department: "parts",
    relatedDepartments: ["workshop", "accounts"],
    description: "Cancelled/removed part lines as a share of requested.",
    formula: "COUNT(→cancelled|removed) ÷ COUNT(requested) × 100",
    sourceTables: ["parts_job_items"],
    sourceEvents: ["PART_CANCELLED", "PART_REMOVED"],
    sourceHistories: ["parts_job_items_status_history"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "lower_is_better",
    futureNotes:
      "R2 — needs the →cancelled/→removed transition (with reason codes desirable) from parts_job_items_status_history; current status alone loses when/why a line was cancelled.",
  }),
  defineKpi({
    id: "prt.unavailable",
    label: "Parts Unavailable",
    department: "parts",
    relatedDepartments: ["workshop"],
    description: "Lines marked unavailable as a share of requested (supplier fill signal).",
    formula: "COUNT(→unavailable) ÷ requested × 100",
    sourceTables: ["parts_job_items"],
    sourceEvents: ["PART_UNAVAILABLE"],
    sourceHistories: ["parts_job_items_status_history"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "lower_is_better",
    futureNotes: "R2 — needs the →unavailable transition captured in parts_job_items_status_history.",
  }),
  defineKpi({
    id: "prt.lead_time",
    label: "Parts Lead Time",
    department: "parts",
    relatedDepartments: ["accounts"],
    description: "Ordered→received elapsed time per line.",
    formula: "mean(received_at − ordered_at) per line",
    sourceTables: ["parts_delivery_items"],
    sourceEvents: ["PART_ORDERED", "PART_RECEIVED"],
    sourceHistories: ["parts_job_items_status_history"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "duration",
    unit: "duration",
    targetType: "lower_is_better",
    example: "median 1.4 days",
    futureNotes:
      "R2 — coarse today (no per-line ordered_at timestamp); precise via parts_job_items_status_history transitions. Supplier-level lead time needs the suppliers master (R3).",
  }),
  defineKpi({
    id: "prt.ageing",
    label: "Parts Ageing / Dwell",
    department: "parts",
    relatedDepartments: ["workshop"],
    description: "How long open lines sit in each status, bucketed.",
    formula: "now − status_entered_at, bucketed by status",
    sourceTables: ["parts_job_items"],
    sourceEvents: ["PART_STATUS_CHANGED"],
    sourceHistories: ["parts_job_items_status_history"],
    snapshotSource: "report_entity_state_snapshot",
    tier: "tactical",
    readiness: "R2",
    aggregation: "duration",
    unit: "duration",
    targetType: "lower_is_better",
    futureNotes:
      "R2 — needs status_entered_at from parts_job_items_status_history (the open-by-status backlog is live today via prt.open_by_status; the time-in-status dwell needs the history).",
  }),
  defineKpi({
    id: "prt.pick_rate",
    label: "Pick Rate",
    department: "parts",
    relatedDepartments: ["workshop"],
    description: "Pre-pick→picked throughput / pick workload by zone.",
    formula: "COUNT(→picked) per period; by pre_pick_location",
    sourceTables: ["parts_job_items"],
    sourceEvents: ["PART_PRE_PICKED", "PART_PICKED"],
    sourceHistories: ["parts_job_items_status_history"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "sum",
    unit: "count",
    targetType: "informational",
    futureNotes:
      "R2 — the →picked transition (and by-zone split) needs parts_job_items_status_history; pre_pick_location exists on the line but the pick event timing does not yet.",
  }),
  defineKpi({
    id: "prt.backorder_rate",
    label: "Backorder Rate",
    department: "parts",
    relatedDepartments: ["accounts"],
    description: "Delivery items on backorder as a share of ordered.",
    formula: "COUNT(delivery items status=backorder) ÷ ordered × 100",
    sourceTables: ["parts_delivery_items"],
    sourceEvents: ["PART_ORDERED"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "lower_is_better",
    futureNotes:
      "R2 — parts_delivery_items.status carries 'backorder' today, but a trustworthy rate needs the PART_ORDERED event spine to anchor the denominator to orders placed in-period (not the current snapshot of line statuses).",
  }),

  // ---- R3: need the `suppliers` master entity (P7) -------------------------
  defineKpi({
    id: "prt.supplier_performance",
    label: "Supplier Performance",
    department: "parts",
    description: "Per-supplier lead time, fill rate, on-time %, price variance.",
    formula: "per-supplier composite (lead time, fill rate, on-time %, price variance)",
    sourceTables: ["parts_deliveries", "parts_delivery_items"],
    tier: "strategic",
    readiness: "R3",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    permission: ["MANAGER_SCOPED_ROLES", "parts manager"],
    futureNotes:
      "R3 — supplier is free-text on parts_deliveries/parts_catalog; a `suppliers` master with supplier_id FKs is the prerequisite (the single biggest Parts R3 unlock). Supplier modelling required.",
  }),
  defineKpi({
    id: "prt.fill_rate",
    label: "Fill Rate",
    department: "parts",
    relatedDepartments: ["accounts"],
    description: "Quantity received against quantity ordered.",
    formula: "Σ qty_received ÷ Σ qty_ordered × 100 per supplier/period",
    sourceTables: ["parts_delivery_items"],
    tier: "tactical",
    readiness: "R3",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    futureNotes:
      "Aggregate (all-supplier) fill rate is R2; per-supplier fill rate is R3 (needs the suppliers master). Declared until the supplier dimension and the order/receive event anchoring land.",
  }),
];

export default partsKpis;
