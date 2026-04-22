// file location: src/pages/hr/manager/index.js
// HR Manager Dashboard - Comprehensive interface for HR management
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
import HRManagerDashboardUi from "@/components/page-ui/hr/manager/hr-manager-ui"; // Extracted presentation layer.

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
{ id: "settings", label: "Settings", component: SettingsTab }];


export default function HRManagerDashboard() {
  const { user, loading: userLoading } = useUser();
  const { data: session, status: sessionStatus } = useSession();
  const [activeTab, setActiveTab] = useState("dashboard");
  const safeModeEnabled = process.env.NEXT_PUBLIC_HR_MANAGER_SAFE_MODE === "true";

  const userRoles = normalizeRoles(session?.user?.roles || user?.roles || []);
  const authIsLoading = sessionStatus === "loading" || userLoading;
  const hasHRAccess = canAccessHrManagerDashboard(userRoles);

  if (authIsLoading) {
    return <HRManagerDashboardUi view="section1" />;












  }

  if (!hasHRAccess) {
    return <HRManagerDashboardUi view="section2" StatusMessage={StatusMessage} />;







  }

  if (safeModeEnabled) {
    return <HRManagerDashboardUi view="section3" StatusMessage={StatusMessage} />;









  }

  const ActiveTabComponent = HR_TABS.find((tab) => tab.id === activeTab)?.component || HRDashboardTab;

  return <HRManagerDashboardUi view="section4" activeTab={activeTab} ActiveTabComponent={ActiveTabComponent} ContentWidth={ContentWidth} DevLayoutSection={DevLayoutSection} HR_TABS={HR_TABS} PageShell={PageShell} setActiveTab={setActiveTab} TabGroup={TabGroup} TabRow={TabRow} />;




























}
