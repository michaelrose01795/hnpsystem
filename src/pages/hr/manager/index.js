// ✅ HR Manager Dashboard - Comprehensive interface for HR management
// file location: src/pages/hr/manager/index.js
// This page is only accessible to users with "owner" or "admin manager" roles
// It provides tabbed access to all HR functions from a single interface

import React, { useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { useSession } from "next-auth/react";

// Import individual HR sections as separate components
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

// Tab configuration - each tab represents a major HR function
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
  console.log("🎯 HR Manager Dashboard component is RENDERING");

  const { user } = useUser();
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState("dashboard");
  const safeModeEnabled = process.env.NEXT_PUBLIC_HR_MANAGER_SAFE_MODE === "true";

  // Check if user has Owner access
  const userRoles = session?.user?.roles || user?.roles || [];

  // Debug logging
  console.log("🔍 HR Manager Dashboard - User Roles:", userRoles);
  console.log("🔍 HR Manager Dashboard - User:", user);
  console.log("🔍 HR Manager Dashboard - Session:", session);

  // Only Owner has access to HR Manager dashboard
  const hasHRAccess = userRoles.some(role =>
    role.toLowerCase() === 'owner'
  );

  console.log("🔍 HR Manager Dashboard - Has Access:", hasHRAccess);

  // Access denied for unauthorized users
  if (!hasHRAccess) {
    console.log("❌ HR Manager Dashboard - Access DENIED");
    return (
      <Layout>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "var(--danger)", marginBottom: "16px" }}>
            Access Denied
          </h1>
          <p style={{ color: "var(--text-secondary)", maxWidth: "500px" }}>
            You don't have permission to access the HR Manager dashboard. This area is restricted to Owners only.
          </p>
        </div>
      </Layout>
    );
  }

  if (safeModeEnabled) {
    return (
      <Layout>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            padding: "32px",
            minHeight: "60vh",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--primary)" }}>
            HR Manager Safe Mode
          </h1>
          <p style={{ maxWidth: "640px", color: "var(--text-secondary)" }}>
            The dashboard UI is temporarily replaced with this lightweight view so we can confirm
            routing and permissions without rendering the heavier HR widgets. Set{" "}
            <code>NEXT_PUBLIC_HR_MANAGER_SAFE_MODE=false</code> (or remove it) and restart the dev
            server when you are ready to restore the full interface.
          </p>
          <pre
            style={{
              padding: "16px 20px",
              borderRadius: "12px",
              background: "var(--surface-light)",
              border: "1px dashed var(--primary-light)",
              fontSize: "0.95rem",
              maxWidth: "520px",
              width: "100%",
              textAlign: "left",
            }}
          >
            {`# .env.local
NEXT_PUBLIC_HR_MANAGER_SAFE_MODE=false`}
          </pre>
        </div>
      </Layout>
    );
  }

  // Get the active tab component
  const ActiveTabComponent = HR_TABS.find(tab => tab.id === activeTab)?.component || HRDashboardTab;

  return (
    <Layout>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0",
          padding: "0",
          minHeight: "calc(100vh - 40px)",
        }}
      >
        {/* Header Section */}
        <div
          style={{
            background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)",
            padding: "32px 32px 16px",
            color: "white",
            borderRadius: "16px 16px 0 0",
          }}
        >
          <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: "0 0 8px" }}>
              HR Manager Dashboard
            </h1>
            <p style={{ margin: 0, opacity: 0.9, fontSize: "1rem" }}>
              Comprehensive human resources management and operations center
            </p>
          </div>

          {/* Tab Navigation */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "24px",
              overflowX: "auto",
              paddingBottom: "0",
              scrollbarWidth: "thin",
            }}
          >
            {HR_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0",
                    padding: "12px 20px",
                    background: isActive ? "var(--surface)" : "rgba(255, 255, 255, 0.1)",
                    color: isActive ? "var(--primary)" : "white",
                    border: "none",
                    borderRadius: isActive ? "12px 12px 0 0" : "8px 8px 0 0",
                    fontWeight: isActive ? 700 : 600,
                    fontSize: "0.95rem",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                    boxShadow: isActive ? "0 -4px 12px rgba(0, 0, 0, 0.1)" : "none",
                  }}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content Area */}
        <div
          style={{
            background: "var(--background)",
            padding: "24px 32px 32px",
            borderRadius: "0 0 16px 16px",
            flexGrow: 1,
          }}
        >
          <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
            {/* Render active tab component */}
            <ActiveTabComponent />
          </div>
        </div>
      </div>
    </Layout>
  );
}
