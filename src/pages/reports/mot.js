// file location: src/pages/reports/mot.js
//
// MOT Reporting Package (Phase 10) - the fifth report package built on the
// shared reporting foundation. Thin client only: every value, trend, drill-down,
// export, saved view, permission decision and audit write routes through the
// existing /api/reports/* platform.

import React, { useState } from "react";
import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { ROLE_DEPARTMENT_MAP } from "@/lib/reporting/config/departments";
import { useReportFilter } from "@/hooks/reporting/useReporting";
import ReportFilterBar from "@/components/reporting/ReportFilterBar";
import ReportSection from "@/components/reporting/ReportSection";
import ReportDrilldownTable from "@/components/reporting/ReportDrilldownTable";
import MotOverviewTab from "@/components/reporting/mot/MotOverviewTab";
import MotOperationsTab from "@/components/reporting/mot/MotOperationsTab";
import MotTesterActivityTab from "@/components/reporting/mot/MotTesterActivityTab";
import MotRevenueConversionTab from "@/components/reporting/mot/MotRevenueConversionTab";
import MotUtilitiesTab from "@/components/reporting/mot/MotUtilitiesTab";
import { MOT_DEPARTMENT, MOT_TABS } from "@/components/reporting/mot/motReportConfig";

const PAGE_VISIBLE_DEPTS = new Set(["mot", "service", "workshop", "management", "admin"]);
const MOT_REPORT_ROLES = Array.from(
  new Set(
    Object.entries(ROLE_DEPARTMENT_MAP)
      .filter(([, dept]) => PAGE_VISIBLE_DEPTS.has(dept))
      .map(([role]) => role)
  )
).map((role) => role.toUpperCase());

function MotReportContent() {
  const { filter, patch, applySavedFilter } = useReportFilter({
    fixedDepartment: MOT_DEPARTMENT.code,
    defaultRange: "last_30d",
    defaultGranularity: "day",
  });
  const [tab, setTab] = useState("overview");
  const [drill, setDrill] = useState(null);

  const openDrilldown = (kpi) => setDrill({ id: kpi.id, label: kpi.label });

  return (
    <>
      <Head>
        <title>MOT Reports - HNPSystem</title>
      </Head>

      <div>
        <h1 style={{ margin: "0 0 4px", fontSize: "1.4rem", color: "var(--accentText)" }}>MOT Reports</h1>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--surfaceTextMuted)" }}>
          MOT reporting on the shared reporting platform. Volume, throughput, MOT-due pipeline, MOT revenue and
          clocking-based tester activity are live; first-time pass, retest, repair conversion and advisory conversion
          unlock as MOT result events, mot_tests and advisory capture land.
        </p>
      </div>

      <ReportFilterBar filter={filter} onPatch={patch} departmentLabel={MOT_DEPARTMENT.label} />

      <TabGroup items={MOT_TABS} value={tab} onChange={setTab} ariaLabel="MOT report sections" />

      {drill && (
        <ReportSection title={`Drill-down: ${drill.label}`}>
          <ReportDrilldownTable kpiId={drill.id} label={drill.label} filter={filter} onClose={() => setDrill(null)} />
        </ReportSection>
      )}

      {tab === "overview" && <MotOverviewTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "operations" && <MotOperationsTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "testers" && <MotTesterActivityTab filter={filter} />}
      {tab === "revenue" && <MotRevenueConversionTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "utilities" && <MotUtilitiesTab filter={filter} onApplySavedView={applySavedFilter} />}
    </>
  );
}

export default function MotReportPage() {
  return (
    <ProtectedRoute allowedRoles={MOT_REPORT_ROLES}>
      <MotReportContent />
    </ProtectedRoute>
  );
}
