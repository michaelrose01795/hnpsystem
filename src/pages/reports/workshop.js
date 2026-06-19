// file location: src/pages/reports/workshop.js
//
// Workshop Reporting Package (Phase 6) — the first report package built on the
// shared reporting foundation. It is a THIN consumer: every number, trend,
// drill-down, export and permission decision comes from /api/reports/* and the
// engine behind them. No KPI is calculated here.
//
// Sections (tabs): Overview · Operations · Technician Performance · VHC
// Performance · Reporting Utilities.
//
// Access: page-level ProtectedRoute gates to workshop/management/service roles
// (derived from the canonical role→department map, not hardcoded); the API then
// enforces per-KPI permission + department scope server-side, and every view/
// export is written to the hash-chained audit_log via auditReportAccess.

import React, { useState } from "react";
import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { ROLE_DEPARTMENT_MAP } from "@/lib/reporting/config/departments";
import { useReportFilter } from "@/hooks/reporting/useReporting";
import ReportFilterBar from "@/components/reporting/ReportFilterBar";
import ReportSection from "@/components/reporting/ReportSection";
import ReportDrilldownTable from "@/components/reporting/ReportDrilldownTable";
import WorkshopOverviewTab from "@/components/reporting/workshop/WorkshopOverviewTab";
import WorkshopOperationsTab from "@/components/reporting/workshop/WorkshopOperationsTab";
import WorkshopTechnicianTab from "@/components/reporting/workshop/WorkshopTechnicianTab";
import WorkshopVhcTab from "@/components/reporting/workshop/WorkshopVhcTab";
import WorkshopUtilitiesTab from "@/components/reporting/workshop/WorkshopUtilitiesTab";
import { WORKSHOP_DEPARTMENT, WORKSHOP_TABS } from "@/components/reporting/workshop/workshopReportConfig";

// Roles that may LAND on the page — derived from the canonical role→department
// map (departments.js) so it stays in sync with the dimension and is never a
// hardcoded list. Workshop + Service (VHC is cross-cutting) + oversight.
const PAGE_VISIBLE_DEPTS = new Set(["workshop", "service", "management", "admin"]);
const WORKSHOP_REPORT_ROLES = Object.entries(ROLE_DEPARTMENT_MAP)
  .filter(([, dept]) => PAGE_VISIBLE_DEPTS.has(dept))
  .map(([role]) => role.toUpperCase());

function WorkshopReportContent() {
  const { filter, patch, applySavedFilter } = useReportFilter({
    fixedDepartment: WORKSHOP_DEPARTMENT.code,
    defaultRange: "last_30d",
    defaultGranularity: "day",
  });
  const [tab, setTab] = useState("overview");
  const [drill, setDrill] = useState(null); // { id, label } opened from a scorecard card

  const openDrilldown = (kpi) => setDrill({ id: kpi.id, label: kpi.label });

  return (
    <>
      <Head>
        <title>Workshop Reports — HNPSystem</title>
      </Head>

      <div>
        <h1 style={{ margin: "0 0 4px", fontSize: "1.4rem", color: "var(--accentText)" }}>Workshop Reports</h1>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--surfaceTextMuted)" }}>
          Department performance on the shared reporting platform. Figures are exact and provenance-labelled; deeper
          cycle-time and per-operator tiers unlock as the event spine accrues.
        </p>
      </div>

      <ReportFilterBar filter={filter} onPatch={patch} departmentLabel={WORKSHOP_DEPARTMENT.label} />

      <TabGroup items={WORKSHOP_TABS} value={tab} onChange={setTab} ariaLabel="Workshop report sections" />

      {drill && (
        <ReportSection title={`Drill-down: ${drill.label}`}>
          <ReportDrilldownTable kpiId={drill.id} label={drill.label} filter={filter} onClose={() => setDrill(null)} />
        </ReportSection>
      )}

      {tab === "overview" && <WorkshopOverviewTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "operations" && <WorkshopOperationsTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "technician" && <WorkshopTechnicianTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "vhc" && <WorkshopVhcTab filter={filter} />}
      {tab === "utilities" && <WorkshopUtilitiesTab filter={filter} onApplySavedView={applySavedFilter} />}
    </>
  );
}

export default function WorkshopReportPage() {
  return (
    <ProtectedRoute allowedRoles={WORKSHOP_REPORT_ROLES}>
      <WorkshopReportContent />
    </ProtectedRoute>
  );
}
