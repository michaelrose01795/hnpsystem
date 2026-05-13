// file location: src/pages/accounts/reports/index.js
import React, { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import Button from "@/components/ui/Button";
import ToolbarRow from "@/components/ui/ToolbarRow";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import LayerSurface from "@/components/ui/LayerSurface"; // canonical layer primitive (CLAUDE.md §3.0)
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
  flex: "1 1 220px"
};

const metricsShellStyle = {
  gap: "16px"
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

  // Each metric card is nested inside the metrics shell (LayerTheme) → so each card is a LayerSurface.
  const metricCard = (key, label, value, accent = "var(--primary)") =>
  <LayerSurface
    key={key}
    sectionKey={key}
    sectionType="stat-card"
    parentKey="accounts-reports-metrics-shell"
    radius="var(--radius-sm)"
    style={metricSurfaceStyle}>

      <p style={{ margin: 0, color: "var(--text-1)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>{label}</p>
      <strong style={{ display: "block", marginTop: "10px", fontSize: "1.8rem", color: accent }}>{value}</strong>
    </LayerSurface>;


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

  return <AccountsReportsPageUi view="section1" activePeriod={activePeriod} Button={Button} current={current} DevLayoutSection={DevLayoutSection} handleExport={handleExport} loading={loading} metricCard={metricCard} metricsGridStyle={metricsGridStyle} metricsShellStyle={metricsShellStyle} ProtectedRoute={ProtectedRoute} REPORT_PERIODS={REPORT_PERIODS} REPORT_ROLES={REPORT_ROLES} setActivePeriod={setActivePeriod} ToolbarRow={ToolbarRow} />;










































































































}
