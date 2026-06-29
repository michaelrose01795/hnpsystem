// file location: src/pages/reports/valeting.js
//
// Valeting Reporting Package (Phase 11) - the sixth report package built on the
// shared reporting foundation. Thin client only: values, trends, drill-downs,
// exports, saved views, permissions and audit logging route through /api/reports.

import React, { useState } from "react";
import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROLE_DEPARTMENT_MAP } from "@/lib/reporting/config/departments";
import { useReportFilter } from "@/hooks/reporting/useReporting";
import ReportFilterBar from "@/components/reporting/ReportFilterBar";
import ReportSection from "@/components/reporting/ReportSection";
import ReportDrilldownTable from "@/components/reporting/ReportDrilldownTable";
import ValetingOverviewTab from "@/components/reporting/valeting/ValetingOverviewTab";
import ValetingOperationsTab from "@/components/reporting/valeting/ValetingOperationsTab";
import ValeterActivityTab from "@/components/reporting/valeting/ValeterActivityTab";
import VehiclePreparationTab from "@/components/reporting/valeting/VehiclePreparationTab";
import ValetingUtilitiesTab from "@/components/reporting/valeting/ValetingUtilitiesTab";
import { VALETING_DEPARTMENT, VALETING_TABS } from "@/components/reporting/valeting/valetingReportConfig";

const PAGE_VISIBLE_DEPTS = new Set(["valeting", "service", "workshop", "management", "admin"]);
const VALETING_REPORT_ROLES = Array.from(
  new Set(
    Object.entries(ROLE_DEPARTMENT_MAP)
      .filter(([, dept]) => PAGE_VISIBLE_DEPTS.has(dept))
      .map(([role]) => role)
  )
).map((role) => role.toUpperCase());

function ValetingReportContent() {
  const { filter, patch, applySavedFilter } = useReportFilter({
    fixedDepartment: VALETING_DEPARTMENT.code,
    defaultRange: "last_30d",
    defaultGranularity: "day",
  });
  const [tab, setTab] = useState("overview");
  const [drill, setDrill] = useState(null);

  const openDrilldown = (kpi) => setDrill({ id: kpi.id, label: kpi.label });

  return (
    <>
      <Head>
        <title>Valeting Reports - HNPSystem</title>
      </Head>

      <ReportFilterBar
        filter={filter}
        onPatch={patch}
        departmentLabel={VALETING_DEPARTMENT.label}
        tabItems={VALETING_TABS}
        tabValue={tab}
        onTabChange={setTab}
        tabAriaLabel="Valeting report sections"
      />

      {drill && (
        <ReportSection title={`Drill-down: ${drill.label}`}>
          <ReportDrilldownTable kpiId={drill.id} label={drill.label} filter={filter} onClose={() => setDrill(null)} />
        </ReportSection>
      )}

      {tab === "overview" && <ValetingOverviewTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "operations" && <ValetingOperationsTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "valeters" && <ValeterActivityTab filter={filter} />}
      {tab === "preparation" && <VehiclePreparationTab filter={filter} />}
      {tab === "utilities" && <ValetingUtilitiesTab filter={filter} onApplySavedView={applySavedFilter} />}
    </>
  );
}

export default function ValetingReportPage() {
  return (
    <ProtectedRoute allowedRoles={VALETING_REPORT_ROLES}>
      <ValetingReportContent />
    </ProtectedRoute>
  );
}
