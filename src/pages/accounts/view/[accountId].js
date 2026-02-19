// file location: src/pages/accounts/view/[accountId].js // include path comment for reviewers
import React, { useEffect, useMemo, useState } from "react"; // import React hooks for state/effects/memoization
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useUser } from "@/context/UserContext";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import InvoiceTable from "@/components/accounts/InvoiceTable";
import TransactionTable from "@/components/accounts/TransactionTable";
const VIEW_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER", "GENERAL MANAGER", "SERVICE MANAGER", "WORKSHOP MANAGER", "SALES"];
const currencyFormatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
export default function ViewAccountPage() {
  const router = useRouter();
  const { accountId } = router.query;
  const { user } = useUser();
  const permissions = useMemo(() => deriveAccountPermissions(user?.roles || []), [user]);
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: "", payment_method: "", from: "", to: "" });
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
    <div style={{ flex: "1 1 200px", border: "1px solid var(--surface-light)", borderRadius: "16px", padding: "16px", background: "var(--surface)" }}>
      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <strong style={{ display: "block", marginTop: "8px", fontSize: "1.4rem", color: "var(--primary)" }}>{value}</strong>
    </div>
  );
  return (
    <ProtectedRoute allowedRoles={VIEW_ROLES}>
      <Layout>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {loading && <p style={{ color: "var(--text-secondary)" }}>Loading account…</p>}
          {!loading && account && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
                <div>
                  <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.05em" }}>Account</p>
                  <h1 style={{ margin: "4px 0", fontSize: "2rem", color: "var(--primary)" }}>{account.billing_name || account.account_id}</h1>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <span style={{ padding: "4px 12px", borderRadius: "999px", background: "var(--surface-light)", fontWeight: 600 }}>ID: {account.account_id}</span>
                    <span style={{ padding: "4px 12px", borderRadius: "999px", background: "var(--surface-light)", fontWeight: 600 }}>Customer: {account.customer_id}</span>
                    <span style={{ padding: "4px 12px", borderRadius: "999px", background: "var(--surface-light)", fontWeight: 600 }}>Type: {account.account_type}</span>
                    <span style={{ padding: "4px 12px", borderRadius: "999px", background: account.status === "Frozen" ? "rgba(var(--warning-rgb), 0.18)" : "rgba(var(--success-rgb), 0.18)", color: account.status === "Frozen" ? "var(--warning-text)" : "var(--success-text)", fontWeight: 700 }}>{account.status}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button type="button" onClick={handleTransactionsPage} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)", fontWeight: 600 }}>Transactions</button>
                  <button type="button" onClick={handleInvoicesPage} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)", fontWeight: 600 }}>Invoices</button>
                  {permissions.canEditAccount && <button type="button" onClick={handleEdit} style={{ padding: "10px 18px", borderRadius: "10px", border: "1px solid var(--primary)", background: "transparent", color: "var(--primary)", fontWeight: 600 }}>Edit</button>}
                  {permissions.canFreezeAccount && <button type="button" onClick={handleFreezeToggle} style={{ padding: "10px 18px", borderRadius: "10px", border: "none", background: account.status === "Frozen" ? "var(--surface-light)" : "var(--primary)", color: account.status === "Frozen" ? "var(--text-secondary)" : "white", fontWeight: 700 }}>{account.status === "Frozen" ? "Unfreeze" : "Freeze"}</button>}
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                {detailCard("Balance", currencyFormatter.format(Number(account.balance || 0)))}
                {detailCard("Credit Limit", currencyFormatter.format(Number(account.credit_limit || 0)))}
                {detailCard("Credit Terms", `${account.credit_terms || 0} days`)}
                {detailCard("Created", account.created_at ? new Date(account.created_at).toLocaleDateString("en-GB") : "—")}
              </div>
              <section style={{ border: "1px solid var(--surface-light)", borderRadius: "16px", padding: "20px", background: "var(--surface)" }}>
                <h2 style={{ margin: 0, color: "var(--primary)", fontSize: "1.25rem" }}>Billing Information</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginTop: "12px" }}>
                  <div><p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.75rem" }}>Name</p><strong>{account.billing_name || "—"}</strong></div>
                  <div><p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.75rem" }}>Email</p><strong>{account.billing_email || "—"}</strong></div>
                  <div><p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.75rem" }}>Phone</p><strong>{account.billing_phone || "—"}</strong></div>
                  <div><p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.75rem" }}>Address</p><strong>{[account.billing_address_line1, account.billing_address_line2, account.billing_city, account.billing_postcode, account.billing_country].filter(Boolean).join(", ") || "—"}</strong></div>
                </div>
              </section>
              <section style={{ border: "1px solid var(--surface-light)", borderRadius: "16px", padding: "20px", background: "var(--surface)", display: "flex", flexDirection: "column", gap: "12px" }}>
                <h2 style={{ margin: 0, color: "var(--primary)", fontSize: "1.25rem" }}>Internal Notes</h2>
                <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.6 }}>{account.notes || "No notes recorded."}</p>
              </section>
              <TransactionTable transactions={transactions} loading={loading} filters={filters} onFilterChange={setFilters} pagination={{ page: 1, pageSize: transactions.length || 1, total: transactions.length || 0 }} onPageChange={handleTransactionsPage} onExport={() => router.push(`/accounts/transactions/${account.account_id}`)} />
              <InvoiceTable invoices={invoices} filters={invoiceFilters} onFilterChange={setInvoiceFilters} pagination={{ page: 1, pageSize: invoices.length || 1, total: invoices.length || 0 }} onPageChange={handleInvoicesPage} onExport={() => router.push(`/accounts/invoices?accountId=${account.account_id}`)} loading={loading} />
            </>
          )}
          {!loading && !account && <p style={{ color: "var(--danger)" }}>Account not found.</p>}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
