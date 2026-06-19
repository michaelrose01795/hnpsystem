// file location: src/components/reporting/parts/partsReportConfig.js
//
// Presentation grouping for the Parts report package: which catalogue KPIs appear
// in which tab, and the display metadata (unit/format/readiness/drilldown) that
// mirrors the KPI definitions in src/lib/reporting/kpiDefinitions/parts.js. This is
// LAYOUT ONLY — every value, formula and calculation still comes from the engine
// via /api/reports/*. The ids here are the contract; nothing is recomputed.
//
// Structure mirrors the Workshop package exactly: Overview · Operations · Stock &
// Inventory · Supplier & Ordering · Reporting Utilities.

export const PARTS_DEPARTMENT = { code: "parts", label: "Parts" };
export const PARTS_VIEW_TARGET = "reports:parts";

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
  K("prt.requests", "Parts Requests", "count", "0,0", "R1", true, "Part lines requested in the period."),
  K("prt.ordered", "Parts Ordered", "count", "0,0", "R1", true, "Supplier order lines placed."),
  K("prt.received", "Parts Received", "count", "0,0", "R1", true, "Goods received into stock."),
  K("prt.fitted", "Parts Fitted", "count", "0,0", "R1", true, "Part lines fitted to vehicles."),
  K("prt.open_by_status", "Open Pipeline", "count", "0,0", "R1", true, "Open part lines across the status model."),
  K("prt.revenue", "Parts Revenue", "currency", "£0,0.00", "R1", false, "£ value of parts fitted/sold."),
  K("prt.stock_value", "Stock Value", "currency", "£0,0.00", "R1", true, "Valuation of in-stock parts."),
  K("prt.vhc_conversion", "VHC→Parts", "percent", "0.0%", "R1", false, "Authorised-VHC part conversion."),
];

// --- Tab 2: Parts Operations — requests/ordering/receiving/fitting/pipeline -
export const OPERATIONS_FLOW = [
  K("prt.requests", "Parts Requests", "count", "0,0", "R1", true, "Demand intake / VHC conversion base."),
  K("prt.ordered", "Parts Ordered", "count", "0,0", "R1", true, "Order lines placed; on-order value."),
  K("prt.received", "Parts Received", "count", "0,0", "R1", true, "Goods-in throughput."),
  K("prt.fitted", "Parts Fitted", "count", "0,0", "R1", true, "Fulfilment output."),
];
// Pipeline monitoring — the point-in-time open backlog by status.
export const OPERATIONS_PIPELINE = K(
  "prt.open_by_status",
  "Open Parts by Status",
  "count",
  "0,0",
  "R1",
  true,
  "Point-in-time open pipeline across the 14-status model (backlog / dwell candidates)."
);
// Declared operational/tactical metrics that light up once parts status-history
// accrues (R2) — shown so the gap is explicit, not hidden.
export const OPERATIONS_READINESS = [
  K("prt.approved", "Parts Approved", "percent", "0.0%", "R2", false, "Approved ÷ requested."),
  K("prt.cancelled", "Parts Cancelled", "percent", "0.0%", "R2", false, "Cancelled/removed ÷ requested."),
  K("prt.unavailable", "Parts Unavailable", "percent", "0.0%", "R2", false, "Unavailable ÷ requested."),
  K("prt.pick_rate", "Pick Rate", "count", "0,0", "R2", false, "Pre-pick→picked throughput by zone."),
];

// --- Tab 3: Stock & Inventory ----------------------------------------------
export const STOCK_KPIS = [
  K("prt.stock_value", "Stock Value", "currency", "£0,0.00", "R1", true, "Σ qty_in_stock × unit_cost (now)."),
  K("prt.stock_turn", "Stock Turnover", "ratio", "0.0", "R1", false, "COGS ÷ average stock value."),
];
// Inventory status & availability — the open pipeline doubles as the inventory
// availability view; ageing/dwell is declared (needs status-history).
export const STOCK_AVAILABILITY = K(
  "prt.open_by_status",
  "Inventory / Availability by Status",
  "count",
  "0,0",
  "R1",
  true,
  "Open lines by status — what is awaiting stock, on order, pre-picked or allocated."
);
export const STOCK_READINESS = [
  K("prt.ageing", "Parts Ageing / Dwell", "duration", "0.0", "R2", false, "Time open lines sit per status."),
  K("prt.backorder_rate", "Backorder Rate", "percent", "0.0%", "R2", false, "Backorder ÷ ordered."),
];

// --- Tab 4: Supplier & Ordering --------------------------------------------
// Supported-by-existing-data ordering & delivery monitoring (R1) + declared
// supplier-performance metrics (R3 — need the suppliers master).
export const ORDERING_KPIS = [
  K("prt.ordered", "Parts Ordered", "count", "0,0", "R1", true, "Order lines placed; committed spend."),
  K("prt.received", "Parts Received", "count", "0,0", "R1", true, "Delivery monitoring — goods received."),
];
export const SUPPLIER_READINESS = [
  K("prt.lead_time", "Parts Lead Time", "duration", "0.0", "R2", false, "Ordered→received elapsed."),
  K("prt.fill_rate", "Fill Rate", "percent", "0.0%", "R3", false, "Qty received ÷ qty ordered."),
  K("prt.supplier_performance", "Supplier Performance", "percent", "0.0%", "R3", false, "Per-supplier composite (needs supplier master)."),
];

// --- Tab 5: Reporting Utilities — every drillable/exportable Parts KPI ------
export const ALL_EXPORTABLE = [
  K("prt.requests", "Parts Requests", "count", "0,0", "R1", true, ""),
  K("prt.ordered", "Parts Ordered", "count", "0,0", "R1", true, ""),
  K("prt.received", "Parts Received", "count", "0,0", "R1", true, ""),
  K("prt.fitted", "Parts Fitted", "count", "0,0", "R1", true, ""),
  K("prt.open_by_status", "Open Parts by Status", "count", "0,0", "R1", true, ""),
  K("prt.stock_value", "Stock Value", "currency", "£0,0.00", "R1", true, ""),
].filter((k, i, arr) => k.hasDrilldown && arr.findIndex((x) => x.id === k.id) === i);

export const PARTS_TABS = [
  { value: "overview", label: "Overview" },
  { value: "operations", label: "Parts Operations" },
  { value: "stock", label: "Stock & Inventory" },
  { value: "supplier", label: "Supplier & Ordering" },
  { value: "utilities", label: "Reporting Utilities" },
];
