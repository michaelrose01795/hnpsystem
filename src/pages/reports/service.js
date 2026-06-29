// file location: src/pages/reports/service.js
//
// Service Advisor Reporting Package (Phase 9) — the FOURTH report package built on
// the shared reporting foundation, reusing the Phase-6/7/8 components unchanged.
// It is a THIN consumer: every number, trend, drill-down, export and permission
// decision comes from /api/reports/* and the engine behind them. No KPI is
// calculated here.
//
// Sections (tabs): Service Overview · Customer Communications · Appointment &
// Booking Activity · VHC Performance · Reporting Utilities.
//
// Access (operational): the page is reachable for Service + Management + Admin
// roles, derived from the canonical role→department map (NOT a hardcoded list).
// Service Advisor KPIs are operational (not financial/PII), so the KPIs are
// open-permission like the Workshop/Parts packages; the API still enforces
// permissionScope (department/self) server-side, and every view/export is written
// to the hash-chained audit_log via auditReportAccess.

import React, { useState } from "react";
import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROLE_DEPARTMENT_MAP } from "@/lib/reporting/config/departments";
import { useReportFilter } from "@/hooks/reporting/useReporting";
import ReportFilterBar from "@/components/reporting/ReportFilterBar";
import ReportSection from "@/components/reporting/ReportSection";
import ReportDrilldownTable from "@/components/reporting/ReportDrilldownTable";
import ServiceOverviewTab from "@/components/reporting/service/ServiceOverviewTab";
import ServiceCommunicationsTab from "@/components/reporting/service/ServiceCommunicationsTab";
import ServiceBookingTab from "@/components/reporting/service/ServiceBookingTab";
import ServiceVhcTab from "@/components/reporting/service/ServiceVhcTab";
import ServiceUtilitiesTab from "@/components/reporting/service/ServiceUtilitiesTab";
import { SERVICE_DEPARTMENT, SERVICE_TABS } from "@/components/reporting/service/serviceReportConfig";

// Roles that may LAND on the page — Service + Management + Admin departments,
// derived from the canonical role→department map (workshop is co-located on VHC
// but the Workshop report already serves that audience). Mirrors the Workshop
// report's audience minus workshop-only roles; the API enforces scope regardless.
const PAGE_VISIBLE_DEPTS = new Set(["service", "management", "admin"]);
const SERVICE_REPORT_ROLES = Array.from(
  new Set(
    Object.entries(ROLE_DEPARTMENT_MAP)
      .filter(([, dept]) => PAGE_VISIBLE_DEPTS.has(dept))
      .map(([role]) => role)
  )
).map((role) => role.toUpperCase());

function ServiceReportContent() {
  const { filter, patch, applySavedFilter } = useReportFilter({
    fixedDepartment: SERVICE_DEPARTMENT.code,
    defaultRange: "last_30d",
    defaultGranularity: "day",
  });
  const [tab, setTab] = useState("overview");
  const [drill, setDrill] = useState(null); // { id, label } opened from a scorecard card

  const openDrilldown = (kpi) => setDrill({ id: kpi.id, label: kpi.label });

  return (
    <>
      <Head>
        <title>Service Advisor Reports — HNPSystem</title>
      </Head>

      <ReportFilterBar
        filter={filter}
        onPatch={patch}
        departmentLabel={SERVICE_DEPARTMENT.label}
        tabItems={SERVICE_TABS}
        tabValue={tab}
        onTabChange={setTab}
        tabAriaLabel="Service Advisor report sections"
      />

      {drill && (
        <ReportSection title={`Drill-down: ${drill.label}`}>
          <ReportDrilldownTable kpiId={drill.id} label={drill.label} filter={filter} onClose={() => setDrill(null)} />
        </ReportSection>
      )}

      {tab === "overview" && <ServiceOverviewTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "communications" && <ServiceCommunicationsTab filter={filter} />}
      {tab === "booking" && <ServiceBookingTab filter={filter} />}
      {tab === "vhc" && <ServiceVhcTab filter={filter} />}
      {tab === "utilities" && <ServiceUtilitiesTab filter={filter} onApplySavedView={applySavedFilter} />}
    </>
  );
}

export default function ServiceReportPage() {
  return (
    <ProtectedRoute allowedRoles={SERVICE_REPORT_ROLES}>
      <ServiceReportContent />
    </ProtectedRoute>
  );
}
