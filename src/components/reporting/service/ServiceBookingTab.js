// file location: src/components/reporting/service/ServiceBookingTab.js
//
// Appointment & Booking Activity: appointment volume, booking volume, booking
// performance and customer engagement. Booking volume and the customer-engagement
// mix are R1 (live); booking performance (appointment conversion) is declared
// (R2) until appointment status-history accrues. Drill-down on booking volume
// lists the appointments with their booking advisor (created_by) — advisor-level
// inspection wherever attribution exists. Every figure comes from /api/reports/*.

import React from "react";
import ReportSection from "../ReportSection";
import KpiPanel from "../KpiPanel";
import { BOOKING_R1, BOOKING_READINESS } from "./serviceReportConfig";

export default function ServiceBookingTab({ filter }) {
  return (
    <>
      <ReportSection
        title="Appointment & booking volume"
        subtitle="Appointments booked (the drill lists each appointment and its booking advisor) and the customer-engagement mix, with trends."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
          {BOOKING_R1.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend withDrilldown={kpi.hasDrilldown} />
          ))}
        </div>
      </ReportSection>

      <ReportSection
        title="Booking performance"
        subtitle="Appointment conversion (booked → arrived / job-created) lights up once appointment status-history accrues (R2)."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
          {BOOKING_READINESS.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend={false} withDrilldown={false} />
          ))}
        </div>
      </ReportSection>
    </>
  );
}
