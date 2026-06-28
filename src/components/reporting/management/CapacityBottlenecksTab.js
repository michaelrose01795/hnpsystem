// file location: src/components/reporting/management/CapacityBottlenecksTab.js
//
// Capacity & Bottlenecks: executive operational monitoring composed from existing
// workload KPIs — open WIP, waiting-for-parts (open parts by status), outstanding
// invoices, valet & paint queues. The per-wait-state queues that need durable
// stage dwell (waiting for customer / authorisation, queue lengths by stage) plus
// capacity utilisation and the dwell-ranked bottleneck are shown as BLOCKED via
// the shared scorecard (they need *_status_history + a capacity/SLA model). No
// queue figure is invented where the status-history does not exist.

import React from "react";
import ReportSection from "../ReportSection";
import KpiScorecardStrip from "../KpiScorecardStrip";
import KpiBreakdownCards from "../KpiBreakdownCards";
import { CAPACITY_KPIS, PARTS_WORKLOAD_CARDS, VALET_QUEUE_CARDS, PAINT_QUEUE_CARDS } from "./managementReportConfig";

export default function CapacityBottlenecksTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection
        title="Department workload & queues"
        subtitle="Open job volume, parts pipeline, outstanding invoices and valet/paint queues combined from the department packages. Capacity utilisation, the dwell-ranked bottleneck and SLA attainment are BLOCKED until status-history and a capacity/SLA model accrue."
      >
        <KpiScorecardStrip kpis={CAPACITY_KPIS} filter={filter} onDrilldown={onDrilldown} showProvenance={false} minCardWidth={210} />
      </ReportSection>

      <ReportSection title="Waiting for parts — open part lines by status" subtitle="Open parts pipeline broken down by status (the buildable waiting-for-parts proxy).">
        <KpiBreakdownCards filter={filter} kpiId="prt.open_by_status" cards={PARTS_WORKLOAD_CARDS} />
      </ReportSection>

      <ReportSection title="Valeting queue" subtitle="Valet throughput and queue facets from the Valeting package.">
        <KpiBreakdownCards filter={filter} kpiId="val.cars_washed" cards={VALET_QUEUE_CARDS} />
      </ReportSection>

      <ReportSection title="Paint queue" subtitle="Paint/bodyshop workload facets from the Paint package.">
        <KpiBreakdownCards filter={filter} kpiId="pnt.queue" cards={PAINT_QUEUE_CARDS} />
      </ReportSection>
    </>
  );
}
