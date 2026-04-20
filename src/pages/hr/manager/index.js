// HR Manager Dashboard - Comprehensive interface for HR management
// file location: src/pages/hr/manager/index.js
// This page is only accessible to users with "owner" or "admin manager" roles.
// Provides tabbed access to all HR functions from a single interface.

import React, { useState } from "react";
import { useUser } from "@/context/UserContext";
import { useSession } from "next-auth/react";
import { canAccessHrManagerDashboard, normalizeRoles } from "@/lib/auth/roles";

import HRDashboardTab from "@/components/HR/tabs/HRDashboardTab";
import EmployeesTab from "@/components/HR/tabs/EmployeesTab";
import AttendanceTab from "@/components/HR/tabs/AttendanceTab";
import PayrollTab from "@/components/HR/tabs/PayrollTab";
import LeaveTab from "@/components/HR/tabs/LeaveTab";
import PerformanceTab from "@/components/HR/tabs/PerformanceTab";
import TrainingTab from "@/components/HR/tabs/TrainingTab";
import DisciplinaryTab from "@/components/HR/tabs/DisciplinaryTab";
import RecruitmentTab from "@/components/HR/tabs/RecruitmentTab";
import ReportsTab from "@/components/HR/tabs/ReportsTab";
import SettingsTab from "@/components/HR/tabs/SettingsTab";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { ContentWidth, PageShell } from "@/components/ui/layout-system";
import TabRow from "@/components/ui/layout-system/TabRow";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { StatusMessage } from "@/components/ui";

const HR_TABS = [
  { id: "dashboard", label: "Dashboard", component: HRDashboardTab },
  { id: "employees", label: "Employees", component: EmployeesTab },
  { id: "attendance", label: "Attendance", component: AttendanceTab },
  { id: "payroll", label: "Payroll", component: PayrollTab },
  { id: "leave", label: "Leave", component: LeaveTab },
  { id: "performance", label: "Performance", component: PerformanceTab },
  { id: "training", label: "Training", component: TrainingTab },
  { id: "disciplinary", label: "Disciplinary", component: DisciplinaryTab },
  { id: "recruitment", label: "Recruitment", component: RecruitmentTab },
  { id: "reports", label: "Reports", component: ReportsTab },
  { id: "settings", label: "Settings", component: SettingsTab },
];

export default function HRManagerDashboard() {
  const { user, loading: userLoading } = useUser();
  const { data: session, status: sessionStatus } = useSession();
  const [activeTab, setActiveTab] = useState("dashboard");
  const safeModeEnabled = process.env.NEXT_PUBLIC_HR_MANAGER_SAFE_MODE === "true";

  const userRoles = normalizeRoles(session?.user?.roles || user?.roles || []);
  const authIsLoading = sessionStatus === "loading" || userLoading;
  const hasHRAccess = canAccessHrManagerDashboard(userRoles);

  if (authIsLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "50vh",
          color: "var(--text-secondary)",
        }}
      >
        Checking access…
      </div>
    );
  }

  if (!hasHRAccess) {
    return (
      <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
        <StatusMessage tone="danger">
          <strong>Access Denied.</strong> You don&apos;t have permission to access the HR Manager dashboard. This area
          is restricted to Owners and Admin Managers.
        </StatusMessage>
      </div>
    );
  }

  if (safeModeEnabled) {
    return (
      <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
        <StatusMessage tone="info">
          <strong>HR Manager Safe Mode.</strong> The dashboard UI is temporarily replaced with this lightweight view so
          we can confirm routing and permissions without rendering the heavier HR widgets. Set{" "}
          <code>NEXT_PUBLIC_HR_MANAGER_SAFE_MODE=false</code> (or remove it) and restart the dev server when you are
          ready to restore the full interface.
        </StatusMessage>
      </div>
    );
  }

  const ActiveTabComponent = HR_TABS.find((tab) => tab.id === activeTab)?.component || HRDashboardTab;

  return (
    <PageShell sectionKey="hr-manager-shell" className="hr-manager-shell">
      <ContentWidth sectionKey="hr-manager-content" parentKey="hr-manager-shell" widthMode="full">
        <TabRow
          sectionKey="hr-manager-tabs"
          parentKey="hr-manager-content"
          className="tab-scroll-row is-overflowing hr-manager-tabs-row"
        >
          <TabGroup
            ariaLabel="HR sections"
            items={HR_TABS.map((tab) => ({ value: tab.id, label: tab.label }))}
            value={activeTab}
            onChange={(value) => setActiveTab(value)}
          />
        </TabRow>

        <DevLayoutSection
          sectionKey={`hr-manager-tab-${activeTab}`}
          parentKey="hr-manager-content"
          sectionType="section-shell"
          className="hr-manager-tab-panel"
        >
          <div className="hr-manager-tab-content">
            <ActiveTabComponent />
          </div>
        </DevLayoutSection>
      </ContentWidth>
    </PageShell>
  );
}
