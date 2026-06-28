// file location: src/components/reporting/admin/AdminAccessTab.js
//
// User & Access Activity: login success/failure, active users and security
// events. Login and security data is permission-gated to Admin/Management/Exec
// scope by the engine; this tab only renders what the API returns.

import React from "react";
import ReportSection from "../ReportSection";
import KpiPanel from "../KpiPanel";
import ReportDrilldownTable from "../ReportDrilldownTable";
import AdminBreakdownCards from "./AdminBreakdownCards";
import { ACCESS_KPIS, LOGIN_BREAKDOWN_CARDS, FAILURE_BREAKDOWN_CARDS, USER_ACTIVITY_CARDS } from "./adminReportConfig";

export default function AdminAccessTab({ filter }) {
  return (
    <>
      <ReportSection title="Login activity" subtitle="Attempts, successes, failures and access spread from auth_login_attempts.">
        <AdminBreakdownCards filter={filter} kpiId="adm.login_success_rate" cards={LOGIN_BREAKDOWN_CARDS} />
      </ReportSection>

      <ReportSection title="User & access KPIs" subtitle="Login success rate, login failures and active-user proxy.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {ACCESS_KPIS.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend withDrilldown />
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Security events — login failures" subtitle="Failed attempts by reason, affected accounts and source IPs.">
        <AdminBreakdownCards filter={filter} kpiId="adm.login_failures" cards={FAILURE_BREAKDOWN_CARDS} />
      </ReportSection>

      <ReportSection title="Active users" subtitle="Distinct active users proxied from audited actors and authenticated logins.">
        <AdminBreakdownCards filter={filter} kpiId="adm.user_activity" cards={USER_ACTIVITY_CARDS} />
      </ReportSection>

      <ReportSection title="Login failure drill-down" subtitle="Individual failed login attempts in the selected period.">
        <ReportDrilldownTable kpiId="adm.login_failures" label="Login failures" filter={filter} />
      </ReportSection>
    </>
  );
}
