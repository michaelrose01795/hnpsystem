// file location: src/components/reporting/parts/PartsStockTab.js
//
// Stock & Inventory: stock value, stock movement (turnover), inventory status and
// availability. Stock value + turnover are live R1; the open-by-status drill-down
// doubles as the inventory availability view; ageing/dwell + backorder are declared
// (need parts status-history). Engine-served throughout.

import React from "react";
import ReportSection from "../ReportSection";
import KpiPanel from "../KpiPanel";
import KpiScorecardStrip from "../KpiScorecardStrip";
import ReportDrilldownTable from "../ReportDrilldownTable";
import { STOCK_KPIS, STOCK_AVAILABILITY, STOCK_READINESS } from "./partsReportConfig";

export default function PartsStockTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection title="Stock value & movement" subtitle="Inventory valuation now and how fast it turns over (cost of parts sold ÷ stock value).">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {STOCK_KPIS.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend={kpi.unit === "currency"} withDrilldown={kpi.hasDrilldown} />
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Inventory status & availability" subtitle="Open lines by status — what is awaiting stock, on order, pre-picked or allocated (exact distribution).">
        <ReportDrilldownTable kpiId={STOCK_AVAILABILITY.id} label={STOCK_AVAILABILITY.label} filter={filter} />
      </ReportSection>

      <ReportSection
        title="Inventory readiness indicators"
        subtitle="Declared in the catalogue — dwell ageing and backorder rate unlock with parts status-history and the order/receive event anchoring."
      >
        <KpiScorecardStrip kpis={STOCK_READINESS} filter={filter} onDrilldown={onDrilldown} minCardWidth={220} />
      </ReportSection>
    </>
  );
}
