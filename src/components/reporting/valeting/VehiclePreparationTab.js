// file location: src/components/reporting/valeting/VehiclePreparationTab.js
//
// Vehicle Preparation: demand split for service wash, sales preparation and
// courtesy vehicle Valeting from the shared Valeting resolver breakdown.

import React from "react";
import ReportSection from "../ReportSection";
import KpiPanel from "../KpiPanel";
import ReportDrilldownTable from "../ReportDrilldownTable";
import ValetingBreakdownCards from "./ValetingBreakdownCards";
import { PREPARATION_KPIS } from "./valetingReportConfig";

export default function VehiclePreparationTab({ filter }) {
  return (
    <>
      <ReportSection title="Service wash activity" subtitle="Completed Valeting demand where existing job/checklist signals identify service wash work.">
        <ValetingBreakdownCards filter={filter} keys={["service_wash_volume"]} />
      </ReportSection>

      <ReportSection title="Sales preparation activity" subtitle="Completed Valeting demand where existing job/checklist signals identify sales preparation.">
        <ValetingBreakdownCards filter={filter} keys={["sales_preparation_valet_volume"]} />
      </ReportSection>

      <ReportSection title="Courtesy vehicle preparation" subtitle="Completed Valeting demand where existing job/checklist signals identify courtesy vehicle preparation.">
        <ValetingBreakdownCards filter={filter} keys={["courtesy_vehicle_valet_volume"]} />
      </ReportSection>

      <ReportSection title="Department demand analysis" subtitle="Total completed Valeting volume and records behind the demand split.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {PREPARATION_KPIS.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend withDrilldown />
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Preparation drill-down" subtitle="Completed Valeting records, including the demand bucket assigned by the reporting resolver.">
        <ReportDrilldownTable kpiId="val.cars_washed" label="Vehicle preparation activity" filter={filter} />
      </ReportSection>
    </>
  );
}
