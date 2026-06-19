// file location: src/components/reporting/parts/PartsSupplierTab.js
//
// Supplier & Ordering: the ordering and delivery monitoring that existing data
// supports (R1), plus the declared supplier-performance metrics that need the
// `suppliers` master entity (R3) or parts status-history (lead time, R2). Nothing
// per-supplier is fabricated — supplier is free-text today, so supplier-level
// breakdowns are honestly deferred.

import React from "react";
import ReportSection from "../ReportSection";
import KpiPanel from "../KpiPanel";
import KpiScorecardStrip from "../KpiScorecardStrip";
import { ORDERING_KPIS, SUPPLIER_READINESS } from "./partsReportConfig";

export default function PartsSupplierTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection title="Ordering & delivery monitoring" subtitle="Order lines placed and goods received in the period — the supported-by-data ordering performance view.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {ORDERING_KPIS.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend withDrilldown />
          ))}
        </div>
      </ReportSection>

      <ReportSection
        title="Supplier performance readiness"
        subtitle="Declared in the catalogue — lead time needs parts status-history (R2); per-supplier fill rate and the supplier composite need a `suppliers` master entity (R3)."
      >
        <KpiScorecardStrip kpis={SUPPLIER_READINESS} filter={filter} onDrilldown={onDrilldown} minCardWidth={240} />
      </ReportSection>
    </>
  );
}
