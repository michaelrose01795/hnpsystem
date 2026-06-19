// file location: src/pages/reports/paint.js
//
// Paint Reporting Package (Phase 12) - the seventh report package built on the
// shared reporting foundation. Thin client only: values, trends, drill-downs,
// exports, saved views, permissions and audit logging route through /api/reports.

import React, { useState } from "react";
import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { ROLE_DEPARTMENT_MAP } from "@/lib/reporting/config/departments";
import { useReportFilter } from "@/hooks/reporting/useReporting";
import ReportFilterBar from "@/components/reporting/ReportFilterBar";
import ReportSection from "@/components/reporting/ReportSection";
import ReportDrilldownTable from "@/components/reporting/ReportDrilldownTable";
import PaintOverviewTab from "@/components/reporting/paint/PaintOverviewTab";
import PaintOperationsTab from "@/components/reporting/paint/PaintOperationsTab";
import PaintWorkflowTab from "@/components/reporting/paint/PaintWorkflowTab";
import PaintWorkloadTab from "@/components/reporting/paint/PaintWorkloadTab";
import PaintUtilitiesTab from "@/components/reporting/paint/PaintUtilitiesTab";
import { PAINT_DEPARTMENT, PAINT_TABS } from "@/components/reporting/paint/paintReportConfig";

const PAGE_VISIBLE_DEPTS = new Set(["paint", "workshop", "service", "management", "admin"]);
const PAINT_REPORT_ROLES = Array.from(
  new Set(
    Object.entries(ROLE_DEPARTMENT_MAP)
      .filter(([, dept]) => PAGE_VISIBLE_DEPTS.has(dept))
      .map(([role]) => role)
  )
).map((role) => role.toUpperCase());

function PaintReportContent() {
  const { filter, patch, applySavedFilter } = useReportFilter({
    fixedDepartment: PAINT_DEPARTMENT.code,
    defaultRange: "last_30d",
    defaultGranularity: "day",
  });
  const [tab, setTab] = useState("overview");
  const [drill, setDrill] = useState(null);

  const openDrilldown = (kpi) => setDrill({ id: kpi.id, label: kpi.label });

  return (
    <>
      <Head>
        <title>Paint Reports - HNPSystem</title>
      </Head>

      <div>
        <h1 style={{ margin: "0 0 4px", fontSize: "1.4rem", color: "var(--accentText)" }}>Paint Reports</h1>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--surfaceTextMuted)" }}>
          Paint reporting on the shared reporting platform. Completed jobs, current queue, workload, bodyshop demand
          and a whole-job cycle-time proxy are live where existing job data supports them; stage, bay, material, rework
          and true painter-productivity metrics remain blocked until Paint workflow modelling lands.
        </p>
      </div>

      <ReportFilterBar filter={filter} onPatch={patch} departmentLabel={PAINT_DEPARTMENT.label} />

      <TabGroup items={PAINT_TABS} value={tab} onChange={setTab} ariaLabel="Paint report sections" />

      {drill && (
        <ReportSection title={`Drill-down: ${drill.label}`}>
          <ReportDrilldownTable kpiId={drill.id} label={drill.label} filter={filter} onClose={() => setDrill(null)} />
        </ReportSection>
      )}

      {tab === "overview" && <PaintOverviewTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "operations" && <PaintOperationsTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "workflow" && <PaintWorkflowTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "workload" && <PaintWorkloadTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "utilities" && <PaintUtilitiesTab filter={filter} onApplySavedView={applySavedFilter} />}
    </>
  );
}

export default function PaintReportPage() {
  return (
    <ProtectedRoute allowedRoles={PAINT_REPORT_ROLES}>
      <PaintReportContent />
    </ProtectedRoute>
  );
}
