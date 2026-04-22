// file location: src/pages/accounts/reports/index.js
import React, { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ToolbarRow from "@/components/ui/ToolbarRow";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { REPORT_PERIODS } from "@/config/accounts";
import { exportToCsv } from "@/utils/exportUtils";
import AccountsReportsPageUi from "@/components/page-ui/accounts/reports/accounts-reports-ui"; // Extracted presentation layer.

const REPORT_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER", "GENERAL MANAGER"];

const metricsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px"
};

const metricSurfaceStyle = {
  flex: "1 1 220px",
  background: "var(--surface)"
};

const metricsShellStyle = {
  gap: "16px",
  background: "rgba(var(--primary-rgb), 0.1)",
  border: "1px solid rgba(var(--primary-rgb), 0.2)"
};

export default function AccountsReportsPage() {
  const [activePeriod, setActivePeriod] = useState("monthly");
  const [reportData, setReportData] = useState({ monthly: {}, quarterly: {}, yearly: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/accounts?view=reports");
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to load reports");
        }
        setReportData({
          monthly: payload.monthly || {},
          quarterly: payload.quarterly || {},
          yearly: payload.yearly || {}
        });
      } catch (error) {
        console.error("Failed to load account reports", error);
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, []);

  const current = reportData[activePeriod] || {};

  const metricCard = (key, label, value, accent = "var(--primary)") =>
  <DevLayoutSection
    key={key}
    as="div"
    sectionKey={key}
    sectionType="stat-card"
    parentKey="accounts-reports-metrics-shell"
    backgroundToken="surface"
    className="app-section-card"
    style={metricSurfaceStyle}>
    
      <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>{label}</p>
      <strong style={{ display: "block", marginTop: "10px", fontSize: "1.8rem", color: accent }}>{value}</strong>
    </DevLayoutSection>;


  const handleExport = () => {
    const rows = REPORT_PERIODS.map((period) => ({
      period: period.label,
      newAccounts: reportData[period.value]?.newAccounts || 0,
      totalInvoiced: reportData[period.value]?.totalInvoiced || 0,
      overdueInvoices: reportData[period.value]?.overdueInvoices || 0,
      averageBalance: reportData[period.value]?.averageBalance || 0
    }));

    exportToCsv("accounts-report.csv", rows, ["period", "newAccounts", "totalInvoiced", "overdueInvoices", "averageBalance"]);
  };

  return <AccountsReportsPageUi view="section1" activePeriod={activePeriod} Button={Button} Card={Card} current={current} DevLayoutSection={DevLayoutSection} handleExport={handleExport} loading={loading} metricCard={metricCard} metricsGridStyle={metricsGridStyle} metricsShellStyle={metricsShellStyle} ProtectedRoute={ProtectedRoute} REPORT_PERIODS={REPORT_PERIODS} REPORT_ROLES={REPORT_ROLES} setActivePeriod={setActivePeriod} ToolbarRow={ToolbarRow} />;










































































































}
