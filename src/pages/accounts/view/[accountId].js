// file location: src/pages/accounts/view/[accountId].js // include path comment for reviewers
import React, { useEffect, useMemo, useState } from "react"; // import React hooks for state/effects/memoization
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useUser } from "@/context/UserContext";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import InvoiceTable from "@/components/accounts/InvoiceTable";
import TransactionTable from "@/components/accounts/TransactionTable";
import Button from "@/components/ui/Button";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

const VIEW_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER", "GENERAL MANAGER", "SERVICE MANAGER", "WORKSHOP MANAGER", "SALES"];
const currencyFormatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const statusBadgeStyles = {
  Active: { background: "rgba(var(--success-rgb), 0.16)", color: "var(--success-text)" },
  Frozen: { background: "rgba(var(--warning-rgb), 0.18)", color: "var(--warning-text)" },
  Closed: { background: "rgba(var(--danger-rgb), 0.16)", color: "var(--danger-dark)" },
};

export default function ViewAccountPage() {
  const router = useRouter();
  const { accountId } = router.query;
  const { user } = useUser();
  const permissions = useMemo(() => deriveAccountPermissions(user?.roles || []), [user]);
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", type: "", payment_method: "", from: "", to: "" });
  const [invoiceFilters, setInvoiceFilters] = useState({ search: "", status: "", from: "", to: "" });
  useEffect(() => {
    if (!accountId) return;
    const controller = new AbortController();
    const loadAccount = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/accounts/${accountId}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to load account");
        }
        setAccount(payload.data || null);
        setTransactions(payload.transactions || []);
        setInvoices(payload.invoices || []);
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error("Failed to load account", error);
      } finally {
        setLoading(false);
      }
    };
    loadAccount();
    return () => controller.abort();
  }, [accountId]);
  const handleFreezeToggle = async () => {
    if (!account) return;
    const nextStatus = account.status === "Frozen" ? "Active" : "Frozen";
    try {
      const response = await fetch(`/api/accounts/${account.account_id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to update status");
      }
      setAccount((prev) => ({ ...prev, status: nextStatus }));
    } catch (error) {
      console.error("Failed to toggle status", error);
    }
  };
  const handleEdit = () => {
    if (!account) return;
    router.push(`/accounts/edit/${account.account_id}`);
  };
  const handleTransactionsPage = () => {
    if (!account) return;
    router.push(`/accounts/transactions/${account.account_id}`);
  };
  const handleInvoicesPage = () => {
    router.push(`/accounts/invoices?accountId=${account?.account_id || ""}`);
  };

  const detailCard = (label, value) => (
    <div style={{ background: "var(--surface)", borderRadius: "var(--control-radius)", border: "1px solid rgba(var(--primary-rgb), 0.08)", padding: "16px" }}>
      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
      <strong style={{ display: "block", marginTop: "10px", fontSize: "1.35rem", color: "var(--text-primary)" }}>{value}</strong>
    </div>
  );

  return (
    <ProtectedRoute allowedRoles={VIEW_ROLES}>
      <Layout>
        <DevLayoutSection sectionKey="account-view-page-shell" sectionType="page-shell" shell>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {loading && <p style={{ color: "var(--text-secondary)" }}>Loading account…</p>}
          {!loading && account && (
            <>
              <DevLayoutSection as="section" sectionKey="account-view-header" sectionType="content-card" parentKey="account-view-page-shell" className="app-section-card" style={{ display: "flex", flexDirection: "column", gap: "16px", background: "rgba(var(--primary-rgb), 0.08)", border: "1px solid rgba(var(--primary-rgb), 0.16)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                  <div>
                    <h1 style={{ margin: 0, fontSize: "2rem", color: "var(--text-primary)" }}>{account.billing_name || account.account_id}</h1>
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Button type="button" variant="secondary" onClick={handleTransactionsPage}>Transactions</Button>
                    <Button type="button" variant="secondary" onClick={handleInvoicesPage}>Invoices</Button>
                    {permissions.canEditAccount && <Button type="button" variant="secondary" onClick={handleEdit}>Edit</Button>}
                    {permissions.canFreezeAccount && <Button type="button" onClick={handleFreezeToggle}>{account.status === "Frozen" ? "Unfreeze" : "Freeze"}</Button>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <span className="app-btn app-btn--secondary app-btn--sm" style={{ cursor: "default" }}>ID: {account.account_id}</span>
                  <span className="app-btn app-btn--secondary app-btn--sm" style={{ cursor: "default" }}>Customer: {account.customer_id || "—"}</span>
                  <span className="app-btn app-btn--secondary app-btn--sm" style={{ cursor: "default" }}>Type: {account.account_type}</span>
                  <span className="app-btn app-btn--sm" style={{ cursor: "default", ...(statusBadgeStyles[account.status] || { background: "var(--surface)", color: "var(--text-primary)" }) }}>{account.status}</span>
                </div>
              </DevLayoutSection>
              <DevLayoutSection as="section" sectionKey="account-view-overview-card" sectionType="content-card" parentKey="account-view-page-shell" className="app-section-card" style={{ display: "flex", flexDirection: "column", gap: "18px", background: "rgba(var(--primary-rgb), 0.08)", border: "1px solid rgba(var(--primary-rgb), 0.16)" }}>
                <DevLayoutSection sectionKey="account-view-metrics-grid" sectionType="content-card" parentKey="account-view-overview-card">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                  {detailCard("Balance", currencyFormatter.format(Number(account.balance || 0)))}
                  {detailCard("Credit Limit", currencyFormatter.format(Number(account.credit_limit || 0)))}
                  {detailCard("Credit Terms", `${account.credit_terms || 0} days`)}
                  {detailCard("Created", account.created_at ? new Date(account.created_at).toLocaleDateString("en-GB") : "—")}
                </div>
                </DevLayoutSection>
                <DevLayoutSection sectionKey="account-view-billing-section" sectionType="content-card" parentKey="account-view-overview-card">
                <div style={{ display: "flex", flexDirection: "column", gap: "14px", background: "var(--surface)", borderRadius: "var(--control-radius)", border: "1px solid rgba(var(--primary-rgb), 0.08)", padding: "16px" }}>
                  <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1.2rem" }}>Billing Information</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                    <div><p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.75rem" }}>Name</p><strong style={{ display: "block", marginTop: "6px", color: "var(--text-primary)" }}>{account.billing_name || "—"}</strong></div>
                    <div><p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.75rem" }}>Email</p><strong style={{ display: "block", marginTop: "6px", color: "var(--text-primary)" }}>{account.billing_email || "—"}</strong></div>
                    <div><p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.75rem" }}>Phone</p><strong style={{ display: "block", marginTop: "6px", color: "var(--text-primary)" }}>{account.billing_phone || "—"}</strong></div>
                    <div><p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.75rem" }}>Address</p><strong style={{ display: "block", marginTop: "6px", color: "var(--text-primary)" }}>{[account.billing_address_line1, account.billing_address_line2, account.billing_city, account.billing_postcode, account.billing_country].filter(Boolean).join(", ") || "—"}</strong></div>
                  </div>
                </div>
                </DevLayoutSection>
                <DevLayoutSection sectionKey="account-view-notes-section" sectionType="content-card" parentKey="account-view-overview-card">
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "var(--surface)", borderRadius: "var(--control-radius)", border: "1px solid rgba(var(--primary-rgb), 0.08)", padding: "16px" }}>
                  <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1.2rem" }}>Internal Notes</h2>
                  <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.6 }}>{account.notes || "No notes recorded."}</p>
                </div>
                </DevLayoutSection>
              </DevLayoutSection>
              <DevLayoutSection sectionKey="account-view-transactions" sectionType="data-table" parentKey="account-view-page-shell">
              <TransactionTable transactions={transactions} loading={loading} filters={filters} onFilterChange={setFilters} pagination={{ page: 1, pageSize: transactions.length || 1, total: transactions.length || 0 }} onPageChange={handleTransactionsPage} onExport={() => router.push(`/accounts/transactions/${account.account_id}`)} accentSurface />
              </DevLayoutSection>
              <DevLayoutSection sectionKey="account-view-invoices" sectionType="data-table" parentKey="account-view-page-shell">
              <InvoiceTable invoices={invoices} filters={invoiceFilters} onFilterChange={setInvoiceFilters} pagination={{ page: 1, pageSize: invoices.length || 1, total: invoices.length || 0 }} onPageChange={handleInvoicesPage} onExport={() => router.push(`/accounts/invoices?accountId=${account.account_id}`)} loading={loading} accentSurface />
              </DevLayoutSection>
            </>
          )}
          {!loading && !account && <p style={{ color: "var(--danger)" }}>Account not found.</p>}
        </div>
        </DevLayoutSection>
      </Layout>
    </ProtectedRoute>
  );
}
