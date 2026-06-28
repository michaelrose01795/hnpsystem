// file location: src/components/reporting/management/ExecutiveTrendsTab.js
//
// Executive Trends: daily / weekly / monthly / yearly trends for the executive
// composites, built by the shared snapshot/trend framework (live fallback until
// snapshots accrue). One trend-card wrapper (ExecutiveTrendCard) is reused for
// every series — no duplicate trend builders.

import React from "react";
import ReportSection from "../ReportSection";
import ExecutiveTrendCard from "./ExecutiveTrendCard";
import { TREND_KPIS, TREND_GRANULARITIES } from "./managementReportConfig";

export default function ExecutiveTrendsTab({ filter }) {
  return (
    <>
      {TREND_KPIS.map((kpi) => (
        <ReportSection key={kpi.id} title={`${kpi.label} — trends`} subtitle={`Daily, weekly, monthly and yearly ${kpi.label.toLowerCase()} via the shared trend framework.`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {TREND_GRANULARITIES.map((g) => (
              <ExecutiveTrendCard
                key={g.value}
                kpiId={kpi.id}
                label={kpi.label}
                unit={kpi.unit}
                format={kpi.format}
                filter={filter}
                granularity={g.value}
                granularityLabel={g.label}
                height={110}
              />
            ))}
          </div>
        </ReportSection>
      ))}
    </>
  );
}
