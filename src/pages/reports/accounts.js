// file location: src/pages/reports/accounts.js
//
// Accounts Reporting Package (Phase 8) — the THIRD report package built on the
// shared reporting foundation, reusing the Phase-6/7 components unchanged. It is a
// THIN consumer: every number, trend, drill-down, export and permission decision
// comes from /api/reports/* and the engine behind them. No KPI is calculated here.
//
// Sections (tabs): Overview · Revenue & Invoicing · Payments & Receivables ·
// Financial Operations · Reporting Utilities.
//
// Access (financial — highest permission tier): the page is restricted to
// Accounts + Management + Executive roles, derived from the canonical
// role→department map (NOT a hardcoded list) and unioned with the executive set
// so directors who sit outside the accounts/management departments can still
// reach it. Unlike the Workshop/Parts pages, the general "admin" department is
// excluded — financial reports must not be navigable by reception/admin. The API
// then enforces the per-KPI financial gate (FINANCIAL_SENSITIVE_ROLES) and
// department scope server-side, and every view/export is written to the
// hash-chained audit_log via auditReportAccess.

import React, { useState } from "react";
import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { ROLE_DEPARTMENT_MAP } from "@/lib/reporting/config/departments";
import { EXECUTIVE_ROLES } from "@/lib/reporting/permissionScope";
import { useReportFilter } from "@/hooks/reporting/useReporting";
import ReportFilterBar from "@/components/reporting/ReportFilterBar";
import ReportSection from "@/components/reporting/ReportSection";
import ReportDrilldownTable from "@/components/reporting/ReportDrilldownTable";
import AccountsOverviewTab from "@/components/reporting/accounts/AccountsOverviewTab";
import AccountsRevenueTab from "@/components/reporting/accounts/AccountsRevenueTab";
import AccountsReceivablesTab from "@/components/reporting/accounts/AccountsReceivablesTab";
import AccountsOperationsTab from "@/components/reporting/accounts/AccountsOperationsTab";
import AccountsUtilitiesTab from "@/components/reporting/accounts/AccountsUtilitiesTab";
import { ACCOUNTS_DEPARTMENT, ACCOUNTS_TABS } from "@/components/reporting/accounts/accountsReportConfig";

// Roles that may LAND on the page — Accounts + Management departments (from the
// canonical role→department map) unioned with the executive role set. Tighter
// than the operational packages: no general "admin" department, because financial
// reporting is the highest-sensitivity tier. The API still enforces the £ gate.
const PAGE_VISIBLE_DEPTS = new Set(["accounts", "management"]);
const ACCOUNTS_REPORT_ROLES = Array.from(
  new Set([
    ...Object.entries(ROLE_DEPARTMENT_MAP)
      .filter(([, dept]) => PAGE_VISIBLE_DEPTS.has(dept))
      .map(([role]) => role),
    ...EXECUTIVE_ROLES,
  ])
).map((role) => role.toUpperCase());

function AccountsReportContent() {
  const { filter, patch, applySavedFilter } = useReportFilter({
    fixedDepartment: ACCOUNTS_DEPARTMENT.code,
    defaultRange: "last_30d",
    defaultGranularity: "day",
  });
  const [tab, setTab] = useState("overview");
  const [drill, setDrill] = useState(null); // { id, label } opened from a scorecard card

  const openDrilldown = (kpi) => setDrill({ id: kpi.id, label: kpi.label });

  return (
    <>
      <Head>
        <title>Accounts Reports — HNPSystem</title>
      </Head>

      <div>
        <h1 style={{ margin: "0 0 4px", fontSize: "1.4rem", color: "var(--accentText)" }}>Accounts Reports</h1>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--surfaceTextMuted)" }}>
          Financial performance on the shared reporting platform. Figures are exact and provenance-labelled, and
          restricted to Accounts, Management and Executive roles; DSO, ageing, payment conversion and profitability
          unlock as invoice status-history and cost inputs accrue.
        </p>
      </div>

      <ReportFilterBar filter={filter} onPatch={patch} departmentLabel={ACCOUNTS_DEPARTMENT.label} />

      <TabGroup items={ACCOUNTS_TABS} value={tab} onChange={setTab} ariaLabel="Accounts report sections" />

      {drill && (
        <ReportSection title={`Drill-down: ${drill.label}`}>
          <ReportDrilldownTable kpiId={drill.id} label={drill.label} filter={filter} onClose={() => setDrill(null)} />
        </ReportSection>
      )}

      {tab === "overview" && <AccountsOverviewTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "revenue" && <AccountsRevenueTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "receivables" && <AccountsReceivablesTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "operations" && <AccountsOperationsTab filter={filter} onDrilldown={openDrilldown} />}
      {tab === "utilities" && <AccountsUtilitiesTab filter={filter} onApplySavedView={applySavedFilter} />}
    </>
  );
}

export default function AccountsReportPage() {
  return (
    <ProtectedRoute allowedRoles={ACCOUNTS_REPORT_ROLES}>
      <AccountsReportContent />
    </ProtectedRoute>
  );
}
