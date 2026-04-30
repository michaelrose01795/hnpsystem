// file location: src/pages/accounts/view/[accountId].js
import React, { useEffect, useMemo, useState } from "react"; // import React hooks for state/effects/memoization
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useUser } from "@/context/UserContext";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import InvoiceTable from "@/components/accounts/InvoiceTable";
import TransactionTable from "@/components/accounts/TransactionTable";
import Button from "@/components/ui/Button";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import ViewAccountPageUi from "@/components/page-ui/accounts/view/accounts-view-account-id-ui"; // Extracted presentation layer.

const VIEW_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER", "GENERAL MANAGER", "SERVICE MANAGER", "WORKSHOP MANAGER", "SALES"];
const currencyFormatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const statusBadgeStyles = {
  Active: { background: "rgba(var(--success-rgb), 0.16)", color: "var(--success-text)" },
  Frozen: { background: "rgba(var(--warning-rgb), 0.18)", color: "var(--warning-text)" },
  Closed: { background: "rgba(var(--danger-rgb), 0.16)", color: "var(--danger-dark)" }
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

  const detailCard = (label, value) =>
  <div style={{ background: "var(--surface)", borderRadius: "var(--control-radius)", border: "1px solid rgba(var(--primary-rgb), 0.08)", padding: "16px" }}>
      <p style={{ margin: 0, color: "var(--text-1)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
      <strong style={{ display: "block", marginTop: "10px", fontSize: "1.35rem", color: "var(--text-1)" }}>{value}</strong>
    </div>;


  return <ViewAccountPageUi view="section1" account={account} Button={Button} currencyFormatter={currencyFormatter} detailCard={detailCard} DevLayoutSection={DevLayoutSection} filters={filters} handleEdit={handleEdit} handleFreezeToggle={handleFreezeToggle} handleInvoicesPage={handleInvoicesPage} handleTransactionsPage={handleTransactionsPage} invoiceFilters={invoiceFilters} invoices={invoices} InvoiceTable={InvoiceTable} loading={loading} permissions={permissions} ProtectedRoute={ProtectedRoute} router={router} setFilters={setFilters} setInvoiceFilters={setInvoiceFilters} SkeletonBlock={SkeletonBlock} SkeletonKeyframes={SkeletonKeyframes} statusBadgeStyles={statusBadgeStyles} transactions={transactions} TransactionTable={TransactionTable} VIEW_ROLES={VIEW_ROLES} />;























































































































}
