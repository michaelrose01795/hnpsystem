// file location: src/pages/accounts/reports/index.js
import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ToolbarRow from "@/components/ui/ToolbarRow";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { REPORT_PERIODS } from "@/config/accounts";
import { exportToCsv } from "@/utils/exportUtils";

const REPORT_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER", "GENERAL MANAGER"];

const metricsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
};

const metricSurfaceStyle = {
  flex: "1 1 220px",
  background: "var(--surface)",
};

const metricsShellStyle = {
  gap: "16px",
  background: "rgba(var(--primary-rgb), 0.1)",
  border: "1px solid rgba(var(--primary-rgb), 0.2)",
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
          yearly: payload.yearly || {},
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

  const metricCard = (key, label, value, accent = "var(--primary)") => (
    <DevLayoutSection
      key={key}
      as="div"
      sectionKey={key}
      sectionType="stat-card"
      parentKey="accounts-reports-metrics-shell"
      backgroundToken="surface"
      className="app-section-card"
      style={metricSurfaceStyle}
    >
      <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>{label}</p>
      <strong style={{ display: "block", marginTop: "10px", fontSize: "1.8rem", color: accent }}>{value}</strong>
    </DevLayoutSection>
  );

  const handleExport = () => {
    const rows = REPORT_PERIODS.map((period) => ({
      period: period.label,
      newAccounts: reportData[period.value]?.newAccounts || 0,
      totalInvoiced: reportData[period.value]?.totalInvoiced || 0,
      overdueInvoices: reportData[period.value]?.overdueInvoices || 0,
      averageBalance: reportData[period.value]?.averageBalance || 0,
    }));

    exportToCsv("accounts-report.csv", rows, ["period", "newAccounts", "totalInvoiced", "overdueInvoices", "averageBalance"]);
  };

  return (
    <ProtectedRoute allowedRoles={REPORT_ROLES}>
      <Layout>
        <DevLayoutSection
          as="div"
          sectionKey="accounts-reports-page-shell"
          sectionType="page-shell"
          backgroundToken="page-card-bg"
          shell
          className="app-layout-page-shell"
          style={{ gap: "20px" }}
        >
          <DevLayoutSection
            as="section"
            sectionKey="accounts-reports-toolbar"
            sectionType="content-card"
            parentKey="accounts-reports-page-shell"
            backgroundToken="surface"
            className="app-section-card"
          >
            <ToolbarRow style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div
                className="app-toolbar-row"
                style={{
                  flex: "1 1 auto",
                  flexWrap: "nowrap",
                  justifyContent: "flex-start",
                  overflowX: "auto",
                  maxWidth: "calc(100% - 180px)",
                }}
              >
                {REPORT_PERIODS.map((period) => {
                  const isActive = activePeriod === period.value;
                  return (
                    <Button
                      key={period.value}
                      onClick={() => setActivePeriod(period.value)}
                      variant={isActive ? "primary" : "secondary"}
                      size="sm"
                      pill
                    >
                      {period.label}
                    </Button>
                  );
                })}
              </div>
              <Button variant="secondary" size="sm" onClick={handleExport}>
                Export Summary
              </Button>
            </ToolbarRow>
          </DevLayoutSection>

          {loading && <p style={{ color: "var(--text-secondary)", margin: 0 }}>Loading reports…</p>}

          {!loading && (
            <>
              <DevLayoutSection
                as="section"
                sectionKey="accounts-reports-metrics-shell"
                sectionType="content-card"
                parentKey="accounts-reports-page-shell"
                backgroundToken="accent"
                className="app-layout-surface-accent"
                style={metricsShellStyle}
              >
                <div style={metricsGridStyle}>
                  {metricCard("accounts-reports-auto-content-card-2", "New Accounts", current.newAccounts ?? 0)}
                  {metricCard(
                    "accounts-reports-auto-content-card-3",
                    "Total Invoiced",
                    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(current.totalInvoiced || 0)
                  )}
                  {metricCard("accounts-reports-auto-content-card-4", "Overdue Invoices", current.overdueInvoices ?? 0, "var(--warning-text)")}
                  {metricCard(
                    "accounts-reports-auto-content-card-5",
                    "Average Balance",
                    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(current.averageBalance || 0),
                    "#0f766e"
                  )}
                </div>
              </DevLayoutSection>

              <DevLayoutSection
                as="section"
                sectionKey="accounts-reports-highlights-card"
                sectionType="content-card"
                parentKey="accounts-reports-page-shell"
                backgroundToken="surface"
              >
                <Card
                  title="Highlights"
                  className=""
                  style={{ background: "var(--surface)", gap: "12px" }}
                >
                  <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    <li>{current.newAccounts ?? 0} new accounts opened during this period.</li>
                    <li>{new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(current.totalInvoiced || 0)} invoiced with {current.overdueInvoices ?? 0} overdue follow-ups.</li>
                    <li>Average balance stands at {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(current.averageBalance || 0)} for the selected period.</li>
                  </ul>
                </Card>
              </DevLayoutSection>
            </>
          )}
        </DevLayoutSection>
      </Layout>
    </ProtectedRoute>
  );
}
