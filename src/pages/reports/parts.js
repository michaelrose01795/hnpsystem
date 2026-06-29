// file location: src/pages/reports/parts.js
//
// Parts Reporting Package (Phase 7) — the second report package built on the
// shared reporting foundation, reusing the Phase-6 Workshop components unchanged.
// It is a THIN consumer: every number, trend, drill-down, export and permission
// decision comes from /api/reports/* and the engine behind them. No KPI is
// calculated here.
//
// Sections (tabs): Overview · Parts Operations · Stock & Inventory · Supplier &
// Ordering · Reporting Utilities.
//
// Access: page-level ProtectedRoute gates to parts/management roles (derived from
// the canonical role→department map, not hardcoded); the API then enforces per-KPI
// permission + department scope server-side, and every view/export is written to
// the hash-chained audit_log via auditReportAccess.

import React, { useState } from "react";
import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROLE_DEPARTMENT_MAP } from "@/lib/reporting/config/departments";
import { useReportFilter } from "@/hooks/reporting/useReporting";
import ReportFilterBar from "@/components/reporting/ReportFilterBar";
import ReportSection from "@/components/reporting/ReportSection";
import ReportDrilldownTable from "@/components/reporting/ReportDrilldownTable";
import PartsOverviewTab from "@/components/reporting/parts/PartsOverviewTab";
import PartsOperationsTab from "@/components/reporting/parts/PartsOperationsTab";
import PartsStockTab from "@/components/reporting/parts/PartsStockTab";
import PartsSupplierTab from "@/components/reporting/parts/PartsSupplierTab";
import PartsUtilitiesTab from "@/components/reporting/parts/PartsUtilitiesTab";
import { PARTS_DEPARTMENT, PARTS_TABS } from "@/components/reporting/parts/partsReportConfig";

// Roles that may LAND on the page — derived from the canonical role→department
// map (departments.js) so it stays in sync with the dimension and is never a
// hardcoded list. Parts (operational + manager) + management/admin oversight.
const PAGE_VISIBLE_DEPTS = new Set(["parts", "management", "admin"]);
const PARTS_REPORT_ROLES = Object.entries(ROLE_DEPARTMENT_MAP)
  .filter(([, dept]) => PAGE_VISIBLE_DEPTS.has(dept))
  .map(([role]) => role.toUpperCase());

function PartsReportContent() {
  const { filter, patch, applySavedFilter } = useReportFilter({
    fixedDepartment: PARTS_DEPARTMENT.code,
    defaultRange: "last_30d",
    defaultGranularity: "day",
  });
  const [tab, setTab] = useState("overview");
  const [drill, setDrill] = useState(null); // { id, label } opened from a scorecard card

  const openDrilldown = (kpi) => setDrill({ id: kpi.id, label: kpi.label });

  return (
    <>
      <Head>
        <title>Parts Reports — HNPSystem</title>
      </Head>

      <ReportFilterBar
        filter={filter}
        onPatch={patch}
        departmentLabel={PARTS_DEPARTMENT.label}
        tabItems={PARTS_TABS}
        tabValue={tab}
        onTabChange={setTab}
        tabAriaLabel="Parts report sections"
      />

      {drill && (
        <ReportSection title={`Drill-down: ${drill.label}`}>
          <ReportDrilldownTable kpiId={drill.id} label={drill.label} filter={filter} onClose={() => setDrill(null)} />
        </ReportSection>
      )}

      {tab === "overview" && <PartsOverviewTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "operations" && <PartsOperationsTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "stock" && <PartsStockTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "supplier" && <PartsSupplierTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "utilities" && <PartsUtilitiesTab filter={filter} onApplySavedView={applySavedFilter} />}
    </>
  );
}

export default function PartsReportPage() {
  return (
    <ProtectedRoute allowedRoles={PARTS_REPORT_ROLES}>
      <PartsReportContent />
    </ProtectedRoute>
  );
}
