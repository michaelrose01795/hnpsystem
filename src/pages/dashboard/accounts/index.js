// file location: src/pages/dashboard/accounts/index.js

"use client";

import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import { getAccountsDashboardData } from "@/lib/database/dashboard/accounts";
import { LayerSurface } from "@/components/ui"; // canonical surface layer primitive (nested inside dashboard theme sections)
import AccountsDashboardUi from "@/components/page-ui/dashboard/accounts/dashboard-accounts-ui"; // Extracted presentation layer.

// MetricCard — single stat tile. Lives inside a dashboard LayerTheme section,
// so per the strict alternation rule it renders as a LayerSurface.
const MetricCard = ({ label, value, helper }) => (
  <LayerSurface radius="var(--radius-sm)" style={{ minWidth: 180 }}>
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-accent)" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600, color: "var(--text-1)" }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--surfaceTextMuted)" }}>{helper}</p>}
  </LayerSurface>
);

const TrendBlock = ({ data }) => {
  const max = Math.max(1, ...(data || []).map((item) => item.count));
  return (
    <LayerSurface radius="var(--radius-sm)" padding="12px" gap="8px">
      {(data || []).map((point) =>
      <div key={point.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: 35, fontSize: "0.85rem", color: "var(--surfaceTextMuted)" }}>{point.label}</span>
          <div style={{ flex: 1, height: 8, background: "var(--surface)", borderRadius: 4 }}>
            <div
            style={{
              width: `${Math.round(point.count / max * 100)}%`,
              height: "100%",
              background: "var(--accent-purple)",
              borderRadius: 4
            }} />

          </div>
          <strong style={{ color: "var(--text-accent)" }}>{point.count}</strong>
        </div>
      )}
    </LayerSurface>);

};

// JobList — list block inside a dashboard LayerTheme section, so it renders as LayerSurface.
const JobList = ({ jobs }) => (
  <LayerSurface radius="var(--radius-sm)" padding="12px" gap="10px">
    {jobs.length === 0 ?
      <p style={{ margin: 0, color: "var(--surfaceTextMuted)" }}>No outstanding jobs right now.</p> :
      jobs.map((job) =>
        <div
          key={job.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "var(--text-1)"
          }}>
          <div>
            <strong style={{ color: "var(--text-accent)" }}>{job.job_number || "—"}</strong>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--surfaceTextMuted)" }}>Vehicle {job.vehicle_reg || "TBC"}</p>
          </div>
          <span style={{ fontSize: "0.8rem", color: "var(--surfaceTextMuted)" }}>{job.status}</span>
        </div>
      )
    }
  </LayerSurface>
);


// Currency formatter — single source so every money figure on the page matches.
const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0
});
const formatCurrency = (value) => gbp.format(Number(value || 0));

// TransactionTable — recent ledger activity. Uses the staffglobal.css table
// system (.app-data-table) so it matches every other staff-side table.
const TransactionTable = ({ transactions }) => {
  if (!transactions || transactions.length === 0) {
    return <p className="app-status-message app-status-message--info" style={{ margin: 0 }}>No transactions recorded yet.</p>;
  }
  return (
    <div className="app-table-shell-scroll">
      <table className="app-data-table app-table-shell app-table-shell--with-headings">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Job</th>
            <th>Method</th>
            <th style={{ textAlign: "right" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx, index) => {
            const credit = String(tx.type || "").toLowerCase() === "credit";
            return (
              <tr key={tx.transaction_date ? `${tx.transaction_date}-${index}` : index}>
                <td style={{ color: "var(--text-1)", whiteSpace: "nowrap" }}>
                  {tx.transaction_date ? dayjs(tx.transaction_date).format("DD MMM") : "—"}
                </td>
                <td style={{ color: "var(--text-1)" }}>{tx.description || "—"}</td>
                <td style={{ color: "var(--text-accent)", fontWeight: 700, whiteSpace: "nowrap" }}>
                  {tx.job_number || "—"}
                </td>
                <td style={{ color: "var(--surfaceTextMuted)", whiteSpace: "nowrap" }}>
                  {tx.payment_method || "—"}
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <span className={`app-badge app-badge--control ${credit ? "app-badge--success" : "app-badge--danger"}`}>
                    {credit ? "+" : "−"}{formatCurrency(tx.amount)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// AccountBalanceTable — credit watchlist. Highlights accounts close to or over
// their credit limit so the accounts team can chase them.
const AccountBalanceTable = ({ accounts }) => {
  if (!accounts || accounts.length === 0) {
    return <p className="app-status-message app-status-message--info" style={{ margin: 0 }}>No active customer accounts.</p>;
  }
  return (
    <div className="app-table-shell-scroll">
      <table className="app-data-table app-table-shell app-table-shell--with-headings">
        <thead>
          <tr>
            <th>Account</th>
            <th>Type</th>
            <th style={{ textAlign: "right" }}>Balance</th>
            <th style={{ textAlign: "right" }}>Credit limit</th>
            <th style={{ textAlign: "right" }}>Usage</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => {
            const limit = Number(account.credit_limit || 0);
            const ratio = limit > 0 ? Number(account.balance || 0) / limit : 0;
            const pct = Math.round(ratio * 100);
            const tone = ratio >= 1 ? "app-badge--danger" : ratio >= 0.8 ? "app-badge--warning" : "app-badge--success";
            return (
              <tr key={account.account_id}>
                <td style={{ color: "var(--text-1)" }}>
                  <strong style={{ color: "var(--text-accent)" }}>{account.account_id}</strong>
                  {account.billing_name && (
                    <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--surfaceTextMuted)" }}>
                      {account.billing_name}
                    </p>
                  )}
                </td>
                <td style={{ color: "var(--surfaceTextMuted)", whiteSpace: "nowrap" }}>
                  {account.account_type || "—"}
                </td>
                <td style={{ textAlign: "right", color: "var(--text-1)", whiteSpace: "nowrap" }}>
                  {formatCurrency(account.balance)}
                </td>
                <td style={{ textAlign: "right", color: "var(--surfaceTextMuted)", whiteSpace: "nowrap" }}>
                  {limit > 0 ? formatCurrency(limit) : "—"}
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <span className={`app-badge ${tone}`}>{limit > 0 ? `${pct}%` : "—"}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};


const defaultData = {
  invoicesRaised: 0,
  invoicesPaid: 0,
  outstandingJobs: [],
  trends: [],
  weeklyRevenue: 0,
  weeklyOutgoing: 0,
  paymentsReceived: 0,
  recentTransactions: [],
  creditAccounts: [],
  outstandingDebt: 0,
  accountsAtRisk: 0
};

export default function AccountsDashboard() {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getAccountsDashboardData();
        setData(payload);
      } catch (fetchError) {
        console.error("Failed to load accounts dashboard", fetchError);
        setError(fetchError.message || "Unable to load financial metrics");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <AccountsDashboardUi
      view="section1"
      data={data}
      error={error}
      loading={loading}
      JobList={JobList}
      MetricCard={MetricCard}
      TrendBlock={TrendBlock}
      TransactionTable={TransactionTable}
      AccountBalanceTable={AccountBalanceTable}
      formatCurrency={formatCurrency}
    />
  );
}
