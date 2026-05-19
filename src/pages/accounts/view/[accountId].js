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
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import ViewAccountPageUi from "@/components/page-ui/accounts/view/accounts-view-account-id-ui"; // Extracted presentation layer.

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
  // notFound flips true only when the server has *definitively* said the
  // account isn't there (404 or `data: null`). Until then the page stays in
  // the skeleton loading state — never flashing "Account not found".
  const [notFound, setNotFound] = useState(false);
  const [filters, setFilters] = useState({ search: "", type: "", payment_method: "", from: "", to: "" });
  const [invoiceFilters, setInvoiceFilters] = useState({ search: "", status: "", from: "", to: "" });
  useEffect(() => {
    if (!accountId) return;
    const controller = new AbortController();
    let cancelled = false;
    const loadAccount = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const response = await fetch(`/api/accounts/${accountId}`, { signal: controller.signal });
        if (cancelled) return;
        if (response.status === 404) {
          setAccount(null);
          setNotFound(true);
          setLoading(false);
          return;
        }
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to load account");
        }
        if (!payload?.data) {
          // Definitive empty result — server confirms there's nothing here.
          setAccount(null);
          setNotFound(true);
        } else {
          setAccount(payload.data);
          setTransactions(payload.transactions || []);
          setInvoices(payload.invoices || []);
        }
        setLoading(false);
      } catch (error) {
        // An abort means a newer request has taken over — leave state alone
        // so the in-flight load owns the loading flag and the skeleton stays.
        if (error.name === "AbortError") return;
        if (cancelled) return;
        console.error("Failed to load account", error);
        setLoading(false);
      }
    };
    loadAccount();
    return () => {
      cancelled = true;
      controller.abort();
    };
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

  // detailCard sits inside the metrics-grid LayerSurface, so per the alternation rule it's a LayerTheme.
  const detailCard = (label, value) =>
  <LayerTheme radius="var(--radius-sm)" padding="16px">
      <p style={{ margin: 0, color: "var(--text-1)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
      <strong style={{ display: "block", marginTop: "10px", fontSize: "1.35rem", color: "var(--text-1)" }}>{value}</strong>
    </LayerTheme>;


  return <ViewAccountPageUi view="section1" account={account} Button={Button} currencyFormatter={currencyFormatter} detailCard={detailCard} DevLayoutSection={DevLayoutSection} filters={filters} handleEdit={handleEdit} handleFreezeToggle={handleFreezeToggle} handleInvoicesPage={handleInvoicesPage} handleTransactionsPage={handleTransactionsPage} invoiceFilters={invoiceFilters} invoices={invoices} InvoiceTable={InvoiceTable} loading={loading} notFound={notFound} permissions={permissions} ProtectedRoute={ProtectedRoute} router={router} setFilters={setFilters} setInvoiceFilters={setInvoiceFilters} SkeletonBlock={SkeletonBlock} SkeletonKeyframes={SkeletonKeyframes} transactions={transactions} TransactionTable={TransactionTable} VIEW_ROLES={VIEW_ROLES} />;























































































































}
