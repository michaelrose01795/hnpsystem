// file location: src/pages/accounts/reports/index.js // header comment referencing file path
import React, { useEffect, useState } from "react"; // import React along with hooks for state/effects
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { REPORT_PERIODS } from "@/config/accounts";
import { exportToCsv } from "@/utils/exportUtils";
const REPORT_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER", "GENERAL MANAGER"];
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
  const metricCard = (label, value, accent = "var(--primary)") => (
    <div style={{ border: "1px solid var(--surface-light)", borderRadius: "16px", padding: "20px", background: "var(--surface)", flex: "1 1 220px" }}>
      <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>{label}</p>
      <strong style={{ display: "block", marginTop: "10px", fontSize: "1.8rem", color: accent }}>{value}</strong>
    </div>
  );
  const handleExport = () => {
    const rows = REPORT_PERIODS.map((period) => ({ period: period.label, newAccounts: reportData[period.value]?.newAccounts || 0, totalInvoiced: reportData[period.value]?.totalInvoiced || 0, overdueInvoices: reportData[period.value]?.overdueInvoices || 0, averageBalance: reportData[period.value]?.averageBalance || 0 }));
    exportToCsv("accounts-report.csv", rows, ["period", "newAccounts", "totalInvoiced", "overdueInvoices", "averageBalance"]);
  };
  return (
    <ProtectedRoute allowedRoles={REPORT_ROLES}>
      <Layout>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "2rem", color: "var(--primary)" }}></h1>
              <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>Monitor account creation velocity, exposure, and overdue invoices.</p>
            </div>
            <button type="button" onClick={handleExport} style={{ padding: "10px 18px", borderRadius: "10px", border: "1px solid var(--primary)", background: "transparent", color: "var(--primary)", fontWeight: 600 }}>Export Summary</button>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {REPORT_PERIODS.map((period) => {
              const isActive = activePeriod === period.value;
              return (
                <button key={period.value} type="button" onClick={() => setActivePeriod(period.value)} style={{ padding: "10px 16px", borderRadius: "999px", border: isActive ? "1px solid var(--primary)" : "1px solid var(--surface-light)", background: isActive ? "var(--primary)" : "var(--surface-light)", color: isActive ? "var(--text-inverse)" : "var(--text-secondary)", fontWeight: 600, transition: "all 0.2s ease" }}>{period.label}</button>
              );
            })}
          </div>
          {loading && <p style={{ color: "var(--text-secondary)" }}>Loading reports…</p>}
          {!loading && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                {metricCard("New Accounts", current.newAccounts ?? 0)}
                {metricCard("Total Invoiced", new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(current.totalInvoiced || 0))}
                {metricCard("Overdue Invoices", current.overdueInvoices ?? 0, "var(--warning-text)")}
                {metricCard("Average Balance", new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(current.averageBalance || 0), "#0f766e")}
              </div>
              <section style={{ border: "1px solid var(--surface-light)", borderRadius: "16px", padding: "20px", background: "var(--surface)", display: "flex", flexDirection: "column", gap: "12px" }}>
                <h2 style={{ margin: 0, color: "var(--primary)", fontSize: "1.4rem" }}>Highlights</h2>
                <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  <li>{current.newAccounts ?? 0} new accounts opened during this period.</li>
                  <li>{new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(current.totalInvoiced || 0)} invoiced with {current.overdueInvoices ?? 0} overdue follow-ups.</li>
                  <li>Average balance stands at {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(current.averageBalance || 0)} for the selected period.</li>
                </ul>
              </section>
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
