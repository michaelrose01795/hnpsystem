// file location: src/pages/reports/admin.js
//
// Admin Reporting Package (Phase 13) — the EIGHTH report package built on the
// shared reporting foundation. Thin client only: values, trends, drill-downs,
// exports, saved views, permissions and audit logging route through /api/reports.
//
// STRICT ACCESS CONTROL: Admin reporting exposes login, audit, security and
// compliance signal. The page is gated to Admin-manager / Management / Executive
// roles ONLY — operational department users (including reception/admin-desk staff
// and operational department managers) are excluded. This page gate mirrors the
// per-KPI ADMIN_REPORT_PERMISSION the engine enforces server-side (defence in
// depth: even if the page were reached, the engine refuses the data).

import React, { useState } from "react";
import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { EXECUTIVE_ROLES } from "@/lib/reporting/permissionScope";
import { ADMIN_REPORT_PERMISSION } from "@/lib/reporting/kpiDefinitions/admin";
import { useReportFilter } from "@/hooks/reporting/useReporting";
import ReportFilterBar from "@/components/reporting/ReportFilterBar";
import ReportSection from "@/components/reporting/ReportSection";
import ReportDrilldownTable from "@/components/reporting/ReportDrilldownTable";
import AdminOverviewTab from "@/components/reporting/admin/AdminOverviewTab";
import AdminAccessTab from "@/components/reporting/admin/AdminAccessTab";
import AdminAuditTab from "@/components/reporting/admin/AdminAuditTab";
import AdminQualityTab from "@/components/reporting/admin/AdminQualityTab";
import AdminUtilitiesTab from "@/components/reporting/admin/AdminUtilitiesTab";
import { ADMIN_DEPARTMENT, ADMIN_TABS } from "@/components/reporting/admin/adminReportConfig";

// Admin/Management/Executive roles only. "admin" is the privileged system-admin
// role (HR-core grouping), distinct from operational reception/admin-desk staff
// who are intentionally NOT included.
const ADMIN_REPORT_ROLES = Array.from(
  new Set([...ADMIN_REPORT_PERMISSION, ...EXECUTIVE_ROLES, "admin"])
).map((role) => role.toUpperCase());

function AdminReportContent() {
  const { filter, patch, applySavedFilter } = useReportFilter({
    fixedDepartment: ADMIN_DEPARTMENT.code,
    defaultRange: "last_30d",
    defaultGranularity: "day",
  });
  const [tab, setTab] = useState("overview");
  const [drill, setDrill] = useState(null);

  const openDrilldown = (kpi) => setDrill({ id: kpi.id, label: kpi.label });

  return (
    <>
      <Head>
        <title>Admin Reports - HNPSystem</title>
      </Head>

      <div>
        <h1 style={{ margin: "0 0 4px", fontSize: "1.4rem", color: "var(--accentText)" }}>Admin Reports</h1>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--surfaceTextMuted)" }}>
          Admin reporting on the shared reporting platform. Login security, audit volume, compliance activity and
          data-quality health are live from the hash-chained audit_log and login-attempt tables. Report usage and active
          users are audit-backed proxies until the report_event spine accrues; role-change reporting stays blocked until
          role writes are logged. Access is restricted to Admin, Management and Executive roles.
        </p>
      </div>

      <ReportFilterBar filter={filter} onPatch={patch} departmentLabel={ADMIN_DEPARTMENT.label} />

      <TabGroup items={ADMIN_TABS} value={tab} onChange={setTab} ariaLabel="Admin report sections" />

      {drill && (
        <ReportSection title={`Drill-down: ${drill.label}`}>
          <ReportDrilldownTable kpiId={drill.id} label={drill.label} filter={filter} onClose={() => setDrill(null)} />
        </ReportSection>
      )}

      {tab === "overview" && <AdminOverviewTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "access" && <AdminAccessTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "audit" && <AdminAuditTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "quality" && <AdminQualityTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "utilities" && <AdminUtilitiesTab filter={filter} onApplySavedView={applySavedFilter} />}
    </>
  );
}

export default function AdminReportPage() {
  return (
    <ProtectedRoute allowedRoles={ADMIN_REPORT_ROLES}>
      <AdminReportContent />
    </ProtectedRoute>
  );
}
