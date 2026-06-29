// file location: src/pages/reports/overview.js
//
// Management & Executive Reporting Package (Phase 14) — the NINTH and flagship
// report package on the shared reporting foundation. Thin client only: every
// value, trend, drill-down, export, saved view, permission check and audit-log
// write routes through /api/reports/*. This page composes the already-built
// department packages; it creates no new reporting infrastructure.
//
// STRICT ACCESS CONTROL: executive reporting exposes whole-company commercial
// signal. The page is gated to Dealer Principal / Owner, Directors and Senior
// Management (EXECUTIVE_ROLES) ONLY — operational department managers keep their
// department reporting packages unless explicitly granted an executive role. This
// page gate mirrors the per-KPI MGT_REPORT_PERMISSION the engine enforces
// server-side (defence in depth: even if the page were reached, the engine refuses
// the data). The route maps to the navigation's executive-level /reports/overview.

import React, { useState } from "react";
import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { EXECUTIVE_ROLES } from "@/lib/reporting/permissionScope";
import { MGT_REPORT_PERMISSION } from "@/lib/reporting/kpiDefinitions/management";
import { useReportFilter } from "@/hooks/reporting/useReporting";
import ReportFilterBar from "@/components/reporting/ReportFilterBar";
import ReportSection from "@/components/reporting/ReportSection";
import ReportDrilldownTable from "@/components/reporting/ReportDrilldownTable";
import ExecutiveOverviewTab from "@/components/reporting/management/ExecutiveOverviewTab";
import DepartmentPerformanceTab from "@/components/reporting/management/DepartmentPerformanceTab";
import OperationalPerformanceTab from "@/components/reporting/management/OperationalPerformanceTab";
import RevenueProfitabilityTab from "@/components/reporting/management/RevenueProfitabilityTab";
import CapacityBottlenecksTab from "@/components/reporting/management/CapacityBottlenecksTab";
import ExecutiveTrendsTab from "@/components/reporting/management/ExecutiveTrendsTab";
import ExecutiveDrilldownTab from "@/components/reporting/management/ExecutiveDrilldownTab";
import ManagementUtilitiesTab from "@/components/reporting/management/ManagementUtilitiesTab";
import { MGT_DEPARTMENT, MGT_TABS } from "@/components/reporting/management/managementReportConfig";

// Executive roles only (Dealer Principal/Owner, Directors, Senior Management).
const EXECUTIVE_REPORT_ROLES = Array.from(
  new Set([...MGT_REPORT_PERMISSION, ...EXECUTIVE_ROLES])
).map((role) => role.toUpperCase());

function ExecutiveReportContent() {
  const { filter, patch, applySavedFilter } = useReportFilter({
    fixedDepartment: MGT_DEPARTMENT.code,
    defaultRange: "last_30d",
    defaultGranularity: "day",
  });
  const [tab, setTab] = useState("overview");
  const [drill, setDrill] = useState(null);

  const openDrilldown = (kpi) => setDrill({ id: kpi.id, label: kpi.label });

  return (
    <>
      <Head>
        <title>Executive Reports - HNPSystem</title>
      </Head>

      <ReportFilterBar
        filter={filter}
        onPatch={patch}
        departmentLabel={MGT_DEPARTMENT.label}
        tabItems={MGT_TABS}
        tabValue={tab}
        onTabChange={setTab}
        tabAriaLabel="Executive report sections"
      />

      {drill && (
        <ReportSection title={`Drill-down: ${drill.label}`}>
          <ReportDrilldownTable kpiId={drill.id} label={drill.label} filter={filter} onClose={() => setDrill(null)} />
        </ReportSection>
      )}

      {tab === "overview" && <ExecutiveOverviewTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "departments" && <DepartmentPerformanceTab filter={filter} />}
      {tab === "operational" && <OperationalPerformanceTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "revenue" && <RevenueProfitabilityTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "capacity" && <CapacityBottlenecksTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "trends" && <ExecutiveTrendsTab filter={filter} />}
      {tab === "drilldown" && <ExecutiveDrilldownTab filter={filter} />}
      {tab === "utilities" && <ManagementUtilitiesTab filter={filter} onApplySavedView={applySavedFilter} />}
    </>
  );
}

export default function ExecutiveReportPage() {
  return (
    <ProtectedRoute allowedRoles={EXECUTIVE_REPORT_ROLES}>
      <ExecutiveReportContent />
    </ProtectedRoute>
  );
}
