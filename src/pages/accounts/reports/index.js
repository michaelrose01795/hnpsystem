// file location: src/pages/accounts/reports/index.js // header comment referencing file path
import React, { useEffect, useState } from "react"; // import React along with hooks for state/effects
import Layout from "@/components/Layout"; // import global layout component
import ProtectedRoute from "@/components/ProtectedRoute"; // import auth guard that enforces Keycloak roles
import { REPORT_PERIODS } from "@/config/accounts"; // import report period metadata for tabs
import { exportToCsv } from "@/utils/exportUtils"; // import CSV helper for export button
const REPORT_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER", "GENERAL MANAGER"]; // allow leadership teams to view reports
export default function AccountsReportsPage() { // component definition for reports overview
  const [activePeriod, setActivePeriod] = useState("monthly"); // currently selected report period
  const [reportData, setReportData] = useState({ monthly: {}, quarterly: {}, yearly: {} }); // store aggregated metrics grouped by period
  const [loading, setLoading] = useState(true); // indicate if report data is loading
  useEffect(() => { // effect to load report data once component mounts
    const loadReports = async () => { // async function calling API
      setLoading(true); // show loader before fetch
      try { // try/catch to handle fetch errors gracefully
        const response = await fetch("/api/accounts?view=reports"); // call accounts API with report view parameter
        const payload = await response.json(); // parse JSON body from response
        if (!response.ok) { // check HTTP status code
          throw new Error(payload?.message || "Failed to load reports"); // throw to hit catch block when server error occurs
        } // close guard
        setReportData({ // store report payload keyed by period
          monthly: payload.monthly || {}, // monthly metrics or fallback object
          quarterly: payload.quarterly || {}, // quarterly metrics or fallback object
          yearly: payload.yearly || {}, // yearly metrics or fallback object
        }); // close setReportData call
      } catch (error) { // handle fetch errors
        console.error("Failed to load account reports", error); // log error for debugging purposes
      } finally { // cleanup block that always runs after try/catch
        setLoading(false); // hide loader once request completes
      } // close finally block
    }; // close loadReports definition
    loadReports(); // trigger data fetch immediately on mount
  }, []); // run effect only once because dependency array empty
  const current = reportData[activePeriod] || {}; // compute metrics object for currently selected period
  const metricCard = (label, value, accent = "var(--primary)") => ( // helper rendering a summary card given label/value/accent color
    <div style={{ border: "1px solid var(--surface-light)", borderRadius: "16px", padding: "20px", background: "var(--surface)", flex: "1 1 220px" }}> // card container with consistent styling
      <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>{label}</p> // label text for card
      <strong style={{ display: "block", marginTop: "10px", fontSize: "1.8rem", color: accent }}>{value}</strong> // value text for card with accent color
    </div>
  ); // close helper function
  const handleExport = () => { // export aggregated report data to CSV
    const rows = REPORT_PERIODS.map((period) => ({ period: period.label, newAccounts: reportData[period.value]?.newAccounts || 0, totalInvoiced: reportData[period.value]?.totalInvoiced || 0, overdueInvoices: reportData[period.value]?.overdueInvoices || 0, averageBalance: reportData[period.value]?.averageBalance || 0 })); // build csv rows from reportData
    exportToCsv("accounts-report.csv", rows, ["period", "newAccounts", "totalInvoiced", "overdueInvoices", "averageBalance"]); // trigger CSV helper with header order
  }; // close handleExport definition
  return ( // render reports page tree
    <ProtectedRoute allowedRoles={REPORT_ROLES}> // restrict page to leadership roles
      <Layout> // wrap with layout for nav and chrome
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}> // column layout container
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", alignItems: "center" }}> // header row with title/actions
            <div> // heading text container
              <h1 style={{ margin: 0, fontSize: "2rem", color: "var(--primary)" }}>Account Reports</h1> // page title text
              <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>Monitor account creation velocity, exposure, and overdue invoices.</p> // subtitle text describing page purpose
            </div>
            <button type="button" onClick={handleExport} style={{ padding: "10px 18px", borderRadius: "10px", border: "1px solid var(--primary)", background: "transparent", color: "var(--primary)", fontWeight: 600 }}>Export Summary</button> // export button to download summary CSV
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}> // container for period pills
            {REPORT_PERIODS.map((period) => { // map each period to a pill button
              const isActive = activePeriod === period.value; // determine if pill currently selected
              return ( // return interactive button for each period
                <button key={period.value} type="button" onClick={() => setActivePeriod(period.value)} style={{ padding: "10px 16px", borderRadius: "999px", border: isActive ? "none" : "1px solid var(--surface-light)", background: isActive ? "var(--primary)" : "var(--surface-light)", color: isActive ? "white" : "var(--text-secondary)", fontWeight: 600 }}>{period.label}</button> // button toggles active period when clicked
              ); // close return
            })}
          </div>
          {loading && <p style={{ color: "var(--text-secondary)" }}>Loading reports…</p>} // display loading message when data in flight
          {!loading && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}> // grid of metric cards for active period
                {metricCard("New Accounts", current.newAccounts ?? 0)} // card showing number of accounts created in period
                {metricCard("Total Invoiced", new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(current.totalInvoiced || 0))} // card showing invoice totals formatted as currency
                {metricCard("Overdue Invoices", current.overdueInvoices ?? 0, "#92400e")} // card showing overdue invoice count with amber accent
                {metricCard("Average Balance", new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(current.averageBalance || 0), "#0f766e")} // card showing average balance with teal accent
              </div>
              <section style={{ border: "1px solid var(--surface-light)", borderRadius: "16px", padding: "20px", background: "var(--surface)", display: "flex", flexDirection: "column", gap: "12px" }}> // detail list section summarizing highlights
                <h2 style={{ margin: 0, color: "var(--primary)", fontSize: "1.4rem" }}>Highlights</h2> // section title for highlights
                <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--text-secondary)", lineHeight: 1.6 }}> // unordered list for bullet points
                  <li>{current.newAccounts ?? 0} new accounts opened during this period.</li> // highlight bullet referencing new accounts
                  <li>{new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(current.totalInvoiced || 0)} invoiced with {current.overdueInvoices ?? 0} overdue follow-ups.</li> // highlight bullet referencing invoices and overdue metrics
                  <li>Average balance stands at {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(current.averageBalance || 0)} for the selected period.</li> // highlight bullet referencing average balance
                </ul>
              </section>
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  ); // close component render tree
} // close AccountsReportsPage definition
